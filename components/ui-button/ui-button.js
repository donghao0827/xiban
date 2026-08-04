Component({
  options: { addGlobalClass: true },
  properties: {
    text: { type: String, value: '确定' },
    type: { type: String, value: 'primary' },
    size: { type: String, value: 'large' },
    icon: { type: String, value: '' },
    block: { type: Boolean, value: true },
    disabled: { type: Boolean, value: false }
  },
  methods: {
    handleTap() {
      if (!this.data.disabled) this.triggerEvent('action')
    }
  }
})
