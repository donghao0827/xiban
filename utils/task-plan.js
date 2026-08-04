const date = require('./date')

const TEMPLATE_ID = 'general-wedding'
const TEMPLATE_VERSION = 10

const STAGES = [
  '婚礼启动',
  '核心预订',
  '方案确认',
  '集中采购',
  '邀请确认',
  '最终确认',
  '婚礼当天',
  '婚后收尾'
]

const STAGE_DESCRIPTIONS = {
  婚礼启动: '先把婚期、规模、预算和分工想清楚。',
  核心预订: '优先锁定场地和档期紧张的服务团队。',
  方案确认: '逐步确定婚礼当天的样子、人员和礼服。',
  集中采购: '按清单准备婚品，避免遗漏和重复购买。',
  邀请确认: '落实宾客人数、座位和接待安排。',
  最终确认: '让所有参与人员按照同一份流程执行。',
  婚礼当天: '按分工执行，把琐事交给可靠的负责人。',
  婚后收尾: '完成结算、归还、感谢和影像整理。'
}

const CATEGORY_GUIDES = {
  前期规划: '这项决定会影响后续安排，建议双方先沟通清楚并留下统一结论。',
  婚宴场地: '场地通常档期紧张，也会影响桌数、布置和交通，建议尽早确认。',
  婚礼策划: '提前比较服务内容、档期、费用和合同条款，再做最终决定。',
  婚纱摄影: '先确认套餐包含内容、交付周期和额外收费，再安排拍摄。',
  礼服造型: '除了好看，也要确认尺寸、活动便利度、档期和最终试穿时间。',
  婚品采购: '先核对数量和使用场景，再加入婚品清单，避免重复购买。',
  宾客邀请: '宾客变化会影响桌数和预算，建议及时记录并持续更新状态。',
  婚礼流程: '把时间、参与人和负责人说清楚，婚礼当天会轻松很多。',
  交通住宿: '优先确认人数、时间和路线，并为临时变化预留余量。'
}

const CATEGORY_CHECKLISTS = {
  前期规划: ['双方已经达成一致', '结果已记录并同步给相关家人'],
  婚宴场地: ['确认可容纳桌数与档期', '确认费用、服务费和付款节点', '保存合同及联系人'],
  婚礼策划: ['确认服务内容与人员档期', '确认费用和取消变更规则', '保存合同及付款节点'],
  婚纱摄影: ['确认套餐和额外收费', '确认拍摄与交付时间', '保存订单和联系人'],
  礼服造型: ['确认款式、尺寸和使用日期', '确认租赁或购买费用', '预约最终试穿或取件'],
  婚品采购: ['确认实际需要的数量', '加入婚品清单并记录预算', '确认到货或领取时间'],
  宾客邀请: ['与双方家庭核对信息', '更新宾客状态和人数', '记录特殊餐食或接待需求'],
  婚礼流程: ['明确时间和参与人员', '指定具体负责人', '同步给相关人员'],
  交通住宿: ['确认人数和时间', '确认路线或房间安排', '把信息发给相关宾客']
}

function task(id, title, stage, category, idealDaysBefore, options = {}) {
  return {
    id,
    title,
    stage,
    category,
    idealDaysBefore,
    latestDaysBefore: options.latestDaysBefore === undefined
      ? Math.max(0, idealDaysBefore - 30)
      : options.latestDaysBefore,
    level: options.level || 'required',
    guide: options.guide || CATEGORY_GUIDES[category] || '先明确完成标准，再安排负责人和时间。',
    checklist: options.checklist || CATEGORY_CHECKLISTS[category] || ['明确完成标准', '同步给相关人员'],
    condition: options.condition || '',
    relatedType: options.relatedType || '',
    dependencies: options.dependencies || []
  }
}

