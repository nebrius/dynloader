dyn({
  name: 'b',
  onLoad(initDeps) {
    return {
      getName() {
        return 'Phillip J. Fry'
      }
    };
  }
});