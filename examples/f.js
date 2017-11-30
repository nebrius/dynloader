({
  name: 'f',
  loadDeps: [ 'i' ],
  onLoad() {
    console.log('f load');
    return {};
  }
});
