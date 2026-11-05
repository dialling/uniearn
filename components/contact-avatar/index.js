Component({
  properties: {
    name: { type: String, value: '', observer: 'updateInitial' }
  },
  data: { initial: 'U' },
  methods: {
    updateInitial(name) {
      this.setData({ initial: Array.from(String(name || '').trim() || 'U')[0].toUpperCase() });
    }
  }
});
