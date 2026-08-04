Component({
  options: { multipleSlots: true, addGlobalClass: true },
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '' },
    subtitle: { type: String, value: '' },
    fixedHeight: { type: Boolean, value: false }
  },
  methods: {
    close() { this.triggerEvent('close') },
    stop() {}
  }
})
