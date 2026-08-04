const date = require('./date')

const SCHEMA_VERSION = 7

const KEYS = {
  wedding: 'xiban_wedding',
  tasks: 'xiban_tasks',
  budgets: 'xiban_budgets',
  guests: 'xiban_guests',
  photo: 'xiban_wedding_photo',
  photoOriginal: 'xiban_wedding_photo_original',
  photoDisplay: 'xiban_wedding_photo_display',
  materials: 'xiban_materials',
  records: 'xiban_records'
}

const SCHEMA_KEY = 'xiban_schema_version'
const MATERIAL_SELECTION_VERSION_KEY = 'xiban_material_selection_version'
const BACKUP_VERSION = 1

const MATERIAL_IMAGES = {
  '新娘婚纱': 'bridal-dress',
  '新娘敬酒服': 'toast-dress',
  '新郎西装': 'groom-suit',
  '新郎衬衫': 'groom-shirt',
  '红色婚鞋': 'red-wedding-shoes',
  '新郎皮鞋': 'groom-shoes',
  '父母礼服': 'parent-outfits',
  '伴郎伴娘服': 'bridesmaid-groomsman',
  '婚房四件套': 'bedding',
  '喜字贴': 'double-happiness-sticker',
  '气球与拉花': 'balloons-garland',
  '床头婚纱照': 'bedside-photo-frame',
  '红色抱枕': 'red-cushions',
  '早生贵子盘/摆件': 'date-fruit-set',
  '压床娃娃': 'wedding-dolls',
  '签到本与签到笔': 'sign-book',
  '迎宾牌': 'welcome-sign',
  '桌卡与席位卡': 'table-place-cards',
  '戒指盒': 'ring-box',
  '手捧花': 'bouquet',
  '胸花与腕花': 'corsage-wrist-flower',
  '红包袋': 'red-envelopes',
  '备用丝袜与创可贴': 'emergency-kit',
  '喜糖': 'wedding-candy',
  '喜糖盒': 'candy-box',
  '伴手礼': 'guest-gift',
  '烟酒饮料': 'drinks',
  '纸巾': 'tissues',
  '接亲/堵门小红包': 'small-red-envelopes',
  '备用大红包': 'large-red-envelopes',
  '敬茶茶具（杯/碗）': 'tea-cups',
  '敬茶托盘': 'tea-tray',
  '保温壶': 'thermos',
  '一次性纸杯': 'paper-cups',
  '果盘': 'fruit-plate',
  '跪垫': 'kneeling-cushions',
  '红伞': 'red-umbrella',
  '子孙桶': 'descendant-bucket',
  '接亲游戏道具': 'door-games',
  '婚车装饰': 'wedding-car-decor',
  '礼花筒': 'confetti-poppers',
  '红色喜布': 'red-wedding-cloth'
}

const MATERIAL_TITLE_ALIASES = {
  '早生贵子摆件': '早生贵子盘/摆件',
  '堵门小红包': '接亲/堵门小红包',
  '万无一失大红包': '备用大红包',
  '敬茶杯': '敬茶茶具（杯/碗）'
}

const MATERIAL_META = {
  '红包袋': { unit: '包' },
  '接亲/堵门小红包': { unit: '个', note: '可在备注中填写面额，如 2～6 元/个' },
  '备用大红包': { unit: '个', note: '用于临时补礼或重要礼金' },
  '一次性纸杯': { unit: '包' },
  '敬茶茶具（杯/碗）': { unit: '套' },
  '敬茶托盘': { unit: '个' },
  '保温壶': { unit: '个' },
  '果盘': { unit: '个' },
  '红色喜布': { unit: '块' }
}

function getDefaultTasks(weddingDate) {
  return require('./task-plan').generatePlan({
    templateId: 'general-wedding',
    weddingDate,
    conditions: { banquet: true, ceremony: true, pickup: true, weddingPhoto: true },
    completedIds: []
  })
}

