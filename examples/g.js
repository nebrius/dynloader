({
  name: 'g',
  loadDeps: [ 'h', 'i' ],
  onLoad(err, loadDeps, onBackgroundLoad) {
    console.log(`g load with deps: ${Object.keys(loadDeps)}`);
    return {};
  }
});
