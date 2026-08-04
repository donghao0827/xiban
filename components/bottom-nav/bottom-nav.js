const routes = [
  '/pages/home/home',
  '/pages/budget/budget',
  '/pages/today/today',
  '/pages/guests/guests',
  '/pages/profile/profile'
]

Component({
  properties: {
    current: {
      type: Number,
      value: 0
    }
  },
  data: {
    items: [
      { label: '首页', icon: 'nav-home', activeIcon: 'nav-home-active' },
      { label: '预算', icon: 'nav-budget', activeIcon: 'nav-budget-active' },
      { label: '备婚', art: 'cloud://prod-d0gfyfw705426c497.7072-prod-d0gfyfw705426c497-1458425791/assets/illustrations/journey-heart.png', center: true },
      { label: '宾客', icon: 'nav-guests', activeIcon: 'nav-guests-active' },
      { label: '我的', icon: 'nav-profile', activeIcon: 'nav-profile-active' }
    ]
  },
  methods: {
    navigate(event) {
      const index = Number(event.currentTarget.dataset.index)
      if (index === this.data.current) return
      wx.redirectTo({ url: routes[index] })
    }
  }
})
