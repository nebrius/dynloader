dyn.register({
  name: 'b',
  lazyDependencies: [ 'd' ],
  onLoad(err, loadDeps, onBackgroundLoad) {
    console.log(`b load with deps: ${Object.keys(loadDeps)}`);
    onBackgroundLoad((err, backgroundDeps) => {
      console.log(`b background with deps: ${Object.keys(backgroundDeps)}`);
    });
    return {
      getName() {
        return 'Phillip J. Fry'
      }
    };
  }
});
