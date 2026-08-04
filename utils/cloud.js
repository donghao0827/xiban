const CONFIG = {
  env: 'prod-d0gfyfw705426c497',
  service: 'express-1w2f'
}

const SYNC_KEYS = {
  wedding: 'xiban_wedding',
  tasks: 'xiban_tasks',
  materials: 'xiban_materials',
  budgets: 'xiban_budgets',
  guests: 'xiban_guests',
  records: 'xiban_records',
  photo: 'xiban_wedding_photo',
  photoOriginal: 'xiban_wedding_photo_original',
  photoDisplay: 'xiban_wedding_photo_display'
}

const META_KEYS = {
  enabled: 'xiban_cloud_enabled',
  version: 'xiban_cloud_version',
  updatedAt: 'xiban_cloud_updated_at',
  status: 'xiban_cloud_status',
  profile: 'xiban_user_profile',
  localUpdatedAt: 'xiban_local_updated_at',
  syncedLocalAt: 'xiban_last_synced_local_at'
}

let pushTimer = null
let pushQueue = Promise.resolve()
let conflictPrompting = false

function isEnabled() {
  return Boolean(wx.getStorageSync(META_KEYS.enabled))
}

function getLocalProfile() {
  return wx.getStorageSync(META_KEYS.profile) || null
}

async function fetchProfile() {
  const profile = await request('/api/profile', 'GET')
  if (profile) {
    wx.setStorageSync(META_KEYS.profile, profile)
  } else {
    const localProfile = getLocalProfile()
    if (!localProfile || localProfile.storageMode !== 'local') {
      if (localProfile && localProfile.weddingId) {
        require('./storage').clearWeddingData()
      }
      wx.removeStorageSync(META_KEYS.profile)
      wx.removeStorageSync('xiban_wechat_avatar')
      disable()
    }
  }
  return profile
}

async function refreshSession() {
  const localProfile = getLocalProfile()
  if (localProfile && localProfile.storageMode === 'local') return localProfile
  const profile = await fetchProfile()
  if (profile && isEnabled()) {
    const localUpdatedAt = Number(wx.getStorageSync(META_KEYS.localUpdatedAt) || 0)
    const syncedLocalAt = Number(wx.getStorageSync(META_KEYS.syncedLocalAt) || 0)
    if (profile.permissionRole !== 'viewer' && localUpdatedAt !== syncedLocalAt) {
      try {
        await push()
      } catch (error) {
        if (error.statusCode === 409 && error.remoteData) promptConflict(error.remoteData)
        else throw error
      }
    } else {
      await pull()
    }
  }
  return profile
}

async function createWedding(data) {
  const result = await request('/api/weddings/create', 'POST', data)
  wx.setStorageSync(META_KEYS.profile, result.profile)
  return result
}

async function upgradeLocalWedding(data) {
  try {
    return await createWedding(data)
  } catch (error) {
    // 云端创建成功但客户端未收到响应时，允许用户无损重试。
    if (error.statusCode !== 409) throw error
    const profile = await fetchProfile()
    if (!profile || !profile.weddingId) throw error
    return { profile, wedding: profile.wedding || null, reused: true }
  }
}

async function previewInvite(inviteCode) {
  return request('/api/invites/preview', 'POST', { inviteCode })
}

async function joinWedding(data) {
  const result = await request('/api/invites/join', 'POST', data)
  wx.setStorageSync(META_KEYS.profile, result.profile)
  return result
}

async function fetchMembers() {
  return request('/api/members', 'GET')
}

async function updateMyAvatar(avatarFileId) {
  const profile = await request('/api/profile/avatar', 'PATCH', { avatarFileId })
  wx.setStorageSync(META_KEYS.profile, profile)
  return profile
}

async function createInvite(data) {
  return request('/api/invites', 'POST', data)
}

async function updateMember(id, data) {
  return request(`/api/members/${id}`, 'PATCH', data)
}

async function removeMember(id) {
  const result = await request(`/api/members/${id}`, 'DELETE')
  if (result && result.avatarFileId && wx.cloud && wx.cloud.deleteFile) {
    wx.cloud.deleteFile({ fileList: [result.avatarFileId], fail: () => {} })
  }
  return result
}

