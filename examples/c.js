({
  name: 'c',
  loadDeps: [ 'e' ],
  backgroundDeps: [ 'f', 'g' ],
  onLoad(err, loadDeps, onBackgroundLoad) {
    console.log(`c load with deps: ${Object.keys(loadDeps)}`);
    onBackgroundLoad((err, backgroundDeps) => {
      console.log(`c background with deps: ${Object.keys(backgroundDeps)}`);
    });
    return {
      getName() {
        return 'Bender Bending Rodriguez'
      }
    };
  }
});
