({
  name: 'i',
  onLoad(err, loadDeps, onBackgroundLoad) {
    console.log(`i load with deps: ${Object.keys(loadDeps)}`);
    return {};
  }
});