const GENERAL_TASKS = [
  task('wedding-date', '确定婚礼日期与形式', '婚礼启动', '前期规划', 330, {
    checklist: ['确定婚礼日期与备选日期', '确定举办城市和婚礼形式', '把关键信息同步给双方家庭']
  }),
  task('guest-estimate', '初步确定婚礼规模和宾客人数', '婚礼启动', '宾客邀请', 310, {
    condition: 'event', relatedType: 'guests', checklist: ['双方分别估算邀请人数', '合并并去重宾客', '确定大致桌数或场地容量']
  }),
  task('wedding-budget', '确定婚礼总预算与出资安排', '婚礼启动', '前期规划', 300, {
    relatedType: 'budget', checklist: ['确定可以接受的总预算', '明确双方出资安排', '为场地、服务和婚品预留预算']
  }),
  task('family-roles', '明确筹备分工与家庭沟通方式', '婚礼启动', '前期规划', 290, {
    checklist: ['明确新人主要负责事项', '确认双方父母参与范围', '建立统一沟通和决策方式']
  }),
  task('venue-book', '确定并预订婚宴场地', '核心预订', '婚宴场地', 240, {
    condition: 'banquet', relatedType: 'budget', dependencies: ['guest-estimate'],
    checklist: ['收集并考察备选场地', '比较桌数、菜单、交通和费用', '核对合同、定金和变更规则', '完成预订并保存联系人']
  }),
  task('service-team', '确定婚礼策划与服务团队', '核心预订', '婚礼策划', 195, {
    condition: 'ceremony', relatedType: 'budget',
    checklist: ['确定策划或执行团队', '确定主持、摄影、摄像和化妆人员', '核对服务时长与交付内容', '签订合同并记录付款节点']
  }),
  task('photo-plan', '确定婚纱摄影方案', '核心预订', '婚纱摄影', 180, {
    condition: 'weddingPhoto', relatedType: 'budget', checklist: ['比较摄影机构与客片', '确认套餐和额外收费', '预约拍摄日期', '保存订单与联系人']
  }),
  task('photo-shoot', '完成婚纱照拍摄', '核心预订', '婚纱摄影', 135, {
    condition: 'weddingPhoto', dependencies: ['photo-plan'], checklist: ['确认拍摄服装与场景', '准备拍摄所需物品', '确认拍摄流程和集合时间', '完成拍摄']
  }),
  task('rings', '确定并购买结婚戒指', '核心预订', '礼服造型', 120, {
    relatedType: 'budget', checklist: ['确定款式和预算', '测量并确认尺寸', '完成购买或定制', '检查戒指和取件时间']
  }),

  task('wedding-visual', '确定婚礼主题与布置方案', '方案确认', '婚礼策划', 120, {
    condition: 'ceremony', checklist: ['确定风格、主色调和重点区域', '确认仪式区、迎宾区和签到区', '核对效果图与套餐范围', '确认最终布置方案']
  }),
  task('ceremony-outline', '确定婚礼仪式流程', '方案确认', '婚礼流程', 120, {
    condition: 'ceremony', checklist: ['确定仪式主要环节', '确认入场和退场方式', '确认父母及致辞人员安排', '形成第一版流程']
  }),
  task('couple-outfits', '确定新人及重要成员礼服', '方案确认', '礼服造型', 120, {
    condition: 'ceremony', relatedType: 'materials', checklist: ['确定新娘婚纱与敬酒服', '确定新郎西装与配饰', '确认双方父母礼服', '记录试穿、取件和归还时间']
  }),
  task('makeup-style', '完成试妆并确定婚礼造型', '方案确认', '礼服造型', 90, {
    condition: 'ceremony', checklist: ['预约并完成试妆', '确认妆容和发型', '确定头饰及首饰', '记录当天换妆安排']
  }),
  task('first-guests', '整理并核对正式宾客名单', '方案确认', '宾客邀请', 120, {
    condition: 'event', relatedType: 'guests', checklist: ['与双方父母核对宾客', '按关系完成分组', '记录携带人数和儿童', '记录特殊餐食或接待需求']
  }),
  task('wedding-party', '确定伴郎伴娘及婚礼分工', '方案确认', '婚礼流程', 90, {
    condition: 'ceremony', level: 'optional', checklist: ['确定伴郎伴娘人选', '确认服装安排', '建立沟通群', '明确当天分工和集合时间']
  }),
  task('customs-plan', '确定接亲、敬茶和婚房安排', '方案确认', '婚礼流程', 75, {
    condition: 'pickup', checklist: ['确定接亲流程和参与人员', '确定婚车数量、路线和时间', '确认接亲游戏与所需道具', '确认敬茶人员与顺序', '确定婚房布置范围']
  }),

  task('photo-finish', '完成婚纱照选片并领取成品', '集中采购', '婚纱摄影', 75, {
    condition: 'weddingPhoto', dependencies: ['photo-shoot'], checklist: ['完成选片', '确认精修效果', '确认相册、摆台和迎宾照', '领取并检查成品']
  }),
  task('materials-plan', '建立婚礼用品清单与采购预算', '集中采购', '婚品采购', 60, {
    condition: 'event', relatedType: 'materials', checklist: ['从婚品库选择需要的物品', '确认数量和使用场景', '记录预算和负责人', '确认购买或租赁时间']
  }),
  task('customs-items', '准备接亲、敬茶和婚房用品', '集中采购', '婚品采购', 30, {
    condition: 'pickup', relatedType: 'materials', dependencies: ['customs-plan'], checklist: ['准备接亲游戏和红包', '准备敬茶茶具及相关红包', '准备婚车装饰', '准备婚房布置用品']
  }),
  task('candy-gifts', '准备喜糖、伴手礼和红包用品', '集中采购', '婚品采购', 45, {
    condition: 'event', relatedType: 'materials', checklist: ['确认喜糖和糖盒数量', '按需准备伴手礼', '准备红包袋和不同面额红包', '完成包装和分装']
  }),
  task('invitation-items', '准备请柬、签到和迎宾用品', '集中采购', '宾客邀请', 45, {
    condition: 'event', relatedType: 'materials', dependencies: ['first-guests'], checklist: ['制作电子或纸质请柬', '准备签到本和签到笔', '准备迎宾牌、桌卡或席位卡', '检查姓名、日期和地点']
  }),

  task('send-invites', '正式发送婚礼邀请', '邀请确认', '宾客邀请', 40, {
    condition: 'event', relatedType: 'guests', dependencies: ['invitation-items'], checklist: ['按宾客分组发送邀请', '确认重要宾客已收到', '记录发送和回复状态']
  }),
  task('guest-confirm', '跟进回复并确认最终出席人数', '邀请确认', '宾客邀请', 15, {
    condition: 'event', relatedType: 'guests', dependencies: ['send-invites'], checklist: ['跟进未回复宾客', '确认携带人数和儿童', '更新特殊餐食需求', '统计最终出席人数']
  }),
  task('seating', '完成宾客桌位安排', '邀请确认', '宾客邀请', 10, {
    condition: 'banquet', relatedType: 'guests', dependencies: ['guest-confirm'], checklist: ['按关系和人数安排桌位', '安排双方主桌和重要宾客', '与双方父母核对', '生成最终桌位表']
  }),
  task('guest-hotel', '完成异地宾客住宿与接送安排', '邀请确认', '交通住宿', 20, {
    condition: 'event', level: 'optional', relatedType: 'guests', checklist: ['收集抵达和返程信息', '确认住宿需求', '安排接送车辆或路线', '把安排发送给宾客']
  }),

  task('final-menu', '确认婚宴桌数、菜单和酒水', '最终确认', '婚宴场地', 7, {
    condition: 'banquet', dependencies: ['guest-confirm'], checklist: ['提交最终桌数和备用桌', '确认菜单与特殊餐食', '确认酒水、饮料和开瓶规则', '确认现场服务事项']
  }),
  task('vendor-final', '与婚礼服务团队完成最终沟通', '最终确认', '婚礼策划', 7, {
    condition: 'ceremony', dependencies: ['service-team'], checklist: ['与策划和主持确认流程', '与摄影摄像确认拍摄需求', '与化妆师确认时间和造型', '确认所有人员联系方式']
  }),
  task('day-timeline', '确认婚礼当天时间表和人员分工', '最终确认', '婚礼流程', 7, {
    condition: 'ceremony', dependencies: ['ceremony-outline'], checklist: ['形成完整时间表', '明确新人、父母和协助人员时间', '指定戒指、礼金和物品负责人', '同步给所有参与人员']
  }),
  task('ceremony-content', '准备誓词、音乐和影像素材', '最终确认', '婚礼流程', 10, {
    condition: 'ceremony', checklist: ['完成新人誓词', '确认各环节音乐', '准备需要播放的照片和视频', '检查文件格式并做好备份']
  }),
  task('final-fitting', '完成新人礼服最终试穿', '最终确认', '礼服造型', 7, {
    condition: 'ceremony', dependencies: ['couple-outfits'], checklist: ['完成新人礼服试穿', '检查尺寸和活动便利度', '准备鞋子、首饰及配件', '确认取件、保管和归还安排']
  }),
  task('room-decorate', '完成婚房布置', '最终确认', '婚品采购', 2, {
    condition: 'pickup', level: 'optional', relatedType: 'materials', dependencies: ['customs-items'], checklist: ['清洁并整理婚房', '完成床品和喜字布置', '检查装饰牢固与安全', '收好剩余用品']
  }),
  task('rehearsal', '完成婚礼彩排', '最终确认', '婚礼流程', 2, {
    condition: 'ceremony', level: 'optional', dependencies: ['day-timeline'], checklist: ['确认参与彩排人员', '走一遍入场和仪式流程', '检查音乐、灯光和道具', '记录并修正问题']
  }),
  task('final-pack', '完成婚礼当天物品打包与核对', '最终确认', '婚礼流程', 1, {
    condition: 'event', relatedType: 'materials', checklist: ['按环节打包并贴标签', '核对戒指、礼服、证件和红包', '核对合同与待付款项', '把物品交给对应负责人']
  }),

  task('day-ready', '确认人员、车辆、场地和供应商到位', '婚礼当天', '婚礼流程', 0, {
    condition: 'event', checklist: ['确认新人和双方父母状态', '确认工作人员及供应商到场', '确认婚车和场地准备完成', '确认重要物品负责人']
  }),
  task('wedding-day', '完成婚礼当天流程并清点物品', '婚礼当天', '婚礼流程', 0, {
    condition: 'event', dependencies: ['day-ready'], checklist: ['按照时间表完成各环节', '完成签到、仪式和敬酒', '核对当天付款', '结束后清点重要物品']
  }),

  task('settle-payments', '结算尾款并核对最终支出', '婚后收尾', '其他事项', -3, {
    condition: 'event', relatedType: 'budget', checklist: ['结算供应商尾款', '核对新增和临时费用', '更新实际支出', '保存付款凭证']
  }),
  task('return-items', '归还租赁礼服和婚礼物品', '婚后收尾', '礼服造型', -3, {
    condition: 'ceremony', checklist: ['清点待归还物品', '按约定时间完成归还', '确认押金退回', '处理损坏或遗失问题']
  }),
  task('gift-thanks', '整理礼金并向亲友表达感谢', '婚后收尾', '宾客邀请', -5, {
    condition: 'event', checklist: ['核对礼金记录', '感谢亲友及婚礼协助人员', '妥善保存礼金和重要信息']
  }),
  task('wedding-media', '整理婚礼照片、视频和重要资料', '婚后收尾', '婚礼策划', -20, {
    condition: 'ceremony', checklist: ['备份婚礼照片和视频', '确认精修与成片交付', '整理合同和重要资料', '保存值得纪念的内容']
  })
]

