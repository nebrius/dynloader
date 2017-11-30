({
  name: 'g',
  loadDeps: [ 'h', 'i' ],
  onLoad() {
    console.log('g load');
    return {};
  }
});
