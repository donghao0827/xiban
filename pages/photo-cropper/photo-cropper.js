Page({
  data: {
    sourcePath: '',
    statusBarHeight: 20,
    navHeight: 64,
    viewportWidth: 320,
    viewportHeight: 240,
    imageWidth: 0,
    imageHeight: 0,
    displayWidth: 320,
    displayHeight: 240,
    photoX: 0,
    photoY: 0,
    photoScale: 1,
    minScale: 1,
    maxScale: 4
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const menu = wx.getMenuButtonBoundingClientRect()
    const viewportWidth = windowInfo.windowWidth - 32
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight || 20,
      navHeight: menu.bottom + (menu.top - (windowInfo.statusBarHeight || 20)),
      viewportWidth,
      viewportHeight: viewportWidth * 0.75
    })
    this.getOpenerEventChannel().on('source', ({ path }) => this.loadSource(path))
  },

  loadSource(path) {
    wx.getImageInfo({
      src: path,
      success: info => {
        const { viewportWidth, viewportHeight } = this.data
        const coverScale = Math.max(viewportWidth / info.width, viewportHeight / info.height)
        const displayWidth = info.width * coverScale
        const displayHeight = info.height * coverScale
        this.setData({
          sourcePath: path,
          imageWidth: info.width,
          imageHeight: info.height,
          displayWidth,
          displayHeight,
          photoX: (viewportWidth - displayWidth) / 2,
          photoY: (viewportHeight - displayHeight) / 2,
          photoScale: 1
        })
      },
      fail: () => {
        wx.showToast({ title: '照片读取失败', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 500)
      }
    })
  },

  handleTouchStart(event) {
    const touches = event.touches || []
    if (touches.length >= 2) {
      this.gesture = {
        type: 'scale',
        distance: this.touchDistance(touches[0], touches[1]),
        scale: this.data.photoScale,
        x: this.data.photoX,
        y: this.data.photoY
      }
      return
    }
    if (!touches.length) return
    this.gesture = {
      type: 'move',
      clientX: touches[0].clientX,
      clientY: touches[0].clientY,
      x: this.data.photoX,
      y: this.data.photoY
    }
  },

  handleTouchMove(event) {
    const touches = event.touches || []
    if (!this.gesture || !touches.length) return
    if (touches.length >= 2) {
      if (this.gesture.type !== 'scale') {
        this.handleTouchStart(event)
        return
      }
      const distance = this.touchDistance(touches[0], touches[1])
      const ratio = this.gesture.distance ? distance / this.gesture.distance : 1
      const scale = Math.min(
        this.data.maxScale,
        Math.max(this.data.minScale, this.gesture.scale * ratio)
      )
      const position = this.clampPosition(this.gesture.x, this.gesture.y, scale)
      this.setData({ photoScale: scale, photoX: position.x, photoY: position.y })
      return
    }
    if (this.gesture.type !== 'move') {
      this.handleTouchStart(event)
      return
    }
    const x = this.gesture.x + touches[0].clientX - this.gesture.clientX
    const y = this.gesture.y + touches[0].clientY - this.gesture.clientY
    const position = this.clampPosition(x, y, this.data.photoScale)
    this.setData({ photoX: position.x, photoY: position.y })
  },

  handleTouchEnd(event) {
    const touches = event.touches || []
    if (touches.length) {
      this.handleTouchStart(event)
    } else {
      this.gesture = null
    }
  },

  touchDistance(first, second) {
    const x = first.clientX - second.clientX
    const y = first.clientY - second.clientY
    return Math.sqrt(x * x + y * y)
  },

  clampPosition(x, y, scale) {
    const { displayWidth, displayHeight, viewportWidth, viewportHeight } = this.data
    const scaledWidth = displayWidth * scale
    const scaledHeight = displayHeight * scale
    const scaleOffsetX = (scaledWidth - displayWidth) / 2
    const scaleOffsetY = (scaledHeight - displayHeight) / 2
    const minX = viewportWidth - displayWidth - scaleOffsetX
    const maxX = scaleOffsetX
    const minY = viewportHeight - displayHeight - scaleOffsetY
    const maxY = scaleOffsetY
    return {
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y))
    }
  },

  confirmCrop() {
    if (!this.data.sourcePath || this.exporting) return
    this.exporting = true
    wx.showLoading({ title: '正在生成照片' })
    const query = wx.createSelectorQuery()
    query.select('#cropCanvas').fields({ node: true, size: true })
    query.exec(result => {
      const canvas = result[0] && result[0].node
      if (!canvas) {
        this.finishWithError()
        return
      }
      const crop = this.getCropRect()
      const outputWidth = Math.max(1, Math.round(crop.width))
      const outputHeight = Math.max(1, Math.round(crop.height))
      canvas.width = outputWidth
      canvas.height = outputHeight
      const context = canvas.getContext('2d')
      const image = canvas.createImage()
      image.onload = () => {
        context.clearRect(0, 0, outputWidth, outputHeight)
        context.drawImage(
          image,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          0,
          0,
          outputWidth,
          outputHeight
        )
        wx.canvasToTempFilePath({
          canvas,
          fileType: 'jpg',
          quality: 1,
          destWidth: outputWidth,
          destHeight: outputHeight,
          success: output => {
            wx.hideLoading()
            this.exporting = false
            this.getOpenerEventChannel().emit('cropped', { path: output.tempFilePath })
            wx.navigateBack()
          },
          fail: () => this.finishWithError()
        })
      }
      image.onerror = () => this.finishWithError()
      image.src = this.data.sourcePath
    })
  },

  getCropRect() {
    const {
      imageWidth,
      imageHeight,
      displayWidth,
      displayHeight,
      viewportWidth,
      viewportHeight,
      photoX,
      photoY,
      photoScale
    } = this.data
    const scale = photoScale || 1
    const x = photoX
    const y = photoY
    const scaledWidth = displayWidth * scale
    const scaledHeight = displayHeight * scale
    const visualLeft = x - (scaledWidth - displayWidth) / 2
    const visualTop = y - (scaledHeight - displayHeight) / 2
    const sourceX = Math.max(0, -visualLeft / scaledWidth * imageWidth)
    const sourceY = Math.max(0, -visualTop / scaledHeight * imageHeight)
    const sourceWidth = Math.min(imageWidth - sourceX, viewportWidth / scaledWidth * imageWidth)
    const sourceHeight = Math.min(imageHeight - sourceY, viewportHeight / scaledHeight * imageHeight)
    return { x: sourceX, y: sourceY, width: sourceWidth, height: sourceHeight }
  },

  finishWithError() {
    wx.hideLoading()
    this.exporting = false
    wx.showToast({ title: '取景失败，请重试', icon: 'none' })
  },

  cancel() {
    wx.navigateBack()
  }
})
