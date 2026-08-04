const storage = require('../../utils/storage')
const date = require('../../utils/date')
const cloud = require('../../utils/cloud')
const numberInput = require('../../utils/number-input')

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const MATERIAL_CLOUD_BASE = 'cloud://prod-d0gfyfw705426c497.7072-prod-d0gfyfw705426c497-1458425791/assets/materials'
const RECORD_CATEGORIES = [
  { name: '前期规划', icon: 'record-planning', tone: 'blue', budget: '前期规划' },
  { name: '婚宴场地', icon: 'record-banquet', tone: 'orange', budget: '婚宴场地' },
  { name: '婚礼策划', icon: 'record-service', tone: 'purple', budget: '婚礼策划' },
  { name: '婚纱摄影', icon: 'record-camera', tone: 'blue', budget: '婚纱摄影' },
  { name: '礼服造型', icon: 'record-style', tone: 'pink', budget: '礼服造型' },
  { name: '婚品采购', icon: 'record-shopping', tone: 'pink', budget: '婚品采购' },
  { name: '宾客邀请', icon: 'record-guests', tone: 'green', budget: '宾客邀请' },
  { name: '婚礼流程', icon: 'record-process', tone: 'purple', budget: '婚礼流程' },
  { name: '交通住宿', icon: 'record-transport', tone: 'green', budget: '交通住宿' },
  { name: '其他事项', icon: 'record-other', tone: 'blue', budget: '其他事项' }
]
const MATERIAL_CATEGORIES = ['新人礼服', '婚房布置', '婚礼现场', '喜糖礼金', '接亲敬茶']

function emptyRecord(selectedDate) {
  return {
    id: '',
    date: selectedDate,
    category: RECORD_CATEGORIES[0].name,
    title: '',
    amount: '',
    quantity: 1,
    unitPrice: '',
    materialCategory: MATERIAL_CATEGORIES[0],
    materialTitle: '',
    materialId: '',
    taskId: '',
    photos: []
  }
}

