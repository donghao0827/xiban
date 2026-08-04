const storage = require('../../utils/storage')
const taskPlan = require('../../utils/task-plan')
const date = require('../../utils/date')

const CONDITION_OPTIONS = [
  { key: 'banquet', title: '举办婚宴', description: '加入场地、桌数、菜单和席位任务', checked: true },
  { key: 'ceremony', title: '举办婚礼仪式', description: '加入策划、主持、布置和仪式流程', checked: true },
  { key: 'pickup', title: '安排接亲', description: '加入婚车、接亲游戏、敬茶和婚房布置任务', checked: true },
  { key: 'weddingPhoto', title: '拍摄婚纱照', description: '加入摄影机构、拍摄和选片任务', checked: true }
]

const COMPLETED_OPTIONS = [
  ['wedding-date', '已经确定婚期'],
  ['wedding-budget', '已经确定预算'],
  ['venue-book', '已经预订场地'],
  ['service-team', '已经确定婚礼服务团队'],
  ['photo-plan', '已经确定婚纱摄影'],
  ['photo-shoot', '已经拍完婚纱照'],
  ['couple-outfits', '已经选好新人礼服'],
  ['customs-plan', '已经确定接亲安排'],
  ['first-guests', '已经整理宾客名单']
].map(([id, title]) => ({ id, title, checked: false }))

Page({
  data: {
    step: 0,
    editMode: false,
    templates: taskPlan.TEMPLATES,
    selectedTemplate: 'general-wedding',
    conditionOptions: CONDITION_OPTIONS,
    completedOptions: COMPLETED_OPTIONS,
    availableCompletedOptions: COMPLETED_OPTIONS.map((item, index) => ({ ...item, sourceIndex: index })),
    weddingDate: '',
    daysLeft: 0,
    scheduleMode: '标准计划',
    summary: { count: 0, stages: 0, keyCount: 0, detailCount: 0, optionalCount: 0 },
    previewTasks: [],
    simpleMode: false,
    saving: false
  },

  onLoad(options) {
    const wedding = storage.get('wedding')
    const weddingDate = wedding.date || date.formatDate(new Date())
    const daysLeft = Math.max(0, date.daysBetween(new Date(), weddingDate))
    const editMode = options && options.edit === '1'
    const savedPlan = wedding.plan || {}
    const savedConditions = savedPlan.conditions || {}
    const conditionOptions = CONDITION_OPTIONS.map(item => ({
      ...item,
      checked: editMode && savedConditions[item.key] !== undefined
        ? Boolean(savedConditions[item.key])
        : item.checked
    }))
    this.setData({
      step: editMode ? 1 : 0,
      editMode,
      selectedTemplate: editMode ? (savedPlan.templateId || 'general-wedding') : 'general-wedding',
      conditionOptions,
      weddingDate,
      daysLeft,
      scheduleMode: daysLeft <= 45 ? '冲刺计划' : daysLeft <= 120 ? '紧凑计划' : '标准计划'
    })
    this.refreshSummary()
  },

  chooseTemplate(event) {
    this.setData({ selectedTemplate: event.currentTarget.dataset.id }, this.refreshSummary)
  },

  toggleCondition(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({
      [`conditionOptions[${index}].checked`]: !this.data.conditionOptions[index].checked
    }, this.refreshSummary)
  },

  toggleCompleted(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({
      [`completedOptions[${index}].checked`]: !this.data.completedOptions[index].checked
    }, this.refreshSummary)
  },

  refreshSummary() {
    const conditions = this.getConditions()
    const simpleMode = !conditions.banquet && !conditions.ceremony && !conditions.pickup
    const completedIds = this.data.completedOptions.filter(item => item.checked).map(item => item.id)
    const generatedTasks = this.data.editMode
      ? taskPlan.reconcilePlan({
          tasks: storage.get('tasks'),
          templateId: this.data.selectedTemplate,
          weddingDate: this.data.weddingDate || date.formatDate(new Date()),
          conditions
        })
      : taskPlan.generatePlan({
          templateId: this.data.selectedTemplate,
          weddingDate: this.data.weddingDate || date.formatDate(new Date()),
          conditions,
          completedIds
        })
    const availableTaskIds = new Set(generatedTasks.map(item => item.templateTaskId))
    const availableCompletedOptions = this.data.completedOptions
      .map((item, index) => ({ ...item, sourceIndex: index }))
      .filter(item => availableTaskIds.has(item.id))
    const previewTasks = generatedTasks.filter(item => !item.done).slice(0, 3).map(item => ({
      ...item,
      displayDate: date.displayDate(item.dueDate)
    }))
    this.setData({
      summary: taskPlan.getPlanSummary(this.data.selectedTemplate, conditions),
      previewTasks,
      availableCompletedOptions,
      simpleMode
    })
  },

  getConditions() {
    return this.data.conditionOptions.reduce((result, item) => {
      result[item.key] = item.checked
      return result
    }, {})
  },

  nextStep() {
    if (this.data.selectedTemplate === 'custom') {
      this.setData({ step: 2 })
      return
    }
    this.setData({ step: Math.min(2, this.data.step + 1) }, this.refreshSummary)
  },

  previousStep() {
    if (this.data.editMode && this.data.step === 1) {
      wx.navigateBack()
      return
    }
    if (this.data.step === 0) {
      wx.navigateBack({
        fail: () => wx.reLaunch({ url: '/pages/onboarding/onboarding' })
      })
      return
    }
    this.setData({ step: this.data.step - 1 })
  },

  handlePrimaryAction() {
    if (this.data.step === 2) this.savePlan()
    else this.nextStep()
  },

  savePlan() {
    if (this.data.saving) return
    this.setData({ saving: true })
    const conditions = this.getConditions()
    const completedIds = this.data.completedOptions.filter(item => item.checked).map(item => item.id)
    const tasks = this.data.editMode
      ? taskPlan.reconcilePlan({
          tasks: storage.get('tasks'),
          templateId: this.data.selectedTemplate,
          weddingDate: this.data.weddingDate,
          conditions
        })
      : taskPlan.generatePlan({
          templateId: this.data.selectedTemplate,
          weddingDate: this.data.weddingDate,
          conditions,
          completedIds
        })
    const wedding = storage.get('wedding')
    const plan = {
      templateId: this.data.selectedTemplate,
      templateVersion: taskPlan.TEMPLATE_VERSION,
      conditions,
      generatedAt: wedding.plan && wedding.plan.generatedAt ? wedding.plan.generatedAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scheduleMode: this.data.scheduleMode,
      lastScheduledWeddingDate: this.data.weddingDate
    }
    if (!storage.setMany({
      wedding: { ...wedding, plan },
      tasks
    })) {
      this.setData({ saving: false })
      return
    }
    if (!this.data.editMode) wx.removeStorageSync('xiban_plan_setup_pending')
    wx.showToast({
      title: this.data.editMode ? '筹备范围已更新' : tasks.length ? `已生成 ${tasks.length} 项计划` : '已创建空白计划',
      icon: 'success'
    })
    setTimeout(() => {
      if (this.data.editMode && getCurrentPages().length > 1) wx.navigateBack()
      else wx.reLaunch({ url: '/pages/home/home' })
    }, 500)
  }
})