const TEMPLATES = [
  {
    id: TEMPLATE_ID,
    version: TEMPLATE_VERSION,
    name: '帮我规划',
    description: '适合不熟悉备婚流程的新人，回答几个问题后自动生成计划',
    taskCount: GENERAL_TASKS.length
  },
  {
    id: 'custom',
    version: 1,
    name: '自己规划',
    description: '适合已经有清晰安排的新人，从空清单开始自由添加',
    taskCount: 0
  }
]

function addDays(value, days) {
  const result = new Date(value)
  result.setDate(result.getDate() + days)
  return result
}

function getDueDate(item, weddingDate, todayValue = new Date()) {
  const today = new Date(date.formatDate(todayValue))
  const wedding = new Date(weddingDate)
  const idealDate = addDays(wedding, -item.idealDaysBefore)
  if (idealDate >= today || item.idealDaysBefore < 0) return date.formatDate(idealDate)

  const remaining = Math.max(0, date.daysBetween(today, wedding))
  if (!remaining) return date.formatDate(today)
  const maxLead = 330
  const position = Math.max(0, Math.min(1, 1 - Math.max(0, item.idealDaysBefore) / maxLead))
  const available = Math.max(0, remaining - 1)
  return date.formatDate(addDays(today, Math.round(available * position)))
}