function getDefaultMaterials() {
  const groups = {
    '新人礼服': ['新娘婚纱', '新娘敬酒服', '新郎西装', '新郎衬衫', '红色婚鞋', '新郎皮鞋', '父母礼服', '伴郎伴娘服'],
    '婚房布置': ['婚房四件套', '喜字贴', '气球与拉花', '床头婚纱照', '红色抱枕', '早生贵子盘/摆件', '压床娃娃', '红色喜布'],
    '婚礼现场': ['签到本与签到笔', '迎宾牌', '桌卡与席位卡', '戒指盒', '手捧花', '胸花与腕花', '备用丝袜与创可贴'],
    '喜糖礼金': ['喜糖', '喜糖盒', '伴手礼', '烟酒饮料', '纸巾', '红包袋', '接亲/堵门小红包', '备用大红包'],
    '接亲敬茶': ['敬茶茶具（杯/碗）', '敬茶托盘', '保温壶', '一次性纸杯', '果盘', '跪垫', '红伞', '子孙桶', '接亲游戏道具', '婚车装饰', '礼花筒']
  }
  const icons = {
    '新人礼服': 'shirt',
    '婚房布置': 'sofa',
    '婚礼现场': 'flower',
    '喜糖礼金': 'candy',
    '接亲敬茶': 'gift'
  }
  let index = 0
  return Object.keys(groups).reduce((list, category) => (
    list.concat(groups[category].map(title => ({
      id: `tm${++index}`,
      title,
      category,
      icon: icons[category],
      image: MATERIAL_IMAGES[title] || '',
      bought: false,
      quantity: 1,
      unit: (MATERIAL_META[title] && MATERIAL_META[title].unit) || '件',
      note: (MATERIAL_META[title] && MATERIAL_META[title].note) || '',
      plannedAmount: 0,
      spentAmount: 0
    })))
  ), [])
}

function normalizeMaterials(materials) {
  return (Array.isArray(materials) ? materials : []).map(item => {
    const title = MATERIAL_TITLE_ALIASES[item.title] || item.title
    const meta = MATERIAL_META[title] || {}
    return {
      ...item,
      title,
      image: MATERIAL_IMAGES[title] || item.image || '',
      quantity: Math.max(1, Number(item.quantity || 1)),
      unit: item.unit || meta.unit || '件',
      note: item.note || meta.note || '',
      plannedAmount: Number(item.plannedAmount || 0),
      spentAmount: Number(item.spentAmount || 0)
    }
  })
}

function normalizeBudgets(budgets) {
  const categoryAliases = {
    婚品喜糖: '婚品采购',
    婚品: '婚品采购',
    婚纱礼服: '礼服造型',
    珠宝首饰: '礼服造型',
    酒席: '婚宴场地',
    其他: '其他事项'
  }
  const normalized = (Array.isArray(budgets) ? budgets : [])
    .filter(item => item.category !== '改口礼金')
    .map(item => {
      const category = categoryAliases[item.category] || item.category || '其他事项'
      const legacySpent = Number(item.spent || 0)
      const expenses = Array.isArray(item.expenses)
        ? item.expenses.map(expense => ({
            ...expense,
            amount: Number(expense.amount || 0),
            date: expense.date || '',
            payer: expense.payer || '',
            note: expense.note || '',
            createdBy: expense.createdBy || '',
            createdAt: expense.createdAt || '',
            updatedAt: expense.updatedAt || ''
          }))
        : (legacySpent > 0
            ? [{
                id: `expense_legacy_${item.id}`,
                name: '历史支出',
                amount: legacySpent,
                date: '',
                payer: '',
                note: '由原预算已支出金额自动迁移'
              }]
            : [])
      return {
        ...item,
        category,
        planned: Number(item.planned || 0),
        expenses,
        spent: expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
      }
    })
  return normalized.reduce((result, item) => {
    const existing = result.find(budget => budget.category === item.category)
    if (!existing) {
      result.push({ ...item, expenses: [...item.expenses] })
      return result
    }
    existing.planned += item.planned
    existing.expenses = existing.expenses.concat(item.expenses)
    existing.spent = existing.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
    return result
  }, [])
}

