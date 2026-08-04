const storage = require('../../utils/storage')
const numberInput = require('../../utils/number-input')
const cloud = require('../../utils/cloud')
const { createId } = storage

const sides = ['男方', '女方', '共同']
const groups = ['亲友', '同学', '同事', '其他']
const statuses = ['待邀请', '待回复', '已确认', '不出席']

Page({
  data: {
    readOnly: false,
    filters: ['全部', '待邀请', '待回复', '已确认'],
    activeFilter: 0,
    guests: [],
    visibleGuests: [],
    totalPeople: 0,
    confirmedPeople: 0,
    showSheet: false,
    sides,
    groups,
    statuses,
    form: { name: '', side: sides[0], group: groups[0], count: 1, status: statuses[0] }
  },

  onShow() {
    this.refreshReadOnly()
    this.loadGuests()
    const ready = getApp().globalData.cloudReady
    if (ready) ready.then(() => {
      this.refreshReadOnly()
      this.loadGuests()
    })
  },

  refreshReadOnly() {
    const profile = cloud.getLocalProfile()
    this.setData({ readOnly: !!(profile && profile.permissionRole === 'viewer') })
  },

  ensureEditable() {
    if (!this.data.readOnly) return true
    wx.showToast({ title: '你当前是只读成员', icon: 'none' })
    return false
  },

  loadGuests() {
    const guests = storage.get('guests').map(item => ({
      ...item,
      initial: item.name ? item.name.charAt(0) : '喜',
      statusClass: statuses.indexOf(item.status)
    }))
    this.setData({
      guests,
      totalPeople: guests.reduce((sum, item) => sum + Number(item.count), 0),
      confirmedPeople: guests.filter(item => item.status === '已确认').reduce((sum, item) => sum + Number(item.count), 0)
    }, this.filterGuests)
  },

  filterGuests() {
    const status = this.data.filters[this.data.activeFilter]
    this.setData({
      visibleGuests: status === '全部' ? this.data.guests : this.data.guests.filter(item => item.status === status)
    })
  },

  changeFilter(event) {
    this.setData({ activeFilter: Number(event.currentTarget.dataset.index) }, this.filterGuests)
  },

  openSheet() {
    if (!this.ensureEditable()) return
    this.setData({ showSheet: true, form: { name: '', side: sides[0], group: groups[0], count: 1, status: statuses[0] } })
  },
  closeSheet() { this.setData({ showSheet: false }) },
  stop() {},
  updateName(event) { this.setData({ 'form.name': event.detail.value }) },
  updateCount(event) {
    const value = numberInput.integer(event.detail.value)
    this.setData({ 'form.count': value })
    return value
  },
  chooseSide(event) { this.setData({ 'form.side': event.currentTarget.dataset.value }) },
  chooseGroup(event) { this.setData({ 'form.group': event.currentTarget.dataset.value }) },
  chooseStatus(event) { this.setData({ 'form.status': event.currentTarget.dataset.value }) },

  saveGuest() {
    if (!this.ensureEditable()) return
    const form = this.data.form
    if (!form.name.trim()) {
      wx.showToast({ title: '请输入宾客称呼', icon: 'none' })
      return
    }
    const guests = storage.get('guests')
    guests.unshift({ id: createId('guest'), ...form, name: form.name.trim(), count: Number(form.count) })
    if (!storage.set('guests', guests)) return
    this.closeSheet()
    this.loadGuests()
    wx.showToast({ title: '宾客已添加', icon: 'success' })
  },

  cycleStatus(event) {
    if (!this.ensureEditable()) return
    const id = event.currentTarget.dataset.id
    const guests = storage.get('guests').map(item => {
      if (item.id !== id) return item
      const next = (statuses.indexOf(item.status) + 1) % statuses.length
      return { ...item, status: statuses[next] }
    })
    if (!storage.set('guests', guests)) return
    this.loadGuests()
  },

  removeGuest(event) {
    if (!this.ensureEditable()) return
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '移除宾客',
      content: '确定从名单中移除这位宾客吗？',
      confirmColor: '#b95c57',
      success: result => {
        if (!result.confirm) return
        if (!storage.set('guests', storage.get('guests').filter(item => item.id !== id))) return
        this.loadGuests()
      }
    })
  }
})
