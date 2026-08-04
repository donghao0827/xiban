const storage = require('../../utils/storage')
const cloud = require('../../utils/cloud')
const taskPlan = require('../../utils/task-plan')
const imageFile = require('../../utils/image-file')
const CLOUD_CUSTOM_IMAGE_LIMIT = 20

Page({
  data: {
    wedding: {},
    weddingPhoto: '',
    weddingPhotoOriginal: '',
    wechatAvatar: '',
    photoDisplay: { mode: 'aspectFill' },
    cloudStatus: {
      enabled: false,
      status: '未开启',
      updatedAt: ''
    },
    userProfile: null,
    showLocationSheet: false,
    locationForm: { city: '', venue: '' }
  },

  onShow() {
    const wedding = storage.get('wedding')
    const profile = cloud.getLocalProfile()
    this.setData({
      wedding,
      weddingPhoto: storage.get('photo'),
      weddingPhotoOriginal: storage.get('photoOriginal'),
      wechatAvatar: (profile && profile.avatarFileId) || wx.getStorageSync('xiban_wechat_avatar') || '',
      photoDisplay: storage.get('photoDisplay'),
      locationForm: { city: wedding.city || '', venue: wedding.venue || '' },
      cloudStatus: cloud.getStatus(),
      userProfile: profile
    })
    if (cloud.isEnabled()) {
      this.migratePendingAssetsToCloud().catch(() => {
        wx.showToast({ title: '部分本地图片暂未上传', icon: 'none' })
      })
    }
    const ready = getApp().globalData.cloudReady
    if (ready) {
      ready.then(() => {
        const latestWedding = storage.get('wedding')
        const latestProfile = cloud.getLocalProfile()
        this.setData({
          wedding: latestWedding,
          weddingPhoto: storage.get('photo'),
          weddingPhotoOriginal: storage.get('photoOriginal'),
          locationForm: {
            city: latestWedding.city || '',
            venue: latestWedding.venue || ''
          },
          cloudStatus: cloud.getStatus(),
          userProfile: latestProfile,
          wechatAvatar: (latestProfile && latestProfile.avatarFileId) || wx.getStorageSync('xiban_wechat_avatar') || ''
        })
        if (cloud.isEnabled()) this.migratePendingAssetsToCloud().catch(() => {})
      })
    }
  },

  openPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' })
  },

  changeWeddingDate(event) {
    const selectedDate = event.detail.value
    if (!selectedDate || selectedDate === this.data.wedding.date) return
    const tasks = storage.get('tasks')
    const replannedTasks = taskPlan.replanTasks(tasks, selectedDate)
    const changedCount = replannedTasks.filter((item, index) => item.dueDate !== tasks[index].dueDate).length
    const applyChange = () => {
      const plan = this.data.wedding.plan
        ? { ...this.data.wedding.plan, lastScheduledWeddingDate: selectedDate }
        : this.data.wedding.plan
      const wedding = { ...this.data.wedding, date: selectedDate, ...(plan ? { plan } : {}) }
      if (!storage.setMany({ wedding, tasks: replannedTasks })) return
      this.setData({ wedding })
      wx.showToast({
        title: changedCount ? `已调整 ${changedCount} 项任务` : '婚礼日期已更新',
        icon: 'success'
      })
    }
    if (!changedCount) {
      applyChange()
      return
    }
    wx.showModal({
      title: '同步调整筹备计划？',
      content: `婚期修改后，将重新安排 ${changedCount} 项未完成任务。已完成、自建及手动修改日期的任务不会变化。`,
      confirmText: '调整计划',
      cancelText: '仅改婚期',
      confirmColor: '#FF6688',
      success: result => {
        if (result.confirm) {
          applyChange()
          return
        }
        const wedding = { ...this.data.wedding, date: selectedDate }
        if (!storage.set('wedding', wedding)) return
        this.setData({ wedding })
        wx.showToast({ title: '婚礼日期已更新', icon: 'success' })
      }
    })
  },

  openLocationSheet() {
    this.setData({
      showLocationSheet: true,
      locationForm: {
        city: this.data.wedding.city || '',
        venue: this.data.wedding.venue || ''
      }
    })
  },

  openPlanSettings() {
    wx.navigateTo({ url: '/pages/plan-setup/plan-setup?edit=1' })
  },

  exportLocalBackup() {
    const backup = storage.createBackup()
    const fileName = `囍伴备份-${new Date().toISOString().slice(0, 10)}.json`
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`
    wx.showLoading({ title: '正在生成备份' })
    wx.getFileSystemManager().writeFile({
      filePath,
      data: JSON.stringify(backup, null, 2),
      encoding: 'utf8',
      success: () => {
        wx.hideLoading()
        if (!wx.shareFileMessage) {
          wx.showToast({ title: '当前微信版本不支持分享文件', icon: 'none' })
          return
        }
        wx.shareFileMessage({
          filePath,
          fileName,
          fail: error => {
            if (!String(error.errMsg || '').includes('cancel')) {
              wx.showToast({ title: '备份分享失败', icon: 'none' })
            }
          }
        })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '备份文件生成失败', icon: 'none' })
      }
    })
  },

  importLocalBackup() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: result => {
        const selected = result.tempFiles && result.tempFiles[0]
        if (!selected) return
        wx.getFileSystemManager().readFile({
          filePath: selected.path,
          encoding: 'utf8',
          success: file => {
            try {
              const backup = JSON.parse(file.data)
              const data = backup.data || {}
              const summary = `任务 ${Array.isArray(data.tasks) ? data.tasks.length : 0} 项、婚品 ${Array.isArray(data.materials) ? data.materials.length : 0} 项、宾客 ${Array.isArray(data.guests) ? data.guests.length : 0} 组。结婚照和自定义图片不会被覆盖。`
              wx.showModal({
                title: '导入这份本地备份？',
                content: `${summary}\n导入后将覆盖当前的文字和清单数据。`,
                confirmText: '确认导入',
                confirmColor: '#FF6688',
                success: modal => {
                  if (!modal.confirm) return
                  try {
                    storage.importBackup(backup)
                    this.onShow()
                    wx.showToast({ title: '备份已导入', icon: 'success' })
                  } catch (error) {
                    wx.showToast({ title: error.message, icon: 'none', duration: 3000 })
                  }
                }
              })
            } catch (error) {
              wx.showToast({ title: '备份文件无法读取', icon: 'none' })
            }
          },
          fail: () => wx.showToast({ title: '备份文件读取失败', icon: 'none' })
        })
      }
    })
  },
  closeLocationSheet() { this.setData({ showLocationSheet: false }) },
  updateLocationField(event) {
    this.setData({
      [`locationForm.${event.currentTarget.dataset.field}`]: event.detail.value
    })
  },

  saveWeddingLocation() {
    const locationForm = this.data.locationForm
    const wedding = {
      ...this.data.wedding,
      city: locationForm.city.trim(),
      venue: locationForm.venue.trim()
    }
    if (!storage.set('wedding', wedding)) return
    this.setData({ wedding, showLocationSheet: false })
    wx.showToast({ title: '婚礼地点已更新', icon: 'success' })
  },

  showAbout() {
    wx.showModal({
      title: '关于囍伴',
      content: '囍伴采用本地优先模式。开启云同步后，婚礼信息、任务、婚品、预算、宾客数据和结婚照会上传云端，用于共同筹备和跨设备使用。',
      showCancel: false,
      confirmColor: '#b95c57'
    })
  },

  copyWeddingId() {
    const profile = this.data.userProfile
    if (!profile) return
    wx.setClipboardData({
      data: profile.weddingId,
      success: () => wx.showToast({ title: '婚礼 ID 已复制', icon: 'success' })
    })
  },

  openMembers() {
    wx.navigateTo({ url: '/pages/members/members' })
  },

  async chooseWechatAvatar(event) {
    const tempFilePath = event.detail && event.detail.avatarUrl
    if (!tempFilePath) return
    let fileMeta
    try {
      fileMeta = await imageFile.validate(tempFilePath, {
        label: '头像',
        maxBytes: imageFile.limits.avatar
      })
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none', duration: 3000 })
      return
    }
    const profile = cloud.getLocalProfile()
    if (profile && profile.weddingId && cloud.isEnabled() && wx.cloud && wx.cloud.uploadFile) {
      wx.showLoading({ title: '正在保存头像' })
      let uploadedFileID = ''
      try {
        const ready = getApp().globalData.cloudReady
        if (ready) await ready
        const extension = fileMeta.extension
        const cloudPath = `weddings/${profile.weddingId}/avatars/member_${profile.id}_${Date.now()}.${extension}`
        const uploaded = await new Promise((resolve, reject) => {
          wx.cloud.uploadFile({
            cloudPath,
            filePath: tempFilePath,
            success: resolve,
            fail: reject
          })
        })
        uploadedFileID = uploaded.fileID
        const oldAvatar = this.data.wechatAvatar
        const latestProfile = await cloud.updateMyAvatar(uploadedFileID)
        wx.setStorageSync('xiban_wechat_avatar', uploadedFileID)
        this.setData({ wechatAvatar: uploadedFileID, userProfile: latestProfile })
        this.removeOldAvatar(oldAvatar, uploadedFileID)
        wx.hideLoading()
        wx.showToast({ title: '头像已同步', icon: 'success' })
        return
      } catch (error) {
        wx.hideLoading()
        if (uploadedFileID && wx.cloud.deleteFile) {
          wx.cloud.deleteFile({ fileList: [uploadedFileID], fail: () => {} })
        }
        this.saveAvatarLocally(tempFilePath, '云端保存失败，已保存在本机')
        return
      }
    }
    this.saveAvatarLocally(tempFilePath)
  },

  saveAvatarLocally(tempFilePath, message = '微信头像已更新') {
    wx.getFileSystemManager().saveFile({
      tempFilePath,
      success: result => {
        const oldAvatar = this.data.wechatAvatar || wx.getStorageSync('xiban_wechat_avatar')
        wx.setStorageSync('xiban_wechat_avatar', result.savedFilePath)
        this.setData({ wechatAvatar: result.savedFilePath })
        this.removeOldAvatar(oldAvatar, result.savedFilePath)
        wx.showToast({ title: message, icon: message.length > 8 ? 'none' : 'success' })
      },
      fail: () => wx.showToast({ title: '头像保存失败，请重试', icon: 'none' })
    })
  },

  removeOldAvatar(oldAvatar, currentAvatar) {
    if (!oldAvatar || oldAvatar === currentAvatar) return
    if (this.isCloudPhoto(oldAvatar) && wx.cloud && wx.cloud.deleteFile) {
      wx.cloud.deleteFile({ fileList: [oldAvatar], fail: () => {} })
      return
    }
    wx.getFileSystemManager().removeSavedFile({ filePath: oldAvatar, fail: () => {} })
  },

  choosePhoto() {
    const profile = cloud.getLocalProfile()
    if (profile && profile.permissionRole === 'viewer') {
      wx.showToast({ title: '你当前是只读成员', icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['original'],
      success: async result => {
        const tempFilePath = result.tempFiles[0].tempFilePath
        try {
          await imageFile.validate(tempFilePath, {
            label: '结婚照原图',
            maxBytes: imageFile.limits.weddingOriginal,
            knownSize: result.tempFiles[0].size
          })
        } catch (error) {
          wx.showToast({ title: error.message, icon: 'none', duration: 3000 })
          return
        }
        this.cropAndSavePhoto(tempFilePath, true)
      }
    })
  },

  adjustPhoto() {
    const profile = cloud.getLocalProfile()
    if (profile && profile.permissionRole === 'viewer') {
      wx.showToast({ title: '你当前是只读成员', icon: 'none' })
      return
    }
    const originalPhoto = this.data.weddingPhotoOriginal || this.data.weddingPhoto
    if (!originalPhoto) return
    if (this.isCloudPhoto(originalPhoto)) {
      wx.showLoading({ title: '正在读取照片' })
      wx.cloud.downloadFile({
        fileID: originalPhoto,
        success: result => {
          wx.hideLoading()
          this.cropAndSavePhoto(result.tempFilePath, false)
        },
        fail: () => {
          wx.hideLoading()
          wx.showToast({ title: '照片读取失败，请重试', icon: 'none' })
        }
      })
      return
    }
    this.cropAndSavePhoto(originalPhoto, false)
  },

  isCloudPhoto(filePath) {
    return typeof filePath === 'string' && filePath.indexOf('cloud://') === 0
  },

  cropAndSavePhoto(sourcePath, replaceOriginal) {
    wx.navigateTo({
      url: '/pages/photo-cropper/photo-cropper',
      success: result => {
        result.eventChannel.emit('source', { path: sourcePath })
        result.eventChannel.on('cropped', ({ path }) => {
          this.savePhotoPair(sourcePath, path, replaceOriginal)
        })
      }
    })
  },

  async savePhotoPair(originalPath, croppedPath, replaceOriginal) {
    try {
      await imageFile.validate(croppedPath, {
        label: '结婚照展示图',
        maxBytes: imageFile.limits.weddingDisplay
      })
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none', duration: 3000 })
      return
    }
    const profile = cloud.getLocalProfile()
    if (cloud.isEnabled() && profile && wx.cloud && wx.cloud.uploadFile) {
      this.uploadPhotoPairToCloud(originalPath, croppedPath, profile, { replaceOriginal }).catch(() => {})
      return
    }
    this.savePhotoPairLocally(originalPath, croppedPath, replaceOriginal)
  },

  async uploadFileToCloud(filePath, profile, type) {
    const isOriginal = type === 'original'
    const fileMeta = await imageFile.validate(filePath, {
      label: isOriginal ? '结婚照原图' : '结婚照展示图',
      maxBytes: isOriginal ? imageFile.limits.weddingOriginal : imageFile.limits.weddingDisplay
    })
    const extension = fileMeta.extension
    const cloudPath = `weddings/${profile.weddingId}/photos/${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath,
        filePath,
        success: result => resolve(result.fileID),
        fail: reject
      })
    })
  },

  async uploadPhotoPairToCloud(originalPath, croppedPath, profile, options = {}) {
    if (!options.silent) wx.showLoading({ title: '正在上传照片' })
    const oldOriginal = storage.get('photoOriginal')
    const oldDisplay = storage.get('photo')
    const uploaded = []
    let localCommitted = false
    try {
      let originalFileID = oldOriginal
      if (options.replaceOriginal || !oldOriginal) {
        originalFileID = this.isCloudPhoto(originalPath)
          ? originalPath
          : await this.uploadFileToCloud(originalPath, profile, 'original')
        if (originalFileID !== originalPath) uploaded.push(originalFileID)
      }
      const displayFileID = this.isCloudPhoto(croppedPath)
        ? croppedPath
        : await this.uploadFileToCloud(croppedPath, profile, 'display')
      if (displayFileID !== croppedPath) uploaded.push(displayFileID)
      if (!storage.set('photoOriginal', originalFileID) || !storage.set('photo', displayFileID)) {
        throw new Error('当前成员没有修改权限')
      }
      const photoDisplay = { mode: 'aspectFill' }
      if (!storage.set('photoDisplay', photoDisplay)) {
        throw new Error('当前成员没有修改权限')
      }
      localCommitted = true
      this.setData({
        weddingPhotoOriginal: originalFileID,
        weddingPhoto: displayFileID,
        photoDisplay
      })
      await cloud.push()
      this.removeOldPhotos([
        oldDisplay !== displayFileID ? oldDisplay : '',
        options.replaceOriginal && oldOriginal !== originalFileID ? oldOriginal : ''
      ])
      if (!options.silent) wx.showToast({ title: '原图和展示图已保存', icon: 'success' })
      return { originalFileID, displayFileID }
    } catch (error) {
      if (!localCommitted && uploaded.length) {
        wx.cloud.deleteFile({ fileList: uploaded, fail: () => {} })
      }
      if (!options.silent) {
        wx.showToast({
          title: localCommitted ? '照片已保存，云端同步待处理' : '照片上传失败，请检查网络',
          icon: 'none'
        })
      }
      throw error
    } finally {
      if (!options.silent) wx.hideLoading()
    }
  },

  saveFileLocally(tempFilePath) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().saveFile({
        tempFilePath,
        success: result => resolve(result.savedFilePath),
        fail: reject
      })
    })
  },

  async savePhotoPairLocally(originalPath, croppedPath, replaceOriginal) {
    wx.showLoading({ title: '正在保存照片' })
    const oldOriginal = storage.get('photoOriginal')
    const oldDisplay = storage.get('photo')
    const savedPaths = []
    try {
      let savedOriginal = oldOriginal
      if (replaceOriginal || !oldOriginal) {
        savedOriginal = await this.saveFileLocally(originalPath)
        savedPaths.push(savedOriginal)
      }
      const savedDisplay = await this.saveFileLocally(croppedPath)
      savedPaths.push(savedDisplay)
      if (!storage.set('photoOriginal', savedOriginal) || !storage.set('photo', savedDisplay)) return
      const photoDisplay = { mode: 'aspectFill' }
      storage.set('photoDisplay', photoDisplay)
      this.setData({
        weddingPhotoOriginal: savedOriginal,
        weddingPhoto: savedDisplay,
        photoDisplay
      })
      this.removeOldPhotos([
        oldDisplay !== savedDisplay ? oldDisplay : '',
        replaceOriginal && oldOriginal !== savedOriginal ? oldOriginal : ''
      ])
      wx.showToast({ title: '原图和展示图已保存', icon: 'success' })
    } catch (error) {
      this.removeOldPhotos(savedPaths)
      wx.showToast({ title: '照片保存失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  removeOldPhotos(paths) {
    const uniquePaths = [...new Set(paths.filter(Boolean))]
    const cloudPaths = uniquePaths.filter(path => this.isCloudPhoto(path))
    if (cloudPaths.length && wx.cloud) {
      wx.cloud.deleteFile({ fileList: cloudPaths, fail: () => {} })
    }
    uniquePaths
      .filter(path => !this.isCloudPhoto(path))
      .forEach(filePath => {
        wx.getFileSystemManager().removeSavedFile({ filePath, fail: () => {} })
      })
  },

  async migrateLocalPhotoToCloud() {
    if (this.photoMigrationPromise) return this.photoMigrationPromise
    const photo = storage.get('photo')
    const photoOriginal = storage.get('photoOriginal') || photo
    const profile = cloud.getLocalProfile()
    if (!photo || !profile) return
    if (this.isCloudPhoto(photo) && this.isCloudPhoto(photoOriginal)) return
    this.photoMigrationPromise = this.uploadPhotoPairToCloud(
      photoOriginal,
      photo,
      profile,
      { silent: true, replaceOriginal: !this.isCloudPhoto(photoOriginal) }
    )
    try {
      await this.photoMigrationPromise
    } finally {
      this.photoMigrationPromise = null
    }
  },

  uploadLocalAsset(filePath, cloudPath) {
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath,
        filePath,
        success: result => resolve(result.fileID),
        fail: reject
      })
    })
  },

  async migrateLocalAvatarToCloud() {
    const profile = cloud.getLocalProfile()
    const localAvatar = wx.getStorageSync('xiban_wechat_avatar') || ''
    if (!profile || !profile.weddingId || !localAvatar || this.isCloudPhoto(localAvatar)) return false
    const fileMeta = await imageFile.validate(localAvatar, {
      label: '头像',
      maxBytes: imageFile.limits.avatar
    })
    const fileID = await this.uploadLocalAsset(
      localAvatar,
      `weddings/${profile.weddingId}/avatars/member_${profile.id}_${Date.now()}.${fileMeta.extension}`
    )
    try {
      const latestProfile = await cloud.updateMyAvatar(fileID)
      wx.setStorageSync('xiban_wechat_avatar', fileID)
      this.setData({ userProfile: latestProfile, wechatAvatar: fileID })
      wx.getFileSystemManager().removeSavedFile({ filePath: localAvatar, fail: () => {} })
      return true
    } catch (error) {
      wx.cloud.deleteFile({ fileList: [fileID], fail: () => {} })
      throw error
    }
  },

  async migrateLocalMaterialImagesToCloud() {
    const profile = cloud.getLocalProfile()
    if (!profile || !profile.weddingId) return { migrated: 0, failed: 0 }
    const materials = storage.get('materials')
    const cloudImageCount = materials.filter(item => (
      item.customImage && this.isCloudPhoto(item.customImage)
    )).length
    const availableSlots = Math.max(0, CLOUD_CUSTOM_IMAGE_LIMIT - cloudImageCount)
    const pendingItems = materials.filter(item => (
      item.customImage && !this.isCloudPhoto(item.customImage)
    ))
    const localItems = pendingItems.slice(0, availableSlots)
    if (!localItems.length) return { migrated: 0, failed: pendingItems.length }
    const uploaded = new Map()
    let failed = pendingItems.length - localItems.length
    for (const item of localItems) {
      try {
        const fileMeta = await imageFile.validate(item.customImage, {
          label: '婚品图片',
          maxBytes: imageFile.limits.material
        })
        const fileID = await this.uploadLocalAsset(
          item.customImage,
          `weddings/${profile.weddingId}/materials/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileMeta.extension}`
        )
        uploaded.set(item.id, { fileID, localPath: item.customImage })
      } catch (error) {
        failed += 1
      }
    }
    if (!uploaded.size) return { migrated: 0, failed }
    const nextMaterials = materials.map(item => (
      uploaded.has(item.id)
        ? { ...item, customImage: uploaded.get(item.id).fileID }
        : item
    ))
    if (!storage.set('materials', nextMaterials)) return { migrated: 0, failed: failed + uploaded.size }
    try {
      await cloud.push()
      uploaded.forEach(({ localPath }) => {
        wx.getFileSystemManager().removeSavedFile({ filePath: localPath, fail: () => {} })
      })
      return { migrated: uploaded.size, failed }
    } catch (error) {
      return { migrated: uploaded.size, failed: failed + uploaded.size }
    }
  },

  async migratePendingAssetsToCloud() {
    if (this.assetMigrationPromise) return this.assetMigrationPromise
    this.assetMigrationPromise = (async () => {
      const results = { pending: 0 }
      try { await this.migrateLocalAvatarToCloud() } catch (error) { results.pending += 1 }
      try { await this.migrateLocalPhotoToCloud() } catch (error) { results.pending += 1 }
      const materials = await this.migrateLocalMaterialImagesToCloud()
      results.pending += materials.failed
      return results
    })()
    try {
      return await this.assetMigrationPromise
    } finally {
      this.assetMigrationPromise = null
    }
  },

  previewPhoto() {
    if (!this.data.weddingPhoto) return
    wx.previewImage({ current: this.data.weddingPhoto, urls: [this.data.weddingPhoto] })
  },

  handleCloudAction() {
    if (this.data.cloudStatus.enabled) {
      this.syncNow()
      return
    }
    this.enableCloudSync()
  },

  enableCloudSync() {
    const profile = cloud.getLocalProfile()
    if (profile && profile.storageMode === 'local') {
      wx.showModal({
        title: '开通免费云端体验',
        content: '体验版最多支持 5 名成员和 20 张自定义婚品图片。开通后，婚礼信息、任务、婚品、预算、宾客、头像和结婚照将上传到云端，同一婚礼成员可按权限访问。本地数据会继续保留。',
        confirmText: '同意并体验',
        confirmColor: '#d96a63',
        success: result => {
          if (result.confirm) this.upgradeLocalWeddingToCloud()
        }
      })
      return
    }
    wx.showModal({
      title: '开启云同步',
      content: '开启后，婚礼信息、任务、婚品、预算、宾客数据和结婚照将上传至云端，用于备份、共同筹备和跨设备使用；同一婚礼成员可按权限访问。',
      confirmText: '同意并开启',
      confirmColor: '#d96a63',
      success: async result => {
        if (!result.confirm) return
        wx.showLoading({ title: '正在开启' })
        try {
          const syncResult = await cloud.enable()
          await this.migrateLocalPhotoToCloud()
          this.setData({ cloudStatus: cloud.getStatus() })
          wx.hideLoading()
          wx.showToast({
            title: syncResult.source === 'cloud' ? '已恢复云端数据' : '已备份到云端',
            icon: 'success'
          })
          if (syncResult.source === 'cloud') this.onShow()
        } catch (error) {
          wx.hideLoading()
          this.setData({ cloudStatus: cloud.getStatus() })
          if (error.statusCode === 409 && error.remoteData) {
            this.resolveSyncConflict(error)
          } else {
            wx.showToast({ title: error.message, icon: 'none', duration: 3000 })
          }
        }
      }
    })
  },

  async upgradeLocalWeddingToCloud() {
    const localProfile = cloud.getLocalProfile()
    const wedding = storage.get('wedding')
    if (!localProfile || !wedding.date) {
      wx.showToast({ title: '请先完善婚礼日期', icon: 'none' })
      return
    }
    wx.showLoading({ title: '正在创建云端空间', mask: true })
    try {
      const created = await cloud.upgradeLocalWedding({
        name: localProfile.name,
        relation: localProfile.relation || localProfile.role,
        date: wedding.date,
        city: wedding.city || '',
        venue: wedding.venue || ''
      })
      await cloud.enable()
      let pendingAssets = 0
      try { await this.migrateLocalAvatarToCloud() } catch (error) { pendingAssets += 1 }
      try { await this.migrateLocalPhotoToCloud() } catch (error) { pendingAssets += 1 }
      const materialResult = await this.migrateLocalMaterialImagesToCloud()
      pendingAssets += materialResult.failed
      await cloud.push()
      const latestProfile = cloud.getLocalProfile() || created.profile
      getApp().globalData.cloudReady = Promise.resolve(latestProfile)
      wx.hideLoading()
      this.setData({
        userProfile: latestProfile,
        cloudStatus: cloud.getStatus(),
        weddingPhoto: storage.get('photo'),
        weddingPhotoOriginal: storage.get('photoOriginal'),
        wechatAvatar: latestProfile.avatarFileId || wx.getStorageSync('xiban_wechat_avatar') || ''
      })
      wx.showToast({
        title: pendingAssets ? '体验已开通，部分图片待上传' : '云端体验已开通',
        icon: pendingAssets ? 'none' : 'success',
        duration: 3000
      })
    } catch (error) {
      wx.hideLoading()
      this.setData({ userProfile: cloud.getLocalProfile(), cloudStatus: cloud.getStatus() })
      wx.showToast({ title: error.message || '开通失败，本地数据已保留', icon: 'none', duration: 3500 })
    }
  },

  syncNow() {
    wx.showLoading({ title: '正在同步' })
    this.migratePendingAssetsToCloud().then(() => cloud.syncNow()).then(result => {
      wx.hideLoading()
      this.setData({ cloudStatus: cloud.getStatus() })
      if (result && result.pulledConflict) this.onShow()
      wx.showToast({
        title: result && result.pulledConflict ? '已获取云端更新' : '同步完成',
        icon: 'success'
      })
    }).catch(error => {
      wx.hideLoading()
      this.setData({ cloudStatus: cloud.getStatus() })
      if (error.statusCode === 409 && error.remoteData) {
        this.resolveSyncConflict(error)
      } else {
        wx.showToast({ title: error.message, icon: 'none', duration: 3000 })
      }
    })
  },

  resolveSyncConflict(error) {
    wx.showModal({
      title: '发现两份不同的数据',
      content: '云端和本机都有修改。选择“使用云端”会覆盖本机；选择“保留本机”会覆盖云端。',
      confirmText: '使用云端',
      cancelText: '保留本机',
      confirmColor: '#d96a63',
      success: async result => {
        const strategy = result.confirm ? 'cloud' : 'local'
        wx.showLoading({ title: '正在处理' })
        try {
          await cloud.resolveConflict(strategy, error.remoteData)
          wx.hideLoading()
          this.onShow()
          wx.showToast({ title: strategy === 'cloud' ? '已使用云端数据' : '已保留本机数据', icon: 'success' })
        } catch (resolveError) {
          wx.hideLoading()
          wx.showToast({ title: resolveError.message, icon: 'none', duration: 3000 })
        }
      }
    })
  },

  disableCloudSync() {
    wx.showModal({
      title: '关闭云同步',
      content: '关闭后仍会保留本机和云端已有数据，但新的修改不再自动上传。',
      confirmText: '关闭同步',
      confirmColor: '#d96a63',
      success: result => {
        if (!result.confirm) return
        cloud.disable()
        this.setData({ cloudStatus: cloud.getStatus() })
      }
    })
  },

  removeCloudData() {
    wx.showModal({
      title: '删除云端婚礼空间',
      content: '婚礼信息、成员、邀请和云端文件将永久删除。照片会先尝试保存到本机；如仍有其他成员，需要先移除成员。',
      confirmText: '永久删除',
      confirmColor: '#c94743',
      success: async result => {
        if (!result.confirm) return
        wx.showLoading({ title: '正在删除' })
        try {
          const deleteResult = await cloud.removeCloudData()
          wx.hideLoading()
          this.setData({
            cloudStatus: cloud.getStatus(),
            userProfile: cloud.getLocalProfile(),
            weddingPhoto: storage.get('photo'),
            weddingPhotoOriginal: storage.get('photoOriginal'),
            wechatAvatar: wx.getStorageSync('xiban_wechat_avatar') || ''
          })
          const fullyCleaned = deleteResult.filesDeleted && !deleteResult.filesKept
          wx.showToast({
            title: fullyCleaned ? '云端婚礼空间已删除' : '数据已删除，部分文件待清理',
            icon: fullyCleaned ? 'success' : 'none',
            duration: 3000
          })
        } catch (error) {
          wx.hideLoading()
          wx.showToast({ title: error.message, icon: 'none', duration: 3000 })
        }
      }
    })
  }
})
