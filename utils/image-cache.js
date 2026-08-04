const INDEX_KEY = 'xiban_cloud_image_cache_v1'
const MAX_BYTES = 40 * 1024 * 1024
const MAX_AGE = 30 * 24 * 60 * 60 * 1000

const pending = Object.create(null)
let mutationQueue = Promise.resolve()

function enqueue(task) {
  const result = mutationQueue.then(task, task)
  mutationQueue = result.catch(() => {})
  return result
}

function isCloudFile(source) {
  return typeof source === 'string' && source.indexOf('cloud://') === 0
}

function readIndex() {
  const value = wx.getStorageSync(INDEX_KEY)
  return value && typeof value === 'object' ? value : {}
}

function writeIndex(index) {
  wx.setStorageSync(INDEX_KEY, index)
}

function peek(source) {
  if (!isCloudFile(source)) return source || ''
  const cached = readIndex()[source]
  return cached && cached.path ? cached.path : ''
}

function access(path) {
  return new Promise(resolve => {
    if (!path || !wx.getFileSystemManager) return resolve(false)
    wx.getFileSystemManager().access({ path, success: () => resolve(true), fail: () => resolve(false) })
  })
}

function fileSize(path) {
  return new Promise(resolve => {
    wx.getFileSystemManager().getFileInfo({
      filePath: path,
      success: result => resolve(Number(result.size || 0)),
      fail: () => resolve(0)
    })
  })
}

function remove(path) {
  return new Promise(resolve => {
    if (!path) return resolve()
    wx.getFileSystemManager().removeSavedFile({ filePath: path, complete: resolve })
  })
}

async function prune(index, bytesNeeded = 0) {
  const now = Date.now()
  const entries = Object.keys(index).map(key => ({ key, ...index[key] }))
  let total = entries.reduce((sum, item) => sum + Number(item.size || 0), 0)
  const ordered = entries.sort((a, b) => Number(a.at || 0) - Number(b.at || 0))
  for (const item of ordered) {
    const expired = now - Number(item.at || 0) > MAX_AGE
    if (!expired && total + bytesNeeded <= MAX_BYTES) break
    await remove(item.path)
    total -= Number(item.size || 0)
    delete index[item.key]
  }
  writeIndex(index)
}

function download(source) {
  return new Promise((resolve, reject) => {
    if (!wx.cloud || !wx.cloud.downloadFile) return reject(new Error('当前环境不支持云图片缓存'))
    wx.cloud.downloadFile({ fileID: source, success: resolve, fail: reject })
  })
}

function save(tempFilePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().saveFile({ tempFilePath, success: resolve, fail: reject })
  })
}

async function resolve(source) {
  if (!isCloudFile(source)) return source || ''
  if (pending[source]) return pending[source]
  pending[source] = enqueue(async () => {
    const index = readIndex()
    const cached = index[source]
    if (cached && Date.now() - Number(cached.at || 0) <= MAX_AGE && await access(cached.path)) {
      cached.at = Date.now()
      writeIndex(index)
      return cached.path
    }
    if (cached) {
      await remove(cached.path)
      delete index[source]
      writeIndex(index)
    }
    try {
      const downloaded = await download(source)
      const size = await fileSize(downloaded.tempFilePath)
      await prune(index, size)
      const saved = await save(downloaded.tempFilePath)
      index[source] = { path: saved.savedFilePath, size, at: Date.now() }
      writeIndex(index)
      return saved.savedFilePath
    } catch (error) {
      return source
    }
  })
  try {
    return await pending[source]
  } finally {
    delete pending[source]
  }
}

async function resolveMany(sources) {
  const unique = [...new Set((sources || []).filter(isCloudFile))]
  const values = await Promise.all(unique.map(resolve))
  return unique.reduce((result, source, index) => {
    result[source] = values[index]
    return result
  }, {})
}

async function invalidate(source) {
  if (!isCloudFile(source)) return
  await enqueue(async () => {
    const index = readIndex()
    if (!index[source]) return
    await remove(index[source].path)
    delete index[source]
    writeIndex(index)
  })
}

module.exports = { isCloudFile, peek, resolve, resolveMany, invalidate }
