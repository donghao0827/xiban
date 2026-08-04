Component({
  options: { addGlobalClass: true },
  properties: {
    title: { type: String, value: '' },
    meta: { type: String, value: '' },
    link: { type: String, value: '' },
    dot: { type: Boolean, value: false }
  },
  methods: {
    handleAction() {
      this.triggerEvent('action')
    }
  }
})
