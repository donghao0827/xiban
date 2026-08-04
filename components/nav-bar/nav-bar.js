Component({
  options: {
    addGlobalClass: true,
    multipleSlots: true
  },
  properties: {
    title: {
      type: String,
      value: ''
    },
    subtitle: {
      type: String,
      value: ''
    },
    back: {
      type: Boolean,
      value: false
    },
    customLeft: {
      type: Boolean,
      value: false
    }
  },
  data: {
    top: 0,
    height: 44,
    rightSpace: 96
  },
  lifetimes: {
    attached() {
      const system = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const menu = wx.getMenuButtonBoundingClientRect()
      this.setData({
        top: system.statusBarHeight || 20,
        height: menu.height + (menu.top - (system.statusBarHeight || 20)) * 2,
        rightSpace: Math.max(88, (system.windowWidth || 375) - menu.left + 8)
      })
    }
  },
  methods: {
    goBack() {
      if (getCurrentPages().length > 1) {
        wx.navigateBack()
        return
      }
      wx.redirectTo({ url: '/pages/home/home' })
    }
  }
})
