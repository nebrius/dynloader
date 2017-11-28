dyn({
  name: 'b',
  backgroundDeps: [ 'd' ],
  onLoad(initDeps) {
    return {
      getName() {
        return 'Phillip J. Fry'
      }
    };
  }
});
