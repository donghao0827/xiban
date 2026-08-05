const storage = require('../../utils/storage')
const date = require('../../utils/date')
const cloud = require('../../utils/cloud')
const taskPlan = require('../../utils/task-plan')
const numberInput = require('../../utils/number-input')
const imageFile = require('../../utils/image-file')
const imageCache = require('../../utils/image-cache')
const { createId } = storage

const categories = ['前期规划', '婚宴场地', '婚礼策划', '婚纱摄影', '礼服造型', '婚品采购', '宾客邀请', '婚礼流程', '交通住宿', '其他事项']
const categoryIcons = {
  前期规划: 'record-planning',
  婚宴场地: 'record-banquet',
  婚礼策划: 'record-service',
  婚纱摄影: 'record-camera',
  礼服造型: 'record-style',
  婚品采购: 'record-shopping',
  宾客邀请: 'record-guests',
  婚礼流程: 'record-process',
  交通住宿: 'record-transport',
  其他事项: 'record-other'
}
const categoryOptions = categories.map(name => ({ name, icon: categoryIcons[name] }))
const MATERIAL_CLOUD_BASE = 'cloud://prod-d0gfyfw705426c497.7072-prod-d0gfyfw705426c497-1458425791/assets/materials'
const CLOUD_CUSTOM_IMAGE_LIMIT = 20
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
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
const RECORD_MATERIAL_CATEGORIES = ['新人礼服', '婚房布置', '婚礼现场', '喜糖礼金', '接亲敬茶']

function materialImageUrl(image) {
  return image ? `${MATERIAL_CLOUD_BASE}/${image}.png` : ''
}

function materialCategoryTone(category) {
  return {
    新人礼服: 'pink',
    婚房布置: 'orange',
    婚礼现场: 'purple',
    喜糖礼金: 'green',
    接亲敬茶: 'blue'
  }[category] || 'pink'
}

function emptyRecord(selectedDate) {
  return {
    id: '',
    date: selectedDate,
    category: RECORD_CATEGORIES[0].name,
    title: '',
    amount: '',
    quantity: 1,
    unitPrice: '',
    materialCategory: RECORD_MATERIAL_CATEGORIES[0],
    materialTitle: '',
    materialId: '',
    taskId: '',
    photos: []
  }
}