function normalizeRecords(records) {
  return (Array.isArray(records) ? records : []).map(item => ({
    ...item,
    date: item.date || date.formatDate(new Date()),
    category: item.category === '婚礼服务' ? '婚礼策划' : (item.category || '其他事项'),
    title: item.title || '',
    amount: Math.max(0, Number(item.amount || 0)),
    quantity: Math.max(0, Number(item.quantity || 0)),
    unitPrice: Math.max(0, Number(item.unitPrice || 0)),
    materialCategory: item.materialCategory || '',
    materialTitle: item.materialTitle || '',
    materialId: item.materialId || '',
    taskId: item.taskId || '',
    bought: Boolean(item.bought),
    note: item.note || '',
    photos: Array.isArray(item.photos) ? item.photos.filter(Boolean).slice(0, 3) : [],
    createdAt: item.createdAt || '',
    updatedAt: item.updatedAt || ''
  }))
}

function migrateMaterialSelection(materials) {
  const catalog = getDefaultMaterials()
  const catalogMap = catalog.reduce((map, item) => {
    map[item.title] = item
    return map
  }, {})
  return normalizeMaterials(materials)
    .filter(item => {
      if (item.hidden) return false
      const template = catalogMap[item.title]
      if (!template) return true
      return (
        item.selected === true ||
        item.bought ||
        Number(item.quantity || 1) !== Number(template.quantity || 1) ||
        (item.unit || '件') !== (template.unit || '件') ||
        Boolean(item.note && item.note !== template.note) ||
        Number(item.plannedAmount || 0) > 0 ||
        Number(item.spentAmount || 0) > 0
      )
    })
    .map(item => ({ ...item, selected: true, hidden: false }))
}

function bootstrap() {
  if (!wx.getStorageSync(KEYS.wedding)) wx.setStorageSync(KEYS.wedding, {})
  if (!wx.getStorageSync(KEYS.tasks)) wx.setStorageSync(KEYS.tasks, [])
  if (!wx.getStorageSync(KEYS.budgets)) wx.setStorageSync(KEYS.budgets, [])
  if (!wx.getStorageSync(KEYS.guests)) wx.setStorageSync(KEYS.guests, [])
  if (!Array.isArray(wx.getStorageSync(KEYS.records))) wx.setStorageSync(KEYS.records, [])
  if (!Array.isArray(wx.getStorageSync(KEYS.materials))) wx.setStorageSync(KEYS.materials, [])
  if (!wx.getStorageSync(KEYS.photo)) wx.setStorageSync(KEYS.photo, '')
  if (!wx.getStorageSync(KEYS.photoOriginal)) {
    wx.setStorageSync(KEYS.photoOriginal, wx.getStorageSync(KEYS.photo) || '')
  }
  if (!wx.getStorageSync(KEYS.photoDisplay)) {
    wx.setStorageSync(KEYS.photoDisplay, { mode: 'aspectFill' })
  }

  const wedding = wx.getStorageSync(KEYS.wedding) || {}
  const profile = wx.getStorageSync('xiban_user_profile')
  if (
    profile &&
    profile.name &&
    (!wedding.couple || wedding.couple === '我们的婚礼')
  ) {
    wx.setStorageSync(KEYS.wedding, {
      ...wedding,
      couple: profile.name
    })
  }

  const materials = wx.getStorageSync(KEYS.materials) || []
  const selectionVersion = Number(wx.getStorageSync(MATERIAL_SELECTION_VERSION_KEY) || 0)
  const migratedMaterials = selectionVersion < 1
    ? migrateMaterialSelection(materials)
    : normalizeMaterials(materials)
  if (JSON.stringify(migratedMaterials) !== JSON.stringify(materials)) {
    wx.setStorageSync(KEYS.materials, migratedMaterials)
  }
  const budgets = wx.getStorageSync(KEYS.budgets) || []
  const normalizedBudgets = normalizeBudgets(budgets)
  if (JSON.stringify(normalizedBudgets) !== JSON.stringify(budgets)) {
    wx.setStorageSync(KEYS.budgets, normalizedBudgets)
  }
  const records = wx.getStorageSync(KEYS.records) || []
  const normalizedRecords = normalizeRecords(records)
  if (JSON.stringify(normalizedRecords) !== JSON.stringify(records)) {
    wx.setStorageSync(KEYS.records, normalizedRecords)
  }
  const tasks = wx.getStorageSync(KEYS.tasks) || []
  const taskPlan = require('./task-plan')
  const savedPlan = wedding.plan
  const shouldUpgradePlan = savedPlan && savedPlan.templateId && (
    Number(savedPlan.templateVersion || 0) < taskPlan.TEMPLATE_VERSION
  )
  const upgradeConditions = savedPlan
    ? { ...savedPlan.conditions, pickup: savedPlan.conditions && savedPlan.conditions.pickup !== undefined ? savedPlan.conditions.pickup : true }
    : {}
  const normalizedTasks = shouldUpgradePlan
    ? taskPlan.reconcilePlan({
        tasks,
        templateId: savedPlan.templateId,
        weddingDate: wedding.date || date.formatDate(new Date()),
        conditions: upgradeConditions
      })
    : taskPlan.enrichTasks(tasks)
  if (JSON.stringify(normalizedTasks) !== JSON.stringify(tasks)) {
    wx.setStorageSync(KEYS.tasks, normalizedTasks)
  }
  if (shouldUpgradePlan) {
    wx.setStorageSync(KEYS.wedding, {
      ...wedding,
      plan: {
        ...savedPlan,
        conditions: upgradeConditions,
        templateVersion: taskPlan.TEMPLATE_VERSION,
        upgradedAt: new Date().toISOString()
      }
    })
  }
  wx.setStorageSync(MATERIAL_SELECTION_VERSION_KEY, 1)
  wx.setStorageSync(SCHEMA_KEY, SCHEMA_VERSION)
}

