const storage = require('../../utils/storage')
const date = require('../../utils/date')
const cloud = require('../../utils/cloud')
const taskPlan = require('../../utils/task-plan')

const taskCategoryIcons = {
  前期规划: 'record-planning',
  婚礼策划: 'record-service',
  婚礼流程: 'record-process',
  婚宴场地: 'record-banquet',
  宾客邀请: 'record-guests',
  交通住宿: 'record-transport',
  婚纱摄影: 'record-camera',
  礼服造型: 'record-style',
  婚品采购: 'record-shopping',
  其他事项: 'record-other'
}

Page({
  data: {
    wedding: {},
    weddingPhoto: '',
    coupleAvatars: [],
    photoDisplay: { mode: 'aspectFill' },
    weddingDateText: '',
    weddingWeekday: '',
    daysLeft: 0,
    progress: 0,
    completed: 0,
    total: 0,
    progressGroups: [],
    upcoming: [],
    currentStage: null
  },

  onShow() {
    this.loadData()
    this.loadCoupleAvatars()
    const ready = getApp().globalData.cloudReady
    if (ready) ready.then(() => {
      this.loadData()
      this.loadCoupleAvatars()
    })
  },

  async loadCoupleAvatars() {
    const profile = cloud.getLocalProfile()
    if (!profile || !profile.weddingId) {
      const localAvatar = wx.getStorageSync('xiban_wechat_avatar') || ''
      this.setData({
        coupleAvatars: localAvatar
          ? [{ id: 'local-profile', avatarFileId: localAvatar }]
          : []
      })
      return
    }
    try {
      const order = { 新郎: 0, 新娘: 1 }
      const members = await cloud.fetchMembers()
      const coupleAvatars = members
        .filter(item => ['新郎', '新娘'].includes(item.relation) && item.avatarFileId)
        .sort((a, b) => order[a.relation] - order[b.relation])
        .slice(0, 2)
      this.setData({ coupleAvatars })
    } catch (error) {
      // 首页其他内容仍可继续使用，保留上一次成功加载的头像。
    }
  },

  async onPullDownRefresh() {
    try {
      if (cloud.isEnabled()) await cloud.pull()
      this.loadData()
    } catch (error) {
      wx.showToast({ title: error.message || '刷新失败', icon: 'none' })
    } finally {
      wx.stopPullDownRefresh()
    }
  },

  loadData() {
    const wedding = storage.get('wedding')
    const weddingPhoto = storage.get('photo')
    const photoDisplay = storage.get('photoDisplay')
    const tasks = storage.get('tasks')
    const weddingDate = wedding.date ? new Date(`${wedding.date}T00:00:00`) : null
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    const activeTasks = tasks.filter(item => item.status !== 'skipped')
    const completed = activeTasks.filter(item => item.done).length
    const upcoming = activeTasks
      .filter(item => !item.done)
      .sort((a, b) => {
        if ((a.priority === 'key') !== (b.priority === 'key')) return a.priority === 'key' ? -1 : 1
        return String(a.dueDate || '').localeCompare(String(b.dueDate || ''))
      })
      .slice(0, 3)
      .map(item => {
        const days = date.daysBetween(new Date(), item.dueDate)
        return {
          ...item,
          icon: taskCategoryIcons[item.category] || 'record-other',
          displayDate: date.displayDate(item.dueDate),
          urgencyText: days < 0 ? '建议优先完成' : days === 0 ? '建议今天完成' : days <= 7 ? `${days} 天内完成` : '时间较宽裕'
        }
      })
    const availableStages = taskPlan.STAGES.filter(stage => (
      activeTasks.some(item => item.stage === stage)
    ))
    const currentStageName = availableStages.find(stage => (
      activeTasks.some(item => item.stage === stage && !item.done && item.level !== 'optional')
    )) || availableStages.find(stage => (
      activeTasks.some(item => item.stage === stage && !item.done)
    )) || (availableStages.length ? availableStages[availableStages.length - 1] : '')
    const currentStageTasks = activeTasks.filter(item => item.stage === currentStageName)
    const currentStageDone = currentStageTasks.filter(item => item.done).length
    const currentStage = currentStageName ? {
      name: currentStageName,
      description: taskPlan.STAGE_DESCRIPTIONS[currentStageName],
      index: availableStages.indexOf(currentStageName) + 1,
      totalStages: availableStages.length,
      completed: currentStageDone,
      total: currentStageTasks.length,
      progress: currentStageTasks.length ? Math.round(currentStageDone * 100 / currentStageTasks.length) : 0
    } : null
    const progressGroupRules = [
      { name: '前期规划', icon: 'record-planning', tone: 'blue' },
      { name: '婚宴场地', icon: 'record-banquet', tone: 'orange' },
      { name: '婚礼策划', icon: 'record-service', tone: 'purple' },
      { name: '婚纱摄影', icon: 'record-camera', tone: 'blue' },
      { name: '礼服造型', icon: 'record-style', tone: 'pink' },
      { name: '婚品采购', icon: 'record-shopping', tone: 'pink' },
      { name: '宾客邀请', icon: 'record-guests', tone: 'green' },
      { name: '婚礼流程', icon: 'record-process', tone: 'purple' },
      { name: '交通住宿', icon: 'record-transport', tone: 'green' },
      { name: '其他事项', icon: 'record-other', tone: 'blue' }
    ]
    const knownCategories = progressGroupRules.map(item => item.name)
    const progressGroups = progressGroupRules.map(group => {
      const groupTasks = activeTasks.filter(item => (
        item.category === group.name || (group.name === '其他事项' && !knownCategories.includes(item.category))
      ))
      const groupCompleted = groupTasks.filter(item => item.done).length
      const unfinishedTasks = groupTasks.filter(item => !item.done)
      const nearestDueDate = unfinishedTasks
        .map(item => item.dueDate || '9999-12-31')
        .sort()[0] || '9999-12-31'
      return {
        ...group,
        total: groupTasks.length,
        completed: groupCompleted,
        rate: groupTasks.length ? Math.round(groupCompleted / groupTasks.length * 100) : 0,
        unfinished: unfinishedTasks.length,
        currentStage: unfinishedTasks.some(item => item.stage === currentStageName),
        nearestDueDate
      }
    })
      .filter(group => group.total > 0)
      .sort((a, b) => {
        if (a.currentStage !== b.currentStage) return a.currentStage ? -1 : 1
        if (Boolean(a.unfinished) !== Boolean(b.unfinished)) return a.unfinished ? -1 : 1
        const dueDateOrder = a.nearestDueDate.localeCompare(b.nearestDueDate)
        if (dueDateOrder) return dueDateOrder
        return b.total - a.total
      })
      .slice(0, 4)

    this.setData({
      wedding,
      weddingPhoto,
      photoDisplay,
      weddingDateText: wedding.date ? wedding.date.replace(/-/g, '.') : '婚期待定',
      weddingWeekday: weddingDate && !Number.isNaN(weddingDate.getTime()) ? weekdays[weddingDate.getDay()] : '',
      daysLeft: Math.max(0, date.daysBetween(new Date(), wedding.date)),
      progress: activeTasks.length ? Math.round(completed / activeTasks.length * 100) : 0,
      completed,
      total: activeTasks.length,
      progressGroups,
      upcoming,
      currentStage
    })
  },

  goToday() {
    wx.redirectTo({ url: '/pages/today/today' })
  },

  goTasks() {
    wx.redirectTo({ url: '/pages/tasks/tasks' })
  },

  toggleTask(event) {
    const id = event.currentTarget.dataset.id
    const tasks = storage.get('tasks').map(item => (
      item.id === id ? {
        ...item,
        done: !item.done,
        status: item.done ? 'active' : 'completed',
        completedAt: item.done ? '' : date.formatDate(new Date())
      } : item
    ))
    if (!storage.set('tasks', tasks)) return
    this.loadData()
    wx.showToast({ title: '进度已更新', icon: 'success' })
  },

  previewPhoto() {
    if (!this.data.weddingPhoto) return
    wx.previewImage({ current: this.data.weddingPhoto, urls: [this.data.weddingPhoto] })
  }
})
