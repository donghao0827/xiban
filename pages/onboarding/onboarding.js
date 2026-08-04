const cloud = require('../../utils/cloud')
const storage = require('../../utils/storage')
const date = require('../../utils/date')
const devConfig = require('../../utils/dev-config')

function getDefaultWeddingDate() {
  const target = new Date()
  target.setDate(target.getDate() + 180)
  return date.formatDate(target)
}

Page({
  data: {
    checking: true,
    forceNewUserFlow: devConfig.forceNewUserFlow,
    submitting: false,
    mode: 'create',
    roles: ['新娘', '新郎'],
    form: {
      name: '',
      role: '新娘',
      inviteCode: '',
      date: getDefaultWeddingDate(),
      city: '',
      venue: ''
    },
    agreed: false
  },

  async onLoad() {
    if (devConfig.forceNewUserFlow) {
      this.setData({ checking: false })
      return
    }
    try {
      const ready = getApp().globalData.cloudReady
      const profile = ready ? await ready : await cloud.refreshSession()
      const localProfile = cloud.getLocalProfile()
      if (localProfile && localProfile.storageMode === 'local') {
        this.enterApp()
        return
      }
      if (!profile) {
        this.setData({ checking: false })
        return
      }
      if (profile.wedding && !storage.get('wedding').date) {
        storage.initializeWedding(profile.wedding, profile)
      }
      try {
        await cloud.enable()
      } catch (error) {
        if (!error.needsChoice) throw error
        await cloud.resolveConflict('cloud', error.remoteData)
      }
      this.enterApp()
    } catch (error) {
      if (cloud.getLocalProfile()) {
        this.enterApp()
        return
      }
      this.setData({ checking: false })
    }
  },

  enterApp() {
    const pendingPlan = wx.getStorageSync('xiban_plan_setup_pending')
    wx.reLaunch({ url: pendingPlan ? '/pages/plan-setup/plan-setup' : '/pages/home/home' })
  },

  changeMode(event) {
    this.setData({ mode: event.currentTarget.dataset.mode })
  },

  updateField(event) {
    const field = event.currentTarget.dataset.field
    let value = event.detail.value
    if (field === 'inviteCode') {
      value = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
    }
    this.setData({ [`form.${field}`]: value })
  },

  pickDate(event) {
    this.setData({ 'form.date': event.detail.value })
  },

  chooseRole(event) {
    this.setData({ 'form.role': event.currentTarget.dataset.value })
  },

  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed })
  },

  validate() {
    const form = this.data.form
    if (!form.name.trim()) return '请输入你的姓名'
    if (this.data.mode === 'create' && !['新娘', '新郎'].includes(form.role)) {
      return '请选择新娘或新郎'
    }
    if (this.data.mode === 'create' && !form.date) return '请选择婚礼日期'
    if (this.data.mode === 'join' && !/^[A-Z0-9]{10}$/.test(form.inviteCode)) {
      return '请输入 10 位邀请码'
    }
    if (this.data.mode === 'join' && !this.data.agreed) {
      return '请先同意云端数据说明'
    }
    return ''
  },

  submit() {
    const validationError = this.validate()
    if (validationError) {
      wx.showToast({ title: validationError, icon: 'none' })
      return
    }
    if (this.data.mode === 'join') {
      this.previewAndJoin()
      return
    }
    if (!storage.hasWeddingData()) {
      this.createLocalWedding()
      return
    }
    wx.showModal({
      title: '开始新的婚礼？',
      content: '当前设备里已有备婚数据。继续将覆盖现有婚礼信息、任务、婚品、预算、宾客和记录，建议先导出备份。',
      confirmText: '确认覆盖',
      confirmColor: '#c94743',
      success: result => {
        if (result.confirm) this.createLocalWedding()
      }
    })
  },

  createLocalWedding() {
    const profile = {
      id: `local_${Date.now()}`,
      name: this.data.form.name.trim(),
      relation: this.data.form.role,
      role: this.data.form.role,
      permissionRole: 'owner',
      storageMode: 'local'
    }
    wx.setStorageSync('xiban_user_profile', profile)
    storage.initializeWedding({
      date: this.data.form.date,
      city: this.data.form.city.trim(),
      venue: this.data.form.venue.trim()
    }, profile)
    wx.setStorageSync('xiban_plan_setup_pending', true)
    wx.showToast({ title: '婚礼已创建', icon: 'success' })
    setTimeout(() => wx.reLaunch({ url: '/pages/plan-setup/plan-setup' }), 350)
  },

  async previewAndJoin() {
    this.setData({ submitting: true })
    try {
      const preview = await cloud.previewInvite(this.data.form.inviteCode)
      this.setData({ submitting: false })
      const memberText = preview.members.length
        ? `当前成员：${preview.members.map(item => `${item.name}（${item.relation}）`).join('、')}`
        : '当前还没有成员'
      const replacementWarning = storage.hasWeddingData()
        ? '\n\n注意：加入后将用这场婚礼的云端数据替换当前设备上的备婚数据，建议先导出备份。'
        : ''
      wx.showModal({
        title: '确认加入这场婚礼？',
        content: `受邀身份：${preview.invite.relation} · ${preview.invite.permissionRole === 'editor' ? '可共同编辑' : '仅查看'}\n婚期：${preview.wedding.date}${preview.wedding.city ? ` · ${preview.wedding.city}` : ''}\n${memberText}${replacementWarning}`,
        confirmText: '确认加入',
        confirmColor: '#d96a63',
        success: result => {
          if (result.confirm) this.joinWedding()
        }
      })
    } catch (error) {
      this.setData({ submitting: false })
      wx.showToast({ title: error.message, icon: 'none', duration: 3500 })
    }
  },

  async joinWedding() {
    this.setData({ submitting: true })
    try {
      const result = await cloud.joinWedding({
        name: this.data.form.name.trim(),
        inviteCode: this.data.form.inviteCode
      })
      storage.initializeWedding(result.wedding, result.profile)
      await cloud.enable()
      this.setData({ submitting: false })
      wx.showToast({ title: '已加入共同婚礼', icon: 'success' })
      setTimeout(() => this.enterApp(), 500)
    } catch (error) {
      this.setData({ submitting: false })
      wx.showToast({ title: error.message, icon: 'none', duration: 3500 })
    }
  }
})