function initializeWedding(wedding, profile) {
  const normalizedWedding = {
    couple: profile && profile.name ? profile.name : '我们的婚礼',
    date: wedding.date,
    city: wedding.city || '',
    venue: wedding.venue || ''
  }
  wx.setStorageSync(KEYS.wedding, normalizedWedding)
  wx.setStorageSync(KEYS.tasks, [])
  wx.setStorageSync(KEYS.budgets, [])
  wx.setStorageSync(KEYS.guests, [])
  wx.setStorageSync(KEYS.materials, [])
  wx.setStorageSync(KEYS.records, [])
  wx.setStorageSync(KEYS.photo, '')
  wx.setStorageSync(KEYS.photoOriginal, '')
  return normalizedWedding
}

function hasWeddingData() {
  const wedding = wx.getStorageSync(KEYS.wedding) || {}
  const listKeys = ['tasks', 'budgets', 'guests', 'materials', 'records']
  return Boolean(
    wedding.date ||
    wedding.city ||
    wedding.venue ||
    listKeys.some(key => {
      const value = wx.getStorageSync(KEYS[key])
      return Array.isArray(value) && value.length > 0
    }) ||
    wx.getStorageSync(KEYS.photo) ||
    wx.getStorageSync(KEYS.photoOriginal)
  )
}

function get(key) {
  const value = wx.getStorageSync(KEYS[key])
  if (key === 'photo' || key === 'photoOriginal') return value || ''
  if (key === 'photoDisplay') return value || { mode: 'aspectFill' }
  if (key === 'wedding') return value || {}
  if (key === 'tasks') return require('./task-plan').enrichTasks(value)
  if (key === 'materials') return normalizeMaterials(value)
  if (key === 'budgets') return normalizeBudgets(value)
  if (key === 'records') return normalizeRecords(value)
  return value || []
}

function set(key, value) {
  return setMany({ [key]: value })
}

