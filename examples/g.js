({
  name: 'g',
  backgroundDeps: [ 'h', 'i' ],
  onLoad() {
    console.log('g load');
    return {};
  }
});
