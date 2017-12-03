dyn.register({
  name: 'd',
  onLoad(err, loadDeps, onBackgroundLoad) {
    console.log(`d load with deps: ${Object.keys(loadDeps)}`);
    return {};
  }
});
