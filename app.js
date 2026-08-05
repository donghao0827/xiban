const storage = require('./utils/storage')
const cloud = require('./utils/cloud')

App({
  onLaunch() {
    storage.bootstrap()
    this.globalData.justLaunched = true
    this.globalData.cloudReady = Promise.resolve(cloud.getLocalProfile())
    if (wx.cloud) {
      wx.cloud.init({ env: cloud.CONFIG.env, traceUser: true })
      this.globalData.cloudReady = cloud.refreshSession().catch(() => cloud.getLocalProfile())
    }
  },
  onShow() {
    if (this.globalData.justLaunched) {
      this.globalData.justLaunched = false
      return
    }
    if (wx.cloud) {
      this.globalData.cloudReady = cloud.refreshSession().catch(() => cloud.getLocalProfile())
    }
  },
  globalData: {
    appName: '一起备婚啦',
    cloudReady: null,
    justLaunched: false
  }
})
