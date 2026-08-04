const storage = require('../../utils/storage')
const date = require('../../utils/date')
const numberInput = require('../../utils/number-input')
const { createId } = storage

const categoryOptions = [
  { category: '前期规划', icon: 'record-planning' },
  { category: '婚宴场地', icon: 'record-banquet' },
  { category: '婚礼策划', icon: 'record-service' },
  { category: '婚纱摄影', icon: 'record-camera' },
  { category: '礼服造型', icon: 'record-style' },
  { category: '婚品采购', icon: 'record-shopping' },
  { category: '宾客邀请', icon: 'record-guests' },
  { category: '婚礼流程', icon: 'record-process' },
  { category: '交通住宿', icon: 'record-transport' },
  { category: '其他事项', icon: 'record-other' }
]

function emptyBudget() {
  return { id: '', category: '', planned: 0, spent: 0, expenses: [] }
}

Page({
  data: {
    budgets: [],
    totalPlanned: 0,
    totalSpent: 0,
    remaining: 0,
    rate: 0,
    chartGradient: 'conic-gradient(#F5F1F0 0 100%)',
    showSheet: false,
    showDetailSheet: false,
    showExpenseSheet: false,
    selectedBudget: emptyBudget(),
    categoryOptions,
    form: {
      id: '',
      category: categoryOptions[0].category,
      icon: categoryOptions[0].icon,
      planned: ''
    },
    expenseForm: {
      id: '',
      name: '',
      amount: '',
      date: date.formatDate(new Date()),
      payer: '',
      note: ''
    }
  },

  onShow() {
    this.loadBudgets()
    const ready = getApp().globalData.cloudReady
    if (ready) ready.then(() => this.loadBudgets())
  },

  loadBudgets() {
    const rawBudgets = storage.get('budgets').map(item => ({
      ...item,
      icon: (categoryOptions.find(option => option.category === item.category) || categoryOptions[categoryOptions.length - 1]).icon,
      rate: item.planned ? Math.min(100, Math.round(item.spent / item.planned * 100)) : 0
    }))
    const totalPlanned = rawBudgets.reduce((sum, item) => sum + Number(item.planned || 0), 0)
    const totalSpent = rawBudgets.reduce((sum, item) => sum + Number(item.spent || 0), 0)
    const overallRate = totalPlanned ? Math.min(100, totalSpent / totalPlanned * 100) : 0
    const colors = ['#FF6688', '#FF9855', '#5E9CF8', '#4FCB8B', '#8F7DE8']
    let chartOffset = 0
    const chartSegments = []
    const budgets = rawBudgets.map((item, index) => {
      const spent = Number(item.spent || 0)
      const visualShare = totalSpent ? spent / totalSpent * overallRate : 0
      if (visualShare > 0) {
        chartSegments.push(`${colors[index % colors.length]} ${chartOffset}% ${chartOffset + visualShare}%`)
        chartOffset += visualShare
      }
      return {
        ...item,
        share: totalPlanned ? Math.round(spent / totalPlanned * 100) : 0
      }
    })
    if (chartOffset < 100) chartSegments.push(`#F5F1F0 ${chartOffset}% 100%`)
    const chartGradient = chartSegments.length
      ? `conic-gradient(${chartSegments.join(',')})`
      : 'conic-gradient(#F5F1F0 0 100%)'
    const selectedBudget = this.data.selectedBudget && this.data.selectedBudget.id
      ? budgets.find(item => item.id === this.data.selectedBudget.id) || emptyBudget()
      : emptyBudget()
    this.setData({
      budgets,
      selectedBudget,
      totalPlanned,
      totalSpent,
      remaining: totalPlanned - totalSpent,
      rate: Math.round(overallRate),
      chartGradient
    })
  },

  openSheet() {
    this.setData({
      showSheet: true,
      form: {
        id: '',
        category: categoryOptions[0].category,
        icon: categoryOptions[0].icon,
        planned: ''
      }
    })
  },

  openBudgetDetail(event) {
    const id = event.currentTarget.dataset.id
    const budget = this.data.budgets.find(item => item.id === id)
    if (!budget) return
    this.setData({ selectedBudget: budget, showDetailSheet: true })
  },

  closeBudgetDetail() {
    this.setData({ showDetailSheet: false, selectedBudget: emptyBudget() })
  },

  editBudget() {
    const id = this.data.selectedBudget && this.data.selectedBudget.id
    const budget = storage.get('budgets').find(item => item.id === id)
    if (!budget) return
    const option = categoryOptions.find(item => item.category === budget.category)
    this.setData({
      showDetailSheet: false,
      showSheet: true,
      form: {
        id: budget.id,
        category: budget.category,
        icon: option ? option.icon : 'record-other',
        planned: budget.planned
      }
    })
  },

  closeSheet() { this.setData({ showSheet: false }) },
  stop() {},

  chooseCategory(event) {
    const index = Number(event.currentTarget.dataset.index)
    const option = categoryOptions[index]
    this.setData({ 'form.category': option.category, 'form.icon': option.icon })
  },

  updatePlanned(event) {
    const value = numberInput.money(event.detail.value)
    this.setData({ 'form.planned': value })
    return value
  },

  saveBudget() {
    const form = this.data.form
    const planned = Number(form.planned)
    if (!planned || planned < 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    const budgets = storage.get('budgets')
    const budget = { ...form, planned }
    if (form.id) {
      const index = budgets.findIndex(item => item.id === form.id)
      if (index < 0) {
        wx.showToast({ title: '没有找到这项预算', icon: 'none' })
        return
      }
      budgets[index] = { ...budgets[index], ...budget }
    } else {
      budgets.push({ ...budget, id: createId('budget'), expenses: [], spent: 0 })
    }
    if (!storage.set('budgets', budgets)) return
    this.closeSheet()
    this.loadBudgets()
    wx.showToast({ title: form.id ? '预算已更新' : '预算已添加', icon: 'success' })
  },

  openExpenseSheet() {
    this.setData({
      showExpenseSheet: true,
      expenseForm: {
        id: '',
        name: '',
        amount: '',
        date: date.formatDate(new Date()),
        payer: '',
        note: ''
      }
    })
  },

  editExpense(event) {
    const expenseId = event.currentTarget.dataset.id
    const budget = this.data.selectedBudget
    const expense = budget && budget.expenses.find(item => item.id === expenseId)
    if (!expense) return
    if (expense.recordId) {
      wx.showToast({ title: '请在对应的备婚记录中修改', icon: 'none' })
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/today/today?date=${expense.date || date.formatDate(new Date())}` })
      }, 500)
      return
    }
    this.setData({
      showExpenseSheet: true,
      expenseForm: {
        ...expense,
        amount: expense.amount || '',
        date: expense.date || date.formatDate(new Date())
      }
    })
  },

  closeExpenseSheet() {
    this.setData({ showExpenseSheet: false })
  },

  updateExpenseField(event) {
    const field = event.currentTarget.dataset.field
    const value = field === 'amount' ? numberInput.money(event.detail.value) : event.detail.value
    this.setData({ [`expenseForm.${field}`]: value })
    return value
  },

  pickExpenseDate(event) {
    this.setData({ 'expenseForm.date': event.detail.value })
  },

  saveExpense() {
    const budgetId = this.data.selectedBudget && this.data.selectedBudget.id
    const form = this.data.expenseForm
    const amount = Number(form.amount)
    if (!form.name.trim()) {
      wx.showToast({ title: '请输入支出名称', icon: 'none' })
      return
    }
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    const budgets = storage.get('budgets')
    const budgetIndex = budgets.findIndex(item => item.id === budgetId)
    if (budgetIndex < 0) {
      wx.showToast({ title: '没有找到预算分类', icon: 'none' })
      return
    }
    const expenses = [...(budgets[budgetIndex].expenses || [])]
    const now = new Date().toISOString()
    const profile = wx.getStorageSync('xiban_user_profile') || {}
    const expense = {
      ...form,
      name: form.name.trim(),
      amount,
      payer: form.payer.trim(),
      note: form.note.trim(),
      updatedAt: now
    }
    if (form.id) {
      const expenseIndex = expenses.findIndex(item => item.id === form.id)
      if (expenseIndex < 0) {
        wx.showToast({ title: '没有找到这笔支出', icon: 'none' })
        return
      }
      expenses[expenseIndex] = { ...expenses[expenseIndex], ...expense }
    } else {
      expenses.unshift({
        ...expense,
        id: createId('expense'),
        createdBy: profile.name || '',
        createdAt: now
      })
    }
    budgets[budgetIndex] = { ...budgets[budgetIndex], expenses }
    if (!storage.set('budgets', budgets)) return
    this.closeExpenseSheet()
    this.loadBudgets()
    wx.showToast({ title: form.id ? '支出已更新' : '支出已记录', icon: 'success' })
  },

  removeExpense(event) {
    const expenseId = event.currentTarget.dataset.id
    const budgetId = this.data.selectedBudget && this.data.selectedBudget.id
    const linkedExpense = this.data.selectedBudget && this.data.selectedBudget.expenses.find(item => item.id === expenseId)
    if (linkedExpense && linkedExpense.recordId) {
      wx.showToast({ title: '请删除对应的备婚记录', icon: 'none' })
      return
    }
    wx.showModal({
      title: '删除支出记录',
      content: '删除后会重新计算该分类的已支出金额。',
      confirmText: '删除',
      confirmColor: '#b95c57',
      success: result => {
        if (!result.confirm) return
        const budgets = storage.get('budgets')
        const index = budgets.findIndex(item => item.id === budgetId)
        if (index < 0) return
        budgets[index] = {
          ...budgets[index],
          expenses: (budgets[index].expenses || []).filter(item => item.id !== expenseId)
        }
        if (!storage.set('budgets', budgets)) return
        this.loadBudgets()
      }
    })
  },

  removeBudget(event) {
    const id = event.currentTarget.dataset.id
    const budget = storage.get('budgets').find(item => item.id === id)
    const expenseCount = budget && budget.expenses ? budget.expenses.length : 0
    wx.showModal({
      title: '删除预算项',
      content: expenseCount
        ? `该分类下还有 ${expenseCount} 笔支出记录，删除后无法恢复。`
        : '这不会影响其他预算，确定删除吗？',
      confirmColor: '#b95c57',
      success: result => {
        if (!result.confirm) return
        if (!storage.set('budgets', storage.get('budgets').filter(item => item.id !== id))) return
        this.loadBudgets()
      }
    })
  }
})
