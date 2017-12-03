dyn.register({
  name: 'h',
  onLoad(err, loadDeps, onBackgroundLoad) {
    console.log(`h load with deps: ${Object.keys(loadDeps)}`);
    return {};
  }
});