function setMany(values) {
  const profile = wx.getStorageSync('xiban_user_profile')
  const keys = Object.keys(values)
  const syncableKeys = ['wedding', 'tasks', 'materials', 'budgets', 'guests', 'records', 'photo', 'photoOriginal', 'photoDisplay']
  if (
    keys.some(key => syncableKeys.includes(key)) &&
    profile &&
    profile.permissionRole === 'viewer'
  ) {
    wx.showToast({ title: '你当前是只读成员', icon: 'none' })
    return false
  }
  keys.forEach(key => wx.setStorageSync(KEYS[key], values[key]))
  if (keys.some(key => syncableKeys.includes(key))) {
    const cloud = require('./cloud')
    cloud.markLocalChanged()
    cloud.schedulePush()
  }
  return true
}

function clearWeddingData() {
  const localFiles = [
    wx.getStorageSync(KEYS.photo),
    wx.getStorageSync(KEYS.photoOriginal),
    ...(wx.getStorageSync(KEYS.materials) || []).map(item => item.customImage),
    ...(wx.getStorageSync(KEYS.records) || []).reduce((all, item) => all.concat(item.photos || []), [])
  ].filter(filePath => (
    typeof filePath === 'string' &&
    filePath &&
    filePath.indexOf('cloud://') !== 0
  ))
  if (wx.getFileSystemManager) {
    ;[...new Set(localFiles)].forEach(filePath => {
      wx.getFileSystemManager().removeSavedFile({ filePath, fail: () => {} })
    })
  }
  wx.setStorageSync(KEYS.wedding, {})
  wx.setStorageSync(KEYS.tasks, [])
  wx.setStorageSync(KEYS.budgets, [])
  wx.setStorageSync(KEYS.guests, [])
  wx.setStorageSync(KEYS.materials, [])
  wx.setStorageSync(KEYS.records, [])
  wx.setStorageSync(KEYS.photo, '')
  wx.setStorageSync(KEYS.photoOriginal, '')
  wx.setStorageSync(KEYS.photoDisplay, { mode: 'aspectFill' })
  wx.removeStorageSync('xiban_plan_setup_pending')
}

function createId(prefix) {
  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${random}`
}

function createBackup() {
  return {
    app: '囍伴',
    backupVersion: BACKUP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      wedding: get('wedding'),
      tasks: get('tasks'),
      materials: get('materials').map(item => ({ ...item, customImage: '' })),
      budgets: get('budgets'),
      guests: get('guests'),
      records: get('records').map(item => ({ ...item, photos: [] }))
    }
  }
}

function importBackup(backup) {
  if (!backup || backup.app !== '囍伴' || !backup.data || typeof backup.data !== 'object') {
    throw new Error('这不是有效的囍伴备份文件')
  }
  if (Number(backup.backupVersion || 0) > BACKUP_VERSION) {
    throw new Error('备份来自更新版本，请先升级小程序')
  }
  const data = backup.data
  const values = {
    wedding: data.wedding && typeof data.wedding === 'object' ? data.wedding : {},
    tasks: require('./task-plan').enrichTasks(Array.isArray(data.tasks) ? data.tasks : []),
    materials: normalizeMaterials(Array.isArray(data.materials) ? data.materials : []).map(item => ({ ...item, customImage: '' })),
    budgets: normalizeBudgets(Array.isArray(data.budgets) ? data.budgets : []),
    guests: Array.isArray(data.guests) ? data.guests : [],
    records: normalizeRecords(Array.isArray(data.records) ? data.records : []).map(item => ({ ...item, photos: [] }))
  }
  if (!setMany(values)) throw new Error('当前成员没有导入权限')
  return {
    tasks: values.tasks.length,
    materials: values.materials.length,
    budgets: values.budgets.length,
    guests: values.guests.length,
    records: values.records.length
  }
}

module.exports = {
  bootstrap,
  initializeWedding,
  hasWeddingData,
  getRecommendedTasks: getDefaultTasks,
  getDefaultMaterials,
  normalizeMaterials,
  normalizeBudgets,
  normalizeRecords,
  migrateMaterialSelection,
  createBackup,
  importBackup,
  createId,
  clearWeddingData,
  get,
  set,
  setMany
}
