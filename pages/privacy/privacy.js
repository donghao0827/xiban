const cloud = require('../../utils/cloud')

Page({
  data: {
    cloudEnabled: false
  },

  onShow() {
    this.setData({ cloudEnabled: cloud.isEnabled() })
  },

  openPrivacyContract() {
    if (!wx.openPrivacyContract) {
      wx.showToast({ title: '请升级微信后查看', icon: 'none' })
      return
    }
    wx.openPrivacyContract({
      fail: () => wx.showToast({ title: '暂时无法打开隐私指引', icon: 'none' })
    })
  },

  removeCloudData() {
    wx.showModal({
      title: '删除云端婚礼空间',
      content: '婚礼信息、成员、邀请和云端文件将永久删除。如仍有其他成员，需要先移除成员。',
      confirmText: '永久删除',
      confirmColor: '#c94743',
      success: async result => {
        if (!result.confirm) return
        wx.showLoading({ title: '正在删除', mask: true })
        try {
          const deleteResult = await cloud.removeCloudData()
          wx.hideLoading()
          const fullyCleaned = !deleteResult.filesKept
          wx.showToast({
            title: fullyCleaned ? '云端数据已删除' : '数据已删除，部分文件待清理',
            icon: fullyCleaned ? 'success' : 'none',
            duration: 2500
          })
          setTimeout(() => wx.reLaunch({ url: '/pages/profile/profile' }), 900)
        } catch (error) {
          wx.hideLoading()
          wx.showToast({ title: error.message || '删除失败，请重试', icon: 'none', duration: 3000 })
        }
      }
    })
  }
})
