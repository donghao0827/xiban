const cloud = require('../../utils/cloud')

const relations = ['新娘', '新郎', '新娘父母', '新郎父母', '伴娘', '伴郎', '婚礼帮手', '亲友']
const permissionLabels = {
  owner: '管理员',
  editor: '协作者',
  viewer: '只读成员'
}

function formatInviteExpiry(value, reused) {
  const expiry = new Date(value)
  const prefix = reused ? '已找回之前生成的邀请码' : '邀请码已生成'
  if (Number.isNaN(expiry.getTime())) return `${prefix}，仅可使用一次`
  const month = expiry.getMonth() + 1
  const day = expiry.getDate()
  const hour = String(expiry.getHours()).padStart(2, '0')
  const minute = String(expiry.getMinutes()).padStart(2, '0')
  return `${prefix} · 有效期至 ${month}月${day}日 ${hour}:${minute}，仅可使用一次`
}

Page({
  data: {
    members: [],
    profile: null,
    loading: true,
    showInviteSheet: false,
    createdInvite: null,
    relations,
    inviteForm: {
      relation: '新娘父母',
      permissionRole: 'editor'
    }
  },

  onShow() {
    this.loadMembers()
  },

  async loadMembers() {
    try {
      const profile = cloud.getLocalProfile()
      const members = await cloud.fetchMembers()
      this.setData({
        profile,
        loading: false,
        members: members.map(item => ({
          ...item,
          initial: item.name ? item.name.charAt(0) : '喜',
          permissionLabel: permissionLabels[item.permissionRole] || item.permissionRole
        }))
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message, icon: 'none' })
    }
  },

  goBack() {
    wx.navigateBack()
  },

  openInviteSheet() {
    if (!this.data.profile || this.data.profile.permissionRole !== 'owner') {
      wx.showToast({ title: '仅管理员可以邀请成员', icon: 'none' })
      return
    }
    if (this.data.members.length >= 5) {
      wx.showToast({ title: '免费体验最多支持 5 名成员', icon: 'none' })
      return
    }
    this.setData({
      showInviteSheet: true,
      createdInvite: null,
      inviteForm: { relation: '新娘父母', permissionRole: 'editor' }
    })
  },

  closeInviteSheet() {
    this.setData({ showInviteSheet: false, createdInvite: null })
  },

  stop() {},

  chooseRelation(event) {
    const relation = event.currentTarget.dataset.value
    this.setData({
      'inviteForm.relation': relation,
      'inviteForm.permissionRole': ['新娘', '新郎'].includes(relation)
        ? 'owner'
        : (this.data.inviteForm.permissionRole === 'owner'
            ? 'editor'
            : this.data.inviteForm.permissionRole)
    })
  },

  choosePermission(event) {
    this.setData({ 'inviteForm.permissionRole': event.currentTarget.dataset.value })
  },

  async createInvite() {
    wx.showLoading({ title: '正在生成' })
    try {
      const invite = await cloud.createInvite(this.data.inviteForm)
      wx.hideLoading()
      this.setData({
        createdInvite: {
          ...invite,
          expiresText: formatInviteExpiry(invite.expiresAt, invite.reused)
        }
      })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message, icon: 'none' })
    }
  },

  copyInviteCode() {
    const invite = this.data.createdInvite
    if (!invite || !invite.inviteCode) return
    wx.setClipboardData({
      data: invite.inviteCode,
      success: () => wx.showToast({ title: '邀请码已复制', icon: 'success' })
    })
  },

  changePermission(event) {
    const member = this.data.members.find(item => item.id === Number(event.currentTarget.dataset.id))
    if (!member || member.isMe || this.data.profile.permissionRole !== 'owner') return
    const nextRole = member.permissionRole === 'editor' ? 'viewer' : 'editor'
    wx.showModal({
      title: '调整成员权限',
      content: `将 ${member.name} 调整为“${permissionLabels[nextRole]}”？`,
      confirmColor: '#d96a63',
      success: async result => {
        if (!result.confirm) return
        try {
          await cloud.updateMember(member.id, { permissionRole: nextRole })
          this.loadMembers()
        } catch (error) {
          wx.showToast({ title: error.message, icon: 'none' })
        }
      }
    })
  },

  removeMember(event) {
    const member = this.data.members.find(item => item.id === Number(event.currentTarget.dataset.id))
    if (!member || member.isMe || this.data.profile.permissionRole !== 'owner') return
    wx.showModal({
      title: '移除共同筹备成员',
      content: `确定移除 ${member.name}（${member.relation}）吗？`,
      confirmText: '移除',
      confirmColor: '#c94743',
      success: async result => {
        if (!result.confirm) return
        try {
          await cloud.removeMember(member.id)
          this.loadMembers()
        } catch (error) {
          wx.showToast({ title: error.message, icon: 'none' })
        }
      }
    })
  }
})
