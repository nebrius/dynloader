({
  name: 'c',
  loadDeps: [ 'e', 'f' ],
  onLoad() {
    console.log('c load');
    return {
      getName() {
        return 'Bender Bending Rodriguez'
      }
    };
  }
});
