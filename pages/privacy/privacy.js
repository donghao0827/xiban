Page({
  openPrivacyContract() {
    if (!wx.openPrivacyContract) {
      wx.showToast({ title: '请升级微信后查看', icon: 'none' })
      return
    }
    wx.openPrivacyContract({
      fail: () => wx.showToast({ title: '暂时无法打开隐私指引', icon: 'none' })
    })
  }
})