function stripTaskAssignment(item) {
  const { owner, assigneeId, assigneeIds, ...task } = item
  return task
}

function getTemplateTasks(templateId, options = {}) {
  if (templateId === 'custom') return []
  const conditions = options.conditions || {}
  return GENERAL_TASKS.filter(item => {
    if (!item.condition) return true
    if (item.condition === 'event') return Boolean(conditions.banquet || conditions.ceremony)
    return Boolean(conditions[item.condition])
  })
}

function generatePlan({ templateId, weddingDate, conditions = {}, completedIds = [] }) {
  const completed = new Set(completedIds)
  return getTemplateTasks(templateId, { conditions }).map((item, index) => ({
    id: `tpl_${item.id}`,
    templateTaskId: item.id,
    templateVersion: TEMPLATE_VERSION,
    title: item.title,
    stage: item.stage,
    category: item.category,
    dueDate: getDueDate(item, weddingDate),
    done: completed.has(item.id),
    status: completed.has(item.id) ? 'completed' : 'active',
    completedAt: completed.has(item.id) ? date.formatDate(new Date()) : '',
    priority: item.level === 'required' ? 'key' : item.level,
    level: item.level,
    guide: item.guide,
    checklist: item.checklist,
    relatedType: item.relatedType,
    dependencies: item.dependencies,
    source: 'template',
    manualDueDate: false,
    sortOrder: index
  }))
}

