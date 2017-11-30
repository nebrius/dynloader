({
  name: 'i',
  loadDeps: [ 'c' ],
  onLoad() {
    console.log('i load');
    return {};
  }
});