Page({
  data: {
    tabs: ['全部', '待完成', '已完成'],
    primaryMode: 'tasks',
    activeTab: 0,
    activeCategory: '全部类型',
    taskCategories: ['全部类型'].concat(categories),
    tasks: [],
    visibleTasks: [],
    timelineGroups: [],
    completedCount: 0,
    effectiveTaskCount: 0,
    taskProgress: 0,
    materials: [],
    visibleMaterials: [],
    catalogMaterials: [],
    visibleCatalogMaterials: [],
    materialViews: ['我的清单', '婚品库'],
    activeMaterialView: 0,
    materialCategories: ['全部'],
    activeMaterialCategory: '全部',
    boughtCount: 0,
    materialProgress: 0,
    materialPlanned: 0,
    materialSpent: 0,
    showSheet: false,
    showTaskGuide: false,
    selectedTask: null,
    showMaterialSheet: false,
    materialFormDisplayImage: '',
    categories,
    categoryOptions,
    form: {
      title: '',
      category: categories[0],
      dueDate: date.formatDate(new Date())
    },
    materialForm: {
      id: '',
      title: '',
      category: '婚房布置',
      quantity: 1,
      unit: '件',
      note: '',
      plannedAmount: '',
      spentAmount: '',
      customImage: ''
    },
    year: 0,
    month: 0,
    monthText: '',
    weekLabels: ['日', '一', '二', '三', '四', '五', '六'],
    days: [],
    selectedDate: '',
    selectedText: '',
    selectedIsToday: true,
    selectedTasks: [],
    selectedRecords: [],
    showRecordSheet: false,
    recordCategories: RECORD_CATEGORIES,
    recordMaterialCategories: RECORD_MATERIAL_CATEGORIES,
    materialOptions: [],
    taskOptions: [],
    filteredTaskOptions: [],
    taskDropdownOpen: false,
    selectedTaskTitle: '',
    recordForm: emptyRecord(''),
    calculatedTotal: 0
  },

  onLoad(options) {
    const mode = options.mode === 'materials' || options.mode === 'calendar' || options.mode === 'tasks'
      ? options.mode
      : 'tasks'
    this.setData({ primaryMode: mode })
    this.resetToToday(options.date)
  },

  onShow() {
    this.refreshPreparePage()
    const ready = getApp().globalData.cloudReady
    if (ready) ready.then(() => this.refreshPreparePage())
  },

  onPullDownRefresh() {
    this.refreshPreparePage()
    wx.stopPullDownRefresh()
  },

  refreshPreparePage() {
    this.loadTasks()
    this.loadMaterials()
    if (!this.data.selectedDate) this.resetToToday()
    this.loadCalendar()
  },

  loadTasks() {
    const tasks = storage.get('tasks').map(item => ({
      ...item,
      status: item.status || (item.done ? 'completed' : 'active'),
      levelText: item.level === 'optional' ? '可选' : item.priority === 'key' ? '关键' : '建议',
      icon: categoryIcons[item.category] || 'record-other',
      displayDate: date.displayDate(item.dueDate)
    })).sort((a, b) => {
      if ((a.status === 'skipped') !== (b.status === 'skipped')) return a.status === 'skipped' ? 1 : -1
      if (a.done !== b.done) return a.done ? 1 : -1
      return String(a.dueDate || '').localeCompare(String(b.dueDate || ''))
    })
    const taskCategories = ['全部类型'].concat(categories.filter(category => (
      tasks.some(item => item.category === category)
    )))
    const activeCategory = taskCategories.includes(this.data.activeCategory)
      ? this.data.activeCategory
      : '全部类型'
    const effectiveTasks = tasks.filter(item => item.status !== 'skipped')
    this.setData({
      tasks,
      taskCategories,
      activeCategory,
      completedCount: effectiveTasks.filter(item => item.done).length,
      effectiveTaskCount: effectiveTasks.length,
      taskProgress: effectiveTasks.length ? Math.round(effectiveTasks.filter(item => item.done).length / effectiveTasks.length * 100) : 0
    }, this.filterTasks)
  },

  filterTasks() {
    const { tasks, activeTab, activeCategory } = this.data
    const visibleTasks = tasks.filter(item => (
      (activeTab === 0 || (activeTab === 1 && !item.done) || (activeTab === 2 && item.done)) &&
      (activeTab === 0 || item.status !== 'skipped') &&
      (activeCategory === '全部类型' || item.category === activeCategory)
    ))
    const countableTasks = tasks.filter(item => (
      item.status !== 'skipped' &&
      (activeCategory === '全部类型' || item.category === activeCategory)
    ))
    const customStages = [
      ...new Set(visibleTasks.map(item => item.stage).filter(stage => stage && !taskPlan.STAGES.includes(stage)))
    ]
    const orderedStages = taskPlan.STAGES
      .concat(customStages)
      .concat(visibleTasks.some(item => !item.stage) ? ['其他安排'] : [])
    const timelineGroups = orderedStages
      .map(stage => {
        const matchesStage = item => stage === '其他安排' ? !item.stage : item.stage === stage
        const stageTasks = visibleTasks.filter(matchesStage)
        const stageTotals = countableTasks.filter(matchesStage)
        return {
          stage,
          tasks: stageTasks,
          completed: stageTotals.filter(item => item.done).length,
          total: stageTotals.length
        }
      })
      .filter(group => group.tasks.length)
    this.setData({ visibleTasks, timelineGroups })
  },

  changeTaskCategory(event) {
    this.setData({ activeCategory: event.currentTarget.dataset.value }, this.filterTasks)
  },

  loadMaterials() {
    const selectedMaterials = storage.get('materials')
      .filter(item => !item.hidden)
      .map(item => ({
        ...item,
        imageUrl: materialImageUrl(item.image),
        cacheSource: item.customImage || materialImageUrl(item.image),
        displayImage: imageCache.peek(item.customImage || materialImageUrl(item.image)) || item.customImage || materialImageUrl(item.image),
        categoryTone: materialCategoryTone(item.category),
        detailLine: `${item.quantity || 1}${item.unit || '件'}${item.note ? ` · ${item.note}` : ''}`,
        amountLine: Number(item.plannedAmount || 0) || Number(item.spentAmount || 0)
          ? `预算 ¥${Number(item.plannedAmount || 0)} · 实付 ¥${Number(item.spentAmount || 0)}`
          : ''
      }))
    const selectedTitles = new Set(selectedMaterials.map(item => item.title))
    const catalogMaterials = storage.getDefaultMaterials().map(item => ({
      ...item,
      cacheSource: materialImageUrl(item.image),
      imageUrl: imageCache.peek(materialImageUrl(item.image)) || materialImageUrl(item.image),
      categoryTone: materialCategoryTone(item.category),
      selected: selectedTitles.has(item.title)
    }))
    const materialCategories = ['全部'].concat([
      ...new Set(catalogMaterials.concat(selectedMaterials).map(item => item.category))
    ])
    this.setData({
      materials: selectedMaterials,
      catalogMaterials,
      materialCategories,
      boughtCount: selectedMaterials.filter(item => item.bought).length,
      materialPlanned: selectedMaterials.reduce((sum, item) => sum + Number(item.plannedAmount || 0), 0),
      materialSpent: selectedMaterials.reduce((sum, item) => sum + Number(item.spentAmount || 0), 0),
      materialProgress: selectedMaterials.length
        ? Math.round(selectedMaterials.filter(item => item.bought).length * 100 / selectedMaterials.length)
        : 0
    }, () => {
      this.filterMaterials()
      if (this.data.primaryMode === 'materials') this.cacheMaterialImages()
    })
  },

  async cacheMaterialImages() {
    const sources = this.data.activeMaterialView === 0
      ? this.data.visibleMaterials.map(item => item.cacheSource)
      : this.data.visibleCatalogMaterials.map(item => item.cacheSource)
    const cached = await imageCache.resolveMany(sources)
    const materials = this.data.materials.map(item => ({
      ...item,
      displayImage: cached[item.cacheSource] || item.displayImage
    }))
    const catalogMaterials = this.data.catalogMaterials.map(item => ({
      ...item,
      imageUrl: cached[item.cacheSource] || item.imageUrl
    }))
    this.setData({ materials, catalogMaterials }, this.filterMaterials)
  },

  filterMaterials() {
    const category = this.data.activeMaterialCategory
    this.setData({
      visibleMaterials: category === '全部'
        ? this.data.materials
        : this.data.materials.filter(item => item.category === category),
      visibleCatalogMaterials: category === '全部'
        ? this.data.catalogMaterials
        : this.data.catalogMaterials.filter(item => item.category === category)
    })
  },

  changePrimaryMode(event) {
    const mode = event.currentTarget.dataset.mode
    if (mode === this.data.primaryMode) return
    this.setData({ primaryMode: mode }, () => {
      if (mode === 'materials') this.cacheMaterialImages()
    })
    if (mode === 'calendar') this.loadCalendar()
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

  goSelectedDay() {
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

  toggleDayTask(event) {
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
    this.loadTasks()
    this.loadCalendar()
    wx.showToast({ title: '任务状态已更新', icon: 'success' })
  },

  relatedTasksForCategory(taskOptions, category) {
    return taskOptions.filter(item => item.category === category)
  },

  applyRelatedTaskCategory(category, taskOptions = this.data.taskOptions) {
    const filteredTaskOptions = this.relatedTasksForCategory(taskOptions, category)
    const selected = taskOptions.find(item => String(item.id) === String(this.data.recordForm.taskId))
    const patch = { taskOptions, filteredTaskOptions }
    if (selected && selected.category !== category) {
      patch['recordForm.taskId'] = ''
      patch.selectedTaskTitle = ''
    }
    return patch
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
      ...this.applyRelatedTaskCategory(recordForm.category, taskOptions),
      taskDropdownOpen: false,
      selectedTaskTitle: '',
      materialOptions: this.getRecordMaterialOptions(recordForm.materialCategory),
      calculatedTotal: 0
    }, this.cacheRecordMaterialOptions)
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
      filteredTaskOptions: this.relatedTasksForCategory(taskOptions, normalizedCategory),
      taskDropdownOpen: false,
      selectedTaskTitle: selectedTask ? selectedTask.title : '',
      materialOptions: this.getRecordMaterialOptions(record.materialCategory || RECORD_MATERIAL_CATEGORIES[0]),
      calculatedTotal: Number(record.amount || 0)
    }, this.cacheRecordMaterialOptions)
  },

  closeRecordSheet() {
    this.setData({ showRecordSheet: false, taskDropdownOpen: false })
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
      'recordForm.title': category === '婚品采购' ? this.data.recordForm.materialTitle : this.data.recordForm.title,
      taskDropdownOpen: false,
      ...this.applyRelatedTaskCategory(category)
    })
  },

  chooseRecordMaterialCategory(event) {
    const materialCategory = event.currentTarget.dataset.value
    this.setData({
      'recordForm.materialCategory': materialCategory,
      'recordForm.materialTitle': '',
      materialOptions: this.getRecordMaterialOptions(materialCategory)
    }, this.cacheRecordMaterialOptions)
  },

  chooseRecordMaterial(event) {
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
      taskDropdownOpen: false
    })
  },

  toggleTaskDropdown() {
    this.setData({ taskDropdownOpen: !this.data.taskDropdownOpen })
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

  getRecordMaterialOptions(category) {
    return storage.get('materials')
      .filter(item => item.category === category)
      .map(item => ({
        ...item,
        cacheSource: item.customImage || materialImageUrl(item.image),
        imageUrl: imageCache.peek(item.customImage || materialImageUrl(item.image)) || item.customImage || materialImageUrl(item.image)
      }))
  },

  async cacheRecordMaterialOptions() {
    const options = this.data.materialOptions
    const cached = await imageCache.resolveMany(options.map(item => item.cacheSource))
    if (this.data.materialOptions !== options) return
    this.setData({
      materialOptions: options.map(item => ({
        ...item,
        imageUrl: cached[item.cacheSource] || item.imageUrl
      }))
    })
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
      id: form.id || createId('record'),
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
    this.loadTasks()
    this.loadMaterials()
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
        budget = { id: createId('budget'), category: budgetCategory, planned: 0, spent: 0, expenses: [] }
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
          id: createId('material'),
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
        this.loadMaterials()
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

  changeMaterialCategory(event) {
    this.setData({ activeMaterialCategory: event.currentTarget.dataset.value }, () => {
      this.filterMaterials()
      this.cacheMaterialImages()
    })
  },

  changeMaterialView(event) {
    this.setData({ activeMaterialView: Number(event.currentTarget.dataset.index) }, this.cacheMaterialImages)
  },

  toggleCatalogMaterial(event) {
    const title = event.currentTarget.dataset.title
    const catalogItem = this.data.catalogMaterials.find(item => item.title === title)
    if (!catalogItem) return
    const materials = storage.get('materials')
    const selected = materials.find(item => item.title === title)
    if (selected) {
      const remove = () => {
        if (!storage.set('materials', materials.filter(item => item.title !== title))) return
        this.loadMaterials()
      }
      if (selected.bought || selected.note || selected.plannedAmount || selected.spentAmount) {
        wx.showModal({
          title: '移出我的清单',
          content: '这项婚品已经填写过进度或备注，确定移出吗？',
          confirmColor: '#b95664',
          success: result => { if (result.confirm) remove() }
        })
      } else {
        remove()
      }
      return
    }
    materials.unshift({
      id: createId('material'),
      title: catalogItem.title,
      category: catalogItem.category,
      icon: catalogItem.icon,
      image: catalogItem.image || '',
      customImage: '',
      selected: true,
      hidden: false,
      bought: false,
      quantity: 1,
      unit: catalogItem.unit || '件',
      note: '',
      plannedAmount: 0,
      spentAmount: 0
    })
    if (!storage.set('materials', materials)) return
    this.loadMaterials()
  },

  toggleMaterial(event) {
    const id = event.currentTarget.dataset.id
    const materials = storage.get('materials').map(item => (
      item.id === id ? { ...item, bought: !item.bought } : item
    ))
    if (!storage.set('materials', materials)) return
    this.loadMaterials()
  },

  openMaterialSheet() {
    this.materialImageOriginal = ''
    this.materialImageSaved = false
    this.setData({
      showMaterialSheet: true,
      materialFormDisplayImage: '',
      materialForm: {
        id: '',
        title: '',
        category: this.data.activeMaterialCategory === '全部' ? '婚房布置' : this.data.activeMaterialCategory,
        quantity: 1,
        unit: '件',
        note: '',
        plannedAmount: '',
        spentAmount: '',
        customImage: ''
      }
    })
  },

  editMaterial(event) {
    const id = event.currentTarget.dataset.id
    const material = storage.get('materials').find(item => item.id === id)
    if (!material) return
    this.materialImageOriginal = material.customImage || ''
    this.materialImageSaved = false
    this.setData({
      showMaterialSheet: true,
      materialFormDisplayImage: material.customImage || '',
      materialForm: {
        ...material,
        plannedAmount: material.plannedAmount || '',
        spentAmount: material.spentAmount || ''
      }
    })
    imageCache.resolve(material.customImage).then(materialFormDisplayImage => {
      if (this.data.materialForm.id === material.id) this.setData({ materialFormDisplayImage })
    })
  },

  closeMaterialSheet() {
    const pendingImage = this.data.materialForm.customImage
    if (!this.materialImageSaved && pendingImage && pendingImage !== this.materialImageOriginal) {
      this.deleteMaterialImage(pendingImage)
    }
    this.setData({ showMaterialSheet: false })
  },
  updateMaterialTitle(event) { this.setData({ 'materialForm.title': event.detail.value }) },
  updateMaterialField(event) {
    const field = event.currentTarget.dataset.field
    let value = event.detail.value
    if (field === 'quantity') value = numberInput.integer(value)
    if (field === 'plannedAmount' || field === 'spentAmount') value = numberInput.money(value)
    this.setData({ [`materialForm.${field}`]: value })
    return value
  },
  chooseMaterialCategory(event) { this.setData({ 'materialForm.category': event.currentTarget.dataset.value }) },

  chooseMaterialImage() {
    const profile = cloud.getLocalProfile()
    if (profile && profile.permissionRole === 'viewer') {
      wx.showToast({ title: '你当前是只读成员', icon: 'none' })
      return
    }
    if (cloud.isEnabled()) {
      const currentId = this.data.materialForm.id
      const usedCount = storage.get('materials').filter(item => (
        item.id !== currentId &&
        typeof item.customImage === 'string' &&
        item.customImage.indexOf('cloud://') === 0
      )).length
      if (usedCount >= CLOUD_CUSTOM_IMAGE_LIMIT) {
        wx.showToast({ title: `免费体验最多上传 ${CLOUD_CUSTOM_IMAGE_LIMIT} 张婚品图片`, icon: 'none' })
        return
      }
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: async result => {
        const selected = result.tempFiles[0]
        try {
          const fileMeta = await imageFile.validate(selected.tempFilePath, {
            label: '婚品图片',
            maxBytes: imageFile.limits.material,
            knownSize: selected.size
          })
          this.uploadMaterialImage(selected.tempFilePath, fileMeta.extension)
        } catch (error) {
          wx.showToast({ title: error.message, icon: 'none', duration: 3000 })
        }
      }
    })
  },

  uploadMaterialImage(filePath, extension = 'jpg') {
    const profile = cloud.getLocalProfile()
    if (!wx.cloud || !wx.cloud.uploadFile || !profile || !profile.weddingId || !cloud.isEnabled()) {
      this.saveMaterialImageLocally(filePath)
      return
    }
    const cloudPath = `weddings/${profile.weddingId}/materials/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`
    wx.showLoading({ title: '正在上传图片' })
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: result => {
        wx.hideLoading()
        const previousImage = this.data.materialForm.customImage
        if (previousImage && previousImage !== this.materialImageOriginal) {
          this.deleteMaterialImage(previousImage)
        }
        this.setData({
          'materialForm.customImage': result.fileID,
          materialFormDisplayImage: filePath
        })
        wx.showToast({ title: '图片已上传', icon: 'success' })
      },
      fail: () => {
        wx.hideLoading()
        this.saveMaterialImageLocally(filePath)
      }
    })
  },

  saveMaterialImageLocally(filePath) {
    wx.getFileSystemManager().saveFile({
      tempFilePath: filePath,
      success: result => {
        const previousImage = this.data.materialForm.customImage
        if (previousImage && previousImage !== this.materialImageOriginal) {
          this.deleteMaterialImage(previousImage)
        }
        this.setData({
          'materialForm.customImage': result.savedFilePath,
          materialFormDisplayImage: result.savedFilePath
        })
        wx.showToast({ title: '图片暂存本机', icon: 'none' })
      },
      fail: () => wx.showToast({ title: '图片保存失败', icon: 'none' })
    })
  },

  clearMaterialImage() {
    const currentImage = this.data.materialForm.customImage
    if (currentImage && currentImage !== this.materialImageOriginal) {
      this.deleteMaterialImage(currentImage)
    }
    this.setData({ 'materialForm.customImage': '', materialFormDisplayImage: '' })
  },

  async saveMaterial() {
    const form = this.data.materialForm
    if (!form.title.trim()) {
      wx.showToast({ title: '请输入要购买的物料', icon: 'none' })
      return
    }
    const quantity = Number(form.quantity || 1)
    const plannedAmount = Number(form.plannedAmount || 0)
    const spentAmount = Number(form.spentAmount || 0)
    if (
      !Number.isFinite(quantity) ||
      quantity < 1 ||
      !Number.isFinite(plannedAmount) ||
      plannedAmount < 0 ||
      !Number.isFinite(spentAmount) ||
      spentAmount < 0
    ) {
      wx.showToast({ title: '请填写有效的数量和金额', icon: 'none' })
      return
    }
    const iconMap = { 新人礼服: 'shirt', 婚房布置: 'sofa', 婚礼现场: 'flower', 喜糖礼金: 'candy', 接亲敬茶: 'gift' }
    const materials = storage.get('materials')
    const material = {
      ...form,
      title: form.title.trim(),
      quantity,
      unit: form.unit.trim() || '件',
      note: form.note.trim(),
      plannedAmount,
      spentAmount,
      selected: true
    }
    if (form.id) {
      const index = materials.findIndex(item => item.id === form.id)
      if (index >= 0) materials[index] = { ...materials[index], ...material }
    } else {
      materials.unshift({
        ...material,
        id: createId('material'),
        icon: iconMap[form.category] || 'shopping-bag',
        image: '',
        customImage: form.customImage || '',
        bought: false
      })
    }
    if (!storage.set('materials', materials)) return
    this.materialImageSaved = true
    const oldImage = this.materialImageOriginal
    const newImage = material.customImage || ''
    if (oldImage && oldImage !== newImage) {
      try {
        if (cloud.isEnabled()) await cloud.push()
        this.deleteMaterialImage(oldImage)
      } catch (error) {
        // 保留旧文件，避免云端快照仍引用它时出现裂图。
      }
    }
    this.closeMaterialSheet()
    this.loadMaterials()
    wx.showToast({ title: form.id ? '婚品已更新' : '已加入清单', icon: 'success' })
  },

  removeMaterial(event) {
    const id = event.currentTarget.dataset.id
    const material = storage.get('materials').find(item => item.id === id)
    wx.showModal({
      title: '移除婚品',
      content: '确定从购买清单中移除吗？',
      confirmColor: '#d96a63',
      success: async result => {
        if (!result.confirm) return
        if (!storage.set('materials', storage.get('materials').filter(item => item.id !== id))) return
        if (material && material.customImage) {
          try {
            if (cloud.isEnabled()) await cloud.push()
            this.deleteMaterialImage(material.customImage)
          } catch (error) {
            // 同步未确认时保留文件，避免其他设备上的旧数据失效。
          }
        }
        this.loadMaterials()
      }
    })
  },

  deleteMaterialImage(filePath) {
    if (!filePath) return
    if (filePath.indexOf('cloud://') === 0 && wx.cloud && wx.cloud.deleteFile) {
      imageCache.invalidate(filePath)
      wx.cloud.deleteFile({ fileList: [filePath], fail: () => {} })
      return
    }
    if (filePath.indexOf('wxfile://') === 0 || filePath.indexOf('http://usr/') === 0) {
      wx.getFileSystemManager().removeSavedFile({ filePath, fail: () => {} })
    }
  },

  changeTab(event) {
    this.setData({ activeTab: Number(event.currentTarget.dataset.index) }, this.filterTasks)
  },

  toggleTask(event) {
    const id = event.currentTarget.dataset.id
    const today = date.formatDate(new Date())
    const tasks = storage.get('tasks').map(item => item.id === id
      ? {
          ...item,
          done: !item.done,
          status: item.done ? 'active' : 'completed',
          completedAt: item.done ? '' : today
        }
      : item)
    if (!storage.set('tasks', tasks)) return
    this.loadTasks()
    this.loadCalendar()
  },

  openTaskGuide(event) {
    const id = event.currentTarget.dataset.id
    const selectedTask = this.data.tasks.find(item => String(item.id) === String(id))
    if (!selectedTask) return
    const nextTask = this.data.tasks.find(item => (
      item.status !== 'skipped' && !item.done && item.id !== selectedTask.id &&
      Number(item.sortOrder === undefined ? 9999 : item.sortOrder) > Number(selectedTask.sortOrder === undefined ? -1 : selectedTask.sortOrder)
    ))
    this.setData({
      showTaskGuide: true,
      selectedTask: { ...selectedTask, nextTaskTitle: nextTask ? nextTask.title : '' }
    })
  },

  closeTaskGuide() {
    this.setData({ showTaskGuide: false, selectedTask: null })
  },

  completeSelectedTask() {
    const selectedTask = this.data.selectedTask
    if (!selectedTask) return
    const today = date.formatDate(new Date())
    const done = !selectedTask.done
    if (!storage.set('tasks', storage.get('tasks').map(item => (
      item.id === selectedTask.id
        ? { ...item, done, status: done ? 'completed' : 'active', completedAt: done ? today : '' }
        : item
    )))) return
    this.closeTaskGuide()
    this.loadTasks()
    this.loadCalendar()
    if (done && selectedTask.nextTaskTitle) {
      wx.showModal({
        title: '这一项完成啦',
        content: `接下来可以做：${selectedTask.nextTaskTitle}`,
        showCancel: false,
        confirmText: '知道了',
        confirmColor: '#FF6688'
      })
    }
  },

  skipSelectedTask() {
    const selectedTask = this.data.selectedTask
    if (!selectedTask) return
    wx.showModal({
      title: '设为不需要？',
      content: '这项任务将不计入筹备进度，之后仍可在“全部”中恢复。',
      confirmText: '不需要',
      confirmColor: '#FF6688',
      success: result => {
        if (!result.confirm) return
        if (!storage.set('tasks', storage.get('tasks').map(item => (
          item.id === selectedTask.id ? { ...item, done: false, status: 'skipped', completedAt: '' } : item
        )))) return
        this.closeTaskGuide()
        this.loadTasks()
        this.loadCalendar()
      }
    })
  },

  restoreSelectedTask() {
    const selectedTask = this.data.selectedTask
    if (!selectedTask) return
    if (!storage.set('tasks', storage.get('tasks').map(item => (
      item.id === selectedTask.id ? { ...item, status: 'active', done: false } : item
    )))) return
    this.closeTaskGuide()
    this.loadTasks()
    this.loadCalendar()
    wx.showToast({ title: '已恢复到计划', icon: 'success' })
  },

  openSheet() {
    const defaultDate = new Date()
    defaultDate.setDate(defaultDate.getDate() + 7)
    this.setData({
      showSheet: true,
      form: {
        title: '',
        category: categories[0],
        dueDate: date.formatDate(defaultDate)
      }
    })
  },

  closeSheet() {
    this.setData({ showSheet: false })
  },

  stop() {},

  updateTitle(event) {
    this.setData({ 'form.title': event.detail.value })
  },

  pickDate(event) {
    this.setData({ 'form.dueDate': event.detail.value })
  },

  chooseCategory(event) {
    this.setData({ 'form.category': event.currentTarget.dataset.value })
  },

  saveTask() {
    const form = this.data.form
    if (!form.title.trim()) {
      wx.showToast({ title: '请输入任务名称', icon: 'none' })
      return
    }
    const tasks = storage.get('tasks')
    tasks.unshift({
      id: createId('task'),
      ...form,
      title: form.title.trim(),
      done: false,
      source: 'user',
      manualDueDate: true
    })
    if (!storage.set('tasks', tasks)) return
    this.closeSheet()
    this.loadTasks()
    this.loadCalendar()
    wx.showToast({ title: '任务已添加', icon: 'success' })
  },

  removeTask(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '删除任务',
      content: '确定删除这项筹备任务吗？',
      confirmColor: '#b95c57',
      success: result => {
        if (!result.confirm) return
        if (!storage.set('tasks', storage.get('tasks').filter(item => item.id !== id))) return
        this.loadTasks()
        this.loadCalendar()
      }
    })
  }
})