function replanTasks(tasks, weddingDate) {
  const templateMap = GENERAL_TASKS.reduce((map, item) => {
    map[item.id] = item
    return map
  }, {})
  return (tasks || []).map(item => {
    const template = templateMap[item.templateTaskId]
    if (!template || item.source !== 'template' || item.done || item.status === 'skipped' || item.manualDueDate) return item
    return { ...item, dueDate: getDueDate(template, weddingDate) }
  })
}

function enrichTasks(tasks) {
  const templateMap = GENERAL_TASKS.reduce((map, item) => {
    map[item.id] = item
    return map
  }, {})
  return (tasks || []).map(rawItem => {
    const item = stripTaskAssignment(rawItem)
    if (item.category === '婚礼服务') item.category = '婚礼策划'
    const template = templateMap[item.templateTaskId]
    const status = item.status || (item.done ? 'completed' : 'active')
    if (!template) return { ...item, status }
    return {
      ...item,
      stage: item.stage || template.stage,
      category: template.category,
      level: item.level || template.level,
      priority: item.priority || (template.level === 'required' ? 'key' : template.level),
      guide: item.guide || template.guide,
      checklist: Array.isArray(item.checklist) && item.checklist.length ? item.checklist : template.checklist,
      dependencies: item.dependencies || template.dependencies,
      status,
      templateVersion: TEMPLATE_VERSION
    }
  })
}

function reconcilePlan({ tasks = [], templateId, weddingDate, conditions = {} }) {
  const generatedTasks = generatePlan({ templateId, weddingDate, conditions })
  const existingTemplateMap = (tasks || []).reduce((map, item) => {
    if (item.templateTaskId) map[item.templateTaskId] = item
    return map
  }, {})
  const reconciledTemplates = generatedTasks.map(item => {
    const existing = existingTemplateMap[item.templateTaskId]
    if (!existing) return item
    const done = Boolean(existing.done)
    const status = existing.status === 'skipped'
      ? 'skipped'
      : done ? 'completed' : 'active'
    return {
      ...item,
      id: existing.id || item.id,
      dueDate: existing.manualDueDate ? existing.dueDate : item.dueDate,
      manualDueDate: Boolean(existing.manualDueDate),
      done,
      status,
      completedAt: done ? (existing.completedAt || date.formatDate(new Date())) : '',
      templateVersion: TEMPLATE_VERSION
    }
  })
  const userTasks = (tasks || []).filter(item => !item.templateTaskId || item.source === 'user')
  return reconciledTemplates.concat(userTasks.map(item => {
    const task = stripTaskAssignment(item)
    return { ...task, source: task.source || 'user' }
  }))
}

function getPlanSummary(templateId, conditions) {
  const tasks = getTemplateTasks(templateId, { conditions })
  return {
    count: tasks.length,
    stages: [...new Set(tasks.map(item => item.stage))].length,
    keyCount: tasks.filter(item => item.level === 'required').length,
    detailCount: tasks.reduce((total, item) => total + (item.checklist || []).length, 0),
    optionalCount: tasks.filter(item => item.level === 'optional').length
  }
}

module.exports = {
  TEMPLATES,
  STAGES,
  STAGE_DESCRIPTIONS,
  GENERAL_TASKS,
  TEMPLATE_VERSION,
  generatePlan,
  reconcilePlan,
  replanTasks,
  enrichTasks,
  getPlanSummary
}
