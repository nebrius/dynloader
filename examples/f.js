({
  name: 'f',
  loadDeps: [ 'i' ],
  onLoad(err, loadDeps, onBackgroundLoad) {
    console.log(`f load with deps: ${Object.keys(loadDeps)}`);
    return {};
  }
});
