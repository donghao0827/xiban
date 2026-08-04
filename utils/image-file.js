const ALLOWED_TYPES = ['jpg', 'png', 'webp']

function normalizeType(value) {
  const type = String(value || '').toLowerCase().replace(/^image\//, '')
  return type === 'jpeg' ? 'jpg' : type
}

function getFileSize(filePath, knownSize) {
  if (Number(knownSize) > 0) return Promise.resolve(Number(knownSize))
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().getFileInfo({
      filePath,
      success: result => resolve(Number(result.size || 0)),
      fail: reject
    })
  })
}

function getImageType(filePath) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: filePath,
      success: result => resolve(normalizeType(result.type)),
      fail: reject
    })
  })
}

async function validate(filePath, options = {}) {
  const label = options.label || '图片'
  const maxBytes = Number(options.maxBytes || 0)
  let type = ''
  let size = 0
  try {
    ;[type, size] = await Promise.all([
      getImageType(filePath),
      getFileSize(filePath, options.knownSize)
    ])
  } catch (error) {
    throw new Error(`无法读取${label}，请重新选择`)
  }
  if (!ALLOWED_TYPES.includes(type)) {
    throw new Error(`${label}仅支持 JPG、PNG 或 WEBP 格式`)
  }
  if (!size) throw new Error(`无法读取${label}大小，请重新选择`)
  if (maxBytes && size > maxBytes) {
    const maxMB = Math.round(maxBytes / 1024 / 1024)
    throw new Error(`${label}不能超过 ${maxMB}MB`)
  }
  return { type, extension: type, size }
}

module.exports = {
  validate,
  limits: {
    avatar: 5 * 1024 * 1024,
    weddingOriginal: 20 * 1024 * 1024,
    weddingDisplay: 2 * 1024 * 1024,
    material: 5 * 1024 * 1024
  }
}
