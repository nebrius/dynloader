({
  name: 'b',
  backgroundDeps: [ 'd' ],
  onLoad(initDeps) {
    console.log('b load');
    return {
      getName() {
        return 'Phillip J. Fry'
      }
    };
  }
});
