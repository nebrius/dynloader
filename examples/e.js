dyn.register({
  name: 'e',
  onLoad(err, loadDeps, onBackgroundLoad) {
    console.log(`e load with deps: ${Object.keys(loadDeps)}`);
    return {};
  }
});
