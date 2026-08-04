Component({
  properties: {
    icon: { type: String, value: 'heart' },
    title: { type: String, value: '暂时没有内容' },
    description: { type: String, value: '点击右下角开始添加' },
    actionText: { type: String, value: '' }
  },
  methods: {
    handleAction() {
      this.triggerEvent('action')
    }
  }
})
