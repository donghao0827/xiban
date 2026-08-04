Page({
  onLoad(options) {
    const query = ['mode=calendar']
    if (options.date) query.push(`date=${options.date}`)
    wx.redirectTo({ url: `/pages/tasks/tasks?${query.join('&')}` })
  }
})
