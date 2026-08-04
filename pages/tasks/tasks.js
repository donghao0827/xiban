const storage = require('../../utils/storage')
const date = require('../../utils/date')
const cloud = require('../../utils/cloud')
const taskPlan = require('../../utils/task-plan')
const numberInput = require('../../utils/number-input')
const imageFile = require('../../utils/image-file')
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

Page({
  data: {
    tabs: ['全部', '待完成', '已完成'],
    activeMode: 0,
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
    }
  },

  onLoad(options) {
    if (options.mode === 'materials') this.setData({ activeMode: 1 })
  },

  onShow() {
    this.loadTasks()
    this.loadMaterials()
    const ready = getApp().globalData.cloudReady
    if (ready) {
      ready.then(() => {
        this.loadTasks()
        this.loadMaterials()
      })
    }
  },

  goCalendar() {
    wx.redirectTo({ url: '/pages/today/today' })
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
        categoryTone: materialCategoryTone(item.category),
        detailLine: `${item.quantity || 1}${item.unit || '件'}${item.note ? ` · ${item.note}` : ''}`,
        amountLine: Number(item.plannedAmount || 0) || Number(item.spentAmount || 0)
          ? `预算 ¥${Number(item.plannedAmount || 0)} · 实付 ¥${Number(item.spentAmount || 0)}`
          : ''
      }))
    const selectedTitles = new Set(selectedMaterials.map(item => item.title))
    const catalogMaterials = storage.getDefaultMaterials().map(item => ({
      ...item,
      imageUrl: materialImageUrl(item.image),
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
    }, this.filterMaterials)
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
    if (mode === 'calendar') {
      this.goCalendar()
      return
    }
    this.setData({ activeMode: mode === 'materials' ? 1 : 0 })
  },

  changeMaterialCategory(event) {
    this.setData({ activeMaterialCategory: event.currentTarget.dataset.value }, this.filterMaterials)
  },

  changeMaterialView(event) {
    this.setData({ activeMaterialView: Number(event.currentTarget.dataset.index) })
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
      ...catalogItem,
      id: createId('material'),
      selected: true,
      bought: false
    })
    if (!storage.set('materials', materials)) return
    this.loadMaterials()
    wx.showToast({ title: '已加入我的清单', icon: 'success' })
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
      materialForm: {
        ...material,
        plannedAmount: material.plannedAmount || '',
        spentAmount: material.spentAmount || ''
      }
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
        this.setData({ 'materialForm.customImage': result.fileID })
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
        this.setData({ 'materialForm.customImage': result.savedFilePath })
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
    this.setData({ 'materialForm.customImage': '' })
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
      }
    })
  }
})