Page({
  data: {
    year: 0,
    month: 0,
    monthText: '',
    weekLabels: ['日', '一', '二', '三', '四', '五', '六'],
    days: [],
    viewMode: 'calendar',
    selectedDate: '',
    selectedText: '',
    selectedIsToday: true,
    selectedTasks: [],
    selectedRecords: [],
    showRecordSheet: false,
    recordCategories: RECORD_CATEGORIES,
    materialCategories: MATERIAL_CATEGORIES,
    materialOptions: [],
    taskOptions: [],
    filteredTaskOptions: [],
    taskSearch: '',
    taskDropdownOpen: false,
    selectedTaskTitle: '',
    recordForm: emptyRecord(''),
    calculatedTotal: 0
  },

  onLoad(options) {
    this.resetToToday(options.date)
  },

  onShow() {
    if (!this.data.selectedDate) this.resetToToday()
    this.loadCalendar()
    const ready = getApp().globalData.cloudReady
    if (ready) ready.then(() => this.loadCalendar())
  },

  onPullDownRefresh() {
    this.loadCalendar()
    wx.stopPullDownRefresh()
  },

  resetToToday(dateValue) {
    const initial = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date()
    const target = Number.isNaN(initial.getTime()) ? new Date() : initial
    this.setData({
      year: target.getFullYear(),
      month: target.getMonth() + 1,
      selectedDate: date.formatDate(target)
    })
  },

  loadCalendar() {
    const { year, month, selectedDate } = this.data
    if (!year || !month || !selectedDate) return
    const tasks = storage.get('tasks').filter(item => item.status !== 'skipped')
    const records = storage.get('records')
    const taskCounts = tasks.reduce((counts, item) => {
      if (item.dueDate) counts[item.dueDate] = (counts[item.dueDate] || 0) + 1
      return counts
    }, {})
    const recordCounts = records.reduce((counts, item) => {
      if (item.date) counts[item.date] = (counts[item.date] || 0) + 1
      return counts
    }, {})
    const firstWeekday = new Date(year, month - 1, 1).getDay()
    const monthDays = new Date(year, month, 0).getDate()
    const previousMonthDays = new Date(year, month - 1, 0).getDate()
    const today = date.formatDate(new Date())
    const days = []

    for (let index = 0; index < 42; index += 1) {
      const offset = index - firstWeekday + 1
      const value = new Date(year, month - 1, offset)
      const cellDate = date.formatDate(value)
      let dayNumber = offset
      let currentMonth = true
      if (offset < 1) {
        dayNumber = previousMonthDays + offset
        currentMonth = false
      } else if (offset > monthDays) {
        dayNumber = offset - monthDays
        currentMonth = false
      }
      days.push({
        date: cellDate,
        day: dayNumber,
        currentMonth,
        selected: cellDate === selectedDate,
        today: cellDate === today,
        taskCount: taskCounts[cellDate] || 0,
        recordCount: recordCounts[cellDate] || 0
      })
    }

    const selected = new Date(`${selectedDate}T00:00:00`)
    const selectedTasks = tasks
      .filter(item => item.dueDate === selectedDate)
      .sort((a, b) => Number(a.done) - Number(b.done))
    const selectedRecords = records
      .filter(item => item.date === selectedDate)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .map(item => {
        const normalizedCategory = item.category === '宾客礼金'
          ? '宾客邀请'
          : item.category === '婚礼服务' ? '婚礼策划' : item.category
        const category = RECORD_CATEGORIES.find(option => option.name === normalizedCategory) || RECORD_CATEGORIES[RECORD_CATEGORIES.length - 1]
        return {
          ...item,
          category: normalizedCategory,
          icon: category.icon,
          tone: category.tone,
          amountText: Number(item.amount || 0) ? `¥${Number(item.amount).toFixed(2).replace(/\.00$/, '')}` : '',
          detailText: item.category === '婚品采购' && item.materialTitle
            ? `${item.materialTitle}${item.quantity ? ` × ${item.quantity}` : ''}`
            : item.category
        }
      })
    this.setData({
      monthText: `${year}年 ${month}月`,
      days,
      selectedText: `${selected.getMonth() + 1}月${selected.getDate()}日 · ${WEEKDAYS[selected.getDay()]}`,
      selectedIsToday: selectedDate === today,
      selectedTasks,
      selectedRecords
    })
  },

  changeView(event) {
    const mode = event.currentTarget.dataset.mode
    if (mode === 'tasks') this.goTasks()
    if (mode === 'materials') wx.redirectTo({ url: '/pages/tasks/tasks?mode=materials' })
  },

  goToday() {
    this.resetToToday()
    this.loadCalendar()
  },

  changeMonth(event) {
    const direction = Number(event.currentTarget.dataset.direction)
    const target = new Date(this.data.year, this.data.month - 1 + direction, 1)
    this.setData({
      year: target.getFullYear(),
      month: target.getMonth() + 1,
      selectedDate: date.formatDate(target)
    })
    this.loadCalendar()
  },

  selectDate(event) {
    const selectedDate = event.currentTarget.dataset.date
    const selected = new Date(`${selectedDate}T00:00:00`)
    this.setData({
      year: selected.getFullYear(),
      month: selected.getMonth() + 1,
      selectedDate
    })
    this.loadCalendar()
  },

  toggleTask(event) {
    const id = event.currentTarget.dataset.id
    const tasks = storage.get('tasks').map(item => (
      item.id === id
        ? {
            ...item,
            done: !item.done,
            status: item.done ? 'active' : 'completed',
            completedAt: item.done ? '' : this.data.selectedDate
          }
        : item
    ))
    if (!storage.set('tasks', tasks)) return
    this.loadCalendar()
    wx.showToast({ title: '任务状态已更新', icon: 'success' })
  },

  openRecordSheet() {
    const profile = cloud.getLocalProfile()
    if (profile && profile.permissionRole === 'viewer') {
      wx.showToast({ title: '你当前是只读成员', icon: 'none' })
      return
    }
    const recordForm = emptyRecord(this.data.selectedDate)
    const taskOptions = storage.get('tasks').filter(item => item.status !== 'skipped' && (!item.done || item.dueDate === this.data.selectedDate))
    this.setData({
      showRecordSheet: true,
      recordForm,
      taskOptions,
      filteredTaskOptions: taskOptions,
      taskSearch: '',
      taskDropdownOpen: false,
      selectedTaskTitle: '',
      materialOptions: this.getMaterialOptions(recordForm.materialCategory),
      calculatedTotal: 0
    })
  },

  editRecord(event) {
    const profile = cloud.getLocalProfile()
    if (profile && profile.permissionRole === 'viewer') {
      wx.showToast({ title: '你当前是只读成员', icon: 'none' })
      return
    }
    const id = event.currentTarget.dataset.id
    const record = storage.get('records').find(item => item.id === id)
    if (!record) return
    const normalizedCategory = record.category === '宾客礼金'
      ? '宾客邀请'
      : record.category === '婚礼服务' ? '婚礼策划' : record.category
    const taskOptions = storage.get('tasks').filter(item => item.status !== 'skipped')
    const selectedTask = taskOptions.find(item => String(item.id) === String(record.taskId))
    this.setData({
      showRecordSheet: true,
      recordForm: {
        ...emptyRecord(record.date),
        ...record,
        category: normalizedCategory,
        amount: record.amount || '',
        unitPrice: record.unitPrice || ''
      },
      taskOptions,
      filteredTaskOptions: taskOptions,
      taskSearch: '',
      taskDropdownOpen: false,
      selectedTaskTitle: selectedTask ? selectedTask.title : '',
      materialOptions: this.getMaterialOptions(record.materialCategory || MATERIAL_CATEGORIES[0]),
      calculatedTotal: Number(record.amount || 0)
    })
  },

  closeRecordSheet() {
    this.setData({ showRecordSheet: false, taskDropdownOpen: false, taskSearch: '' })
  },

  updateRecordField(event) {
    const field = event.currentTarget.dataset.field
    let value = event.detail.value
    if (field === 'quantity') value = numberInput.integer(value)
    if (field === 'amount' || field === 'unitPrice') value = numberInput.money(value)
    this.setData({ [`recordForm.${field}`]: value }, this.updateCalculatedTotal)
    return value
  },

  chooseRecordCategory(event) {
    const category = event.currentTarget.dataset.value
    this.setData({
      'recordForm.category': category,
      'recordForm.title': category === '婚品采购' ? this.data.recordForm.materialTitle : this.data.recordForm.title
    })
  },

  chooseMaterialCategory(event) {
    const materialCategory = event.currentTarget.dataset.value
    this.setData({
      'recordForm.materialCategory': materialCategory,
      'recordForm.materialTitle': '',
      materialOptions: this.getMaterialOptions(materialCategory)
    })
  },

  chooseMaterial(event) {
    const title = event.currentTarget.dataset.value
    this.setData({
      'recordForm.materialTitle': title,
      'recordForm.title': title
    })
  },

  chooseRelatedTask(event) {
    const taskId = event.currentTarget.dataset.id || ''
    const task = storage.get('tasks').find(item => String(item.id) === String(taskId))
    this.setData({
      'recordForm.taskId': taskId,
      'recordForm.title': this.data.recordForm.title || (task && task.title) || '',
      selectedTaskTitle: task ? task.title : '',
      taskDropdownOpen: false,
      taskSearch: '',
      filteredTaskOptions: this.data.taskOptions
    })
  },

  toggleTaskDropdown() {
    this.setData({
      taskDropdownOpen: !this.data.taskDropdownOpen,
      taskSearch: '',
      filteredTaskOptions: this.data.taskOptions
    })
  },

  searchRelatedTask(event) {
    const taskSearch = event.detail.value
    const keyword = taskSearch.trim().toLowerCase()
    const filteredTaskOptions = keyword
      ? this.data.taskOptions.filter(item => (
        `${item.title || ''} ${item.category || ''}`.toLowerCase().includes(keyword)
      ))
      : this.data.taskOptions
    this.setData({ taskSearch, filteredTaskOptions })
  },

  updateCalculatedTotal() {
    if (this.data.recordForm.category !== '婚品采购') return
    const quantity = Number(this.data.recordForm.quantity || 0)
    const unitPrice = Number(this.data.recordForm.unitPrice || 0)
    const calculatedTotal = Math.max(0, quantity * unitPrice)
    this.setData({
      calculatedTotal,
      'recordForm.amount': calculatedTotal || ''
    })
  },

  getMaterialOptions(category) {
    return storage.get('materials')
      .filter(item => item.category === category)
      .map(item => ({
        ...item,
        imageUrl: item.customImage || (item.image ? `${MATERIAL_CLOUD_BASE}/${item.image}.png` : '')
      }))
  },

  async saveRecord() {
    const form = this.data.recordForm
    const title = (form.category === '婚品采购' ? form.materialTitle : form.title).trim()
    if (!title) {
      wx.showToast({ title: form.category === '婚品采购' ? '请选择具体婚品' : '写下今天做了什么', icon: 'none' })
      return
    }
    const quantity = form.category === '婚品采购' ? Number(form.quantity || 0) : 0
    const unitPrice = form.category === '婚品采购' ? Number(form.unitPrice || 0) : 0
    const amount = form.category === '婚品采购' ? quantity * unitPrice : Number(form.amount || 0)
    if (quantity < 0 || unitPrice < 0 || amount < 0) {
      wx.showToast({ title: '请填写有效的数量和金额', icon: 'none' })
      return
    }
    const records = storage.get('records')
    const oldRecord = form.id ? records.find(item => item.id === form.id) : null
    const now = new Date().toISOString()
    const record = {
      ...form,
      id: form.id || storage.createId('record'),
      title,
      quantity,
      unitPrice,
      amount,
      createdAt: oldRecord ? oldRecord.createdAt : now,
      updatedAt: now
    }
    const nextRecords = oldRecord
      ? records.map(item => item.id === record.id ? record : item)
      : [record, ...records]
    const linked = this.buildLinkedData(nextRecords, record, oldRecord)
    if (!storage.setMany({ records: nextRecords, ...linked })) return
    this.closeRecordSheet()
    this.loadCalendar()
    wx.showToast({ title: '已经记下来啦', icon: 'success' })
  },

  buildLinkedData(records, record, oldRecord) {
    let budgets = storage.get('budgets').map(item => ({
      ...item,
      expenses: (item.expenses || []).filter(expense => expense.recordId !== record.id)
    }))
    if (record.amount > 0) {
      const categoryOption = RECORD_CATEGORIES.find(item => item.name === record.category)
      const budgetCategory = categoryOption ? categoryOption.budget : '其他事项'
      let budget = budgets.find(item => item.category === budgetCategory)
      if (!budget) {
        budget = { id: storage.createId('budget'), category: budgetCategory, planned: 0, spent: 0, expenses: [] }
        budgets.push(budget)
      }
      budget.expenses = [{
        id: `expense_${record.id}`,
        recordId: record.id,
        name: record.title,
        amount: record.amount,
        date: record.date,
        payer: '',
        note: '',
        createdBy: (cloud.getLocalProfile() || {}).name || '',
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      }, ...(budget.expenses || [])]
    }
    budgets = storage.normalizeBudgets(budgets)
    const result = { budgets }
    if (record.category === '婚品采购' || (oldRecord && oldRecord.category === '婚品采购')) {
      const materials = storage.get('materials')
      if (oldRecord && oldRecord.category === '婚品采购') {
        const oldMaterial = materials.find(item => item.title === oldRecord.materialTitle)
        if (oldMaterial) {
          oldMaterial.quantity = Math.max(0, Number(oldMaterial.quantity || 0) - Number(oldRecord.quantity || 0))
          oldMaterial.spentAmount = Math.max(0, Number(oldMaterial.spentAmount || 0) - Number(oldRecord.amount || 0))
        }
      }
      if (record.category !== '婚品采购') {
        result.materials = materials
        return result
      }
      let material = materials.find(item => item.title === record.materialTitle)
      if (!material) {
        const template = storage.getDefaultMaterials().find(item => item.title === record.materialTitle)
        material = {
          ...(template || {}),
          id: storage.createId('material'),
          title: record.materialTitle,
          category: record.materialCategory,
          image: (template && template.image) || '',
          customImage: '',
          selected: true,
          quantity: 0,
          plannedAmount: 0,
          spentAmount: 0,
          bought: false
        }
        materials.unshift(material)
      }
      material.quantity = Math.max(0, Number(material.quantity || 0) + record.quantity)
      material.spentAmount = Math.max(0, Number(material.spentAmount || 0) + record.amount)
      record.materialId = material.id
      result.materials = materials
    }
    if (record.taskId) {
      result.tasks = storage.get('tasks').map(item => (
        String(item.id) === String(record.taskId)
          ? { ...item, done: true, status: 'completed', completedAt: record.date }
          : item
      ))
    }
    return result
  },

  removeRecord(event) {
    const profile = cloud.getLocalProfile()
    if (profile && profile.permissionRole === 'viewer') {
      wx.showToast({ title: '你当前是只读成员', icon: 'none' })
      return
    }
    const id = event.currentTarget.dataset.id
    const record = storage.get('records').find(item => item.id === id)
    if (!record) return
    wx.showModal({
      title: '删除这条记录？',
      content: '关联的预算支出会一起移除，已经完成的任务不会恢复。',
      confirmText: '删除',
      confirmColor: '#d96a63',
      success: async result => {
        if (!result.confirm) return
        const records = storage.get('records').filter(item => item.id !== id)
        const budgets = storage.normalizeBudgets(storage.get('budgets').map(item => ({
          ...item,
          expenses: (item.expenses || []).filter(expense => expense.recordId !== id)
        })))
        const values = { records, budgets }
        if (record.category === '婚品采购') {
          values.materials = storage.get('materials').map(item => (
            item.title === record.materialTitle
              ? {
                  ...item,
                  quantity: Math.max(0, Number(item.quantity || 0) - Number(record.quantity || 0)),
                  spentAmount: Math.max(0, Number(item.spentAmount || 0) - Number(record.amount || 0))
                }
              : item
          ))
        }
        if (!storage.setMany(values)) return
        try {
          if (cloud.isEnabled()) await cloud.push()
          this.deleteRecordFiles(record.photos || [])
        } catch (error) {}
        this.loadCalendar()
      }
    })
  },

  deleteRecordFiles(files) {
    const cloudFiles = files.filter(item => item.indexOf('cloud://') === 0)
    const localFiles = files.filter(item => item.indexOf('cloud://') !== 0)
    if (cloudFiles.length && wx.cloud && wx.cloud.deleteFile) {
      wx.cloud.deleteFile({ fileList: cloudFiles, fail: () => {} })
    }
    localFiles.forEach(filePath => {
      wx.getFileSystemManager().removeSavedFile({ filePath, fail: () => {} })
    })
  },

  goTasks() {
    wx.redirectTo({ url: '/pages/tasks/tasks' })
  }
})
