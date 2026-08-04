Component({
  data: {
    visible: false
  },

  lifetimes: {
    attached() {
      if (!wx.onNeedPrivacyAuthorization) return
      this.privacyHandler = resolve => {
        this.resolvePrivacyAuthorization = resolve
        this.setData({ visible: true })
      }
      wx.onNeedPrivacyAuthorization(this.privacyHandler)
    },

    detached() {
      if (this.privacyHandler && wx.offNeedPrivacyAuthorization) {
        wx.offNeedPrivacyAuthorization(this.privacyHandler)
      }
      this.resolvePrivacyAuthorization = null
    }
  },

  methods: {
    stop() {},

    openPrivacyContract() {
      if (!wx.openPrivacyContract) {
        wx.showToast({ title: '请升级微信后查看', icon: 'none' })
        return
      }
      wx.openPrivacyContract({
        fail: () => wx.showToast({ title: '暂时无法打开隐私指引', icon: 'none' })
      })
    },

    agree() {
      if (this.resolvePrivacyAuthorization) {
        this.resolvePrivacyAuthorization({ event: 'agree', buttonId: 'privacy-agree-button' })
      }
      this.resolvePrivacyAuthorization = null
      this.setData({ visible: false })
    },

    disagree() {
      if (this.resolvePrivacyAuthorization) {
        this.resolvePrivacyAuthorization({ event: 'disagree' })
      }
      this.resolvePrivacyAuthorization = null
      this.setData({ visible: false })
      wx.showToast({ title: '未同意隐私指引，无法选择图片', icon: 'none' })
    }
  }
})
