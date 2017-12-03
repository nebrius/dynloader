dyn.register({
  name: 'f',
  loadDependencies: [ 'i', 'ua-parser-js' ],
  onLoad(err, loadDeps, onBackgroundLoad) {
    console.log(`f load with deps: ${Object.keys(loadDeps)}`);
    const parser = new loadDeps['ua-parser-js']();
    console.log(parser.getResult());
    return {};
  }
});