function markLocalChanged() {
  const revision = Number(wx.getStorageSync(META_KEYS.localUpdatedAt) || 0) + 1
  wx.setStorageSync(META_KEYS.localUpdatedAt, revision)
}

function setStatus(status) {
  wx.setStorageSync(META_KEYS.status, status)
}

function getStatus() {
  const updatedAt = wx.getStorageSync(META_KEYS.updatedAt) || ''
  let updatedText = ''
  if (updatedAt) {
    const date = new Date(updatedAt)
    updatedText = `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }
  return {
    enabled: isEnabled(),
    status: wx.getStorageSync(META_KEYS.status) || '未开启',
    updatedAt,
    updatedText,
    version: Number(wx.getStorageSync(META_KEYS.version) || 0)
  }
}

function request(path, method, data) {
  return new Promise((resolve, reject) => {
    if (!wx.cloud || !wx.cloud.callContainer) {
      reject(new Error('当前微信版本不支持云托管'))
      return
    }
    wx.cloud.callContainer({
      config: { env: CONFIG.env },
      path,
      method,
      data,
      header: {
        'X-WX-SERVICE': CONFIG.service,
        'content-type': 'application/json'
      },
      success: result => {
        const body = result.data || {}
        if (result.statusCode >= 200 && result.statusCode < 300 && body.code === 0) {
          resolve(body.data)
          return
        }
        const error = new Error(body.message || `云服务请求失败（${result.statusCode}）`)
        error.statusCode = result.statusCode
        error.remoteData = body.data
        reject(error)
      },
      fail: error => reject(new Error(error.errMsg || '无法连接云服务'))
    })
  })
}

function getLocalPayload() {
  const defaults = {
    wedding: {},
    tasks: [],
    materials: [],
    budgets: [],
    guests: [],
    records: [],
    photo: '',
    photoOriginal: '',
    photoDisplay: { mode: 'aspectFill' }
  }
  const payload = Object.keys(SYNC_KEYS).reduce((result, key) => {
    result[key] = wx.getStorageSync(SYNC_KEYS[key]) || defaults[key]
    return result
  }, {})
  if (typeof payload.photo !== 'string' || payload.photo.indexOf('cloud://') !== 0) {
    payload.photo = ''
  }
  if (
    typeof payload.photoOriginal !== 'string' ||
    payload.photoOriginal.indexOf('cloud://') !== 0
  ) {
    payload.photoOriginal = ''
  }
  payload.materials = (Array.isArray(payload.materials) ? payload.materials : []).map(item => ({
    ...item,
    customImage: typeof item.customImage === 'string' && item.customImage.indexOf('cloud://') === 0
      ? item.customImage
      : ''
  }))
  payload.records = (Array.isArray(payload.records) ? payload.records : []).map(item => ({
    ...item,
    photos: (Array.isArray(item.photos) ? item.photos : []).filter(fileId => (
      typeof fileId === 'string' && fileId.indexOf('cloud://') === 0
    ))
  }))
  return payload
}

function applyRemote(remote) {
  if (!remote || !remote.payload) return false
  Object.keys(SYNC_KEYS).forEach(key => {
    if (remote.payload[key] !== undefined) {
      wx.setStorageSync(SYNC_KEYS[key], remote.payload[key])
    }
  })
  const storage = require('./storage')
  wx.setStorageSync(
    SYNC_KEYS.materials,
    storage.migrateMaterialSelection(wx.getStorageSync(SYNC_KEYS.materials))
  )
  wx.setStorageSync(
    SYNC_KEYS.budgets,
    storage.normalizeBudgets(wx.getStorageSync(SYNC_KEYS.budgets))
  )
  wx.setStorageSync(META_KEYS.version, remote.version || 0)
  wx.setStorageSync(META_KEYS.updatedAt, remote.updatedAt || new Date().toISOString())
  const marker = Number(wx.getStorageSync(META_KEYS.localUpdatedAt) || 0) + 1
  wx.setStorageSync(META_KEYS.localUpdatedAt, marker)
  wx.setStorageSync(META_KEYS.syncedLocalAt, marker)
  setStatus('已同步')
  return true
}

async function pull() {
  if (!isEnabled()) return null
  setStatus('同步中')
  try {
    const remote = await request('/api/sync', 'GET')
    if (remote) applyRemote(remote)
    else setStatus('等待首次同步')
    return remote
  } catch (error) {
    setStatus('同步失败')
    throw error
  }
}

async function performPush() {
  if (!isEnabled()) return null
  setStatus('同步中')
  try {
    const result = await request('/api/sync', 'PUT', {
      payload: getLocalPayload(),
      baseVersion: Number(wx.getStorageSync(META_KEYS.version) || 0)
    })
    wx.setStorageSync(META_KEYS.version, result.version)
    wx.setStorageSync(META_KEYS.updatedAt, result.updatedAt || new Date().toISOString())
    wx.setStorageSync(
      META_KEYS.syncedLocalAt,
      wx.getStorageSync(META_KEYS.localUpdatedAt) || 0
    )
    setStatus('已同步')
    return result
  } catch (error) {
    setStatus(error.statusCode === 409 ? '存在更新冲突' : '同步失败')
    throw error
  }
}

function push() {
  pushQueue = pushQueue.catch(() => null).then(() => performPush())
  return pushQueue
}

function schedulePush() {
  if (!isEnabled()) return
  setStatus('待同步')
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    push().catch(error => {
      if (error.statusCode === 409 && error.remoteData) promptConflict(error.remoteData)
    })
  }, 1200)
}

function promptConflict(remote) {
  if (conflictPrompting) return
  conflictPrompting = true
  wx.showModal({
    title: '发现新的云端修改',
    content: '另一位成员刚刚更新了数据。使用云端会覆盖本机未同步修改，保留本机会覆盖云端。',
    confirmText: '使用云端',
    cancelText: '保留本机',
    confirmColor: '#d96a63',
    success: result => {
      const strategy = result.confirm ? 'cloud' : 'local'
      resolveConflict(strategy, remote)
        .then(() => wx.showToast({
          title: strategy === 'cloud' ? '已使用云端数据' : '已保留本机数据',
          icon: 'success'
        }))
        .catch(error => wx.showToast({ title: error.message, icon: 'none' }))
        .finally(() => { conflictPrompting = false })
    },
    fail: () => { conflictPrompting = false }
  })
}

async function enable() {
  wx.setStorageSync(META_KEYS.enabled, true)
  setStatus('同步中')
  try {
    const remote = await request('/api/sync', 'GET')
    if (remote) {
      const localUpdatedAt = Number(wx.getStorageSync(META_KEYS.localUpdatedAt) || 0)
      const syncedLocalAt = Number(wx.getStorageSync(META_KEYS.syncedLocalAt) || 0)
      if (localUpdatedAt && localUpdatedAt !== syncedLocalAt) {
        const conflict = new Error('本机和云端都有修改，请选择保留哪一份')
        conflict.statusCode = 409
        conflict.remoteData = remote
        conflict.needsChoice = true
        throw conflict
      }
      applyRemote(remote)
      return { source: 'cloud', remote }
    }
    const profile = getLocalProfile()
    if (profile && profile.permissionRole === 'viewer') {
      setStatus('等待管理员同步')
      return { source: 'empty' }
    }
    await push()
    return { source: 'local' }
  } catch (error) {
    wx.removeStorageSync(META_KEYS.enabled)
    setStatus('开启失败')
    throw error
  }
}

function disable() {
  wx.removeStorageSync(META_KEYS.enabled)
  setStatus('未开启')
}

async function removeCloudData() {
  const currentProfile = getLocalProfile() || {}
  const storage = require('./storage')
  const currentPhoto = storage.get('photo')
  const currentOriginal = storage.get('photoOriginal')
  const currentMaterials = storage.get('materials')
  const currentRecords = storage.get('records')
  const currentAvatar = wx.getStorageSync('xiban_wechat_avatar') || currentProfile.avatarFileId || ''
  const result = await request('/api/sync', 'DELETE')
  const fileIds = (result && result.fileIds) || []
  disable()
  const referencedFileIds = [
    currentPhoto,
    currentOriginal,
    currentAvatar,
    ...currentMaterials.map(item => item.customImage),
    ...currentRecords.reduce((all, item) => all.concat(item.photos || []), [])
  ].filter(fileId => typeof fileId === 'string' && fileId.indexOf('cloud://') === 0)
  const localFileMap = {}
  const failedReferencedFiles = new Set()
  for (const fileId of [...new Set(referencedFileIds)]) {
    try {
      localFileMap[fileId] = await downloadCloudFile(fileId)
    } catch (error) {
      failedReferencedFiles.add(fileId)
    }
  }
  if (localFileMap[currentPhoto]) wx.setStorageSync(SYNC_KEYS.photo, localFileMap[currentPhoto])
  if (localFileMap[currentOriginal]) {
    wx.setStorageSync(SYNC_KEYS.photoOriginal, localFileMap[currentOriginal])
  }
  wx.setStorageSync(SYNC_KEYS.materials, currentMaterials.map(item => ({
    ...item,
    customImage: localFileMap[item.customImage] || item.customImage || ''
  })))
  wx.setStorageSync(SYNC_KEYS.records, currentRecords.map(item => ({
    ...item,
    photos: (item.photos || []).map(fileId => localFileMap[fileId] || fileId)
  })))
  if (localFileMap[currentAvatar]) {
    wx.setStorageSync('xiban_wechat_avatar', localFileMap[currentAvatar])
  } else if (!currentAvatar || !failedReferencedFiles.has(currentAvatar)) {
    wx.removeStorageSync('xiban_wechat_avatar')
  }
  let filesDeleted = true
  const deletableFileIds = fileIds.filter(fileId => !failedReferencedFiles.has(fileId))
  if (deletableFileIds.length && wx.cloud && wx.cloud.deleteFile) {
    try {
      await new Promise((resolve, reject) => {
        wx.cloud.deleteFile({ fileList: deletableFileIds, success: resolve, fail: reject })
      })
    } catch (error) {
      filesDeleted = false
    }
  }
  wx.removeStorageSync(META_KEYS.version)
  wx.removeStorageSync(META_KEYS.updatedAt)
  wx.removeStorageSync(META_KEYS.syncedLocalAt)
  wx.setStorageSync(META_KEYS.profile, {
    name: currentProfile.name || '',
    relation: currentProfile.relation || currentProfile.role || '',
    role: currentProfile.relation || currentProfile.role || '',
    permissionRole: 'owner',
    storageMode: 'local'
  })
  return { filesDeleted, filesKept: failedReferencedFiles.size }
}

function downloadCloudFile(fileId) {
  return new Promise((resolve, reject) => {
    if (!wx.cloud || !wx.cloud.downloadFile || !wx.getFileSystemManager) {
      reject(new Error('当前环境不支持保存云文件'))
      return
    }
    wx.cloud.downloadFile({
      fileID: fileId,
      success: result => {
        wx.getFileSystemManager().saveFile({
          tempFilePath: result.tempFilePath,
          success: saved => resolve(saved.savedFilePath),
          fail: reject
        })
      },
      fail: reject
    })
  })
}

async function syncNow() {
  const profile = getLocalProfile()
  if (profile && profile.permissionRole === 'viewer') return pull()
  return push()
}

async function resolveConflict(strategy, remote) {
  if (!remote) throw new Error('缺少云端冲突数据')
  wx.setStorageSync(META_KEYS.enabled, true)
  if (strategy === 'cloud') {
    applyRemote(remote)
    return { source: 'cloud' }
  }
  wx.setStorageSync(META_KEYS.version, remote.version || 0)
  await push()
  return { source: 'local' }
}

module.exports = {
  CONFIG,
  isEnabled,
  markLocalChanged,
  getLocalProfile,
  fetchProfile,
  refreshSession,
  createWedding,
  upgradeLocalWedding,
  previewInvite,
  joinWedding,
  fetchMembers,
  updateMyAvatar,
  createInvite,
  updateMember,
  removeMember,
  getStatus,
  enable,
  disable,
  pull,
  push,
  schedulePush,
  syncNow,
  resolveConflict,
  removeCloudData
}
