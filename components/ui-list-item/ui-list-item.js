Component({
  options: { multipleSlots: true, addGlobalClass: true },
  properties: {
    title: { type: String, value: '' },
    description: { type: String, value: '' },
    icon: { type: String, value: '' },
    tone: { type: String, value: 'pink' },
    arrow: { type: Boolean, value: true },
    divider: { type: Boolean, value: true }
  },
  methods: {
    handleTap() { this.triggerEvent('tap') }
  }
})
