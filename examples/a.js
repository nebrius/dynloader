({
  name: 'a',
  loadDeps: [ 'b' ],
  backgroundDeps: [ 'c' ],
  onLoad(err, loadDeps, onBackgroundLoad) {
    const b = loadDeps.b;
    console.log(`a load with deps: ${Object.keys(loadDeps)}`);
    let c;
    onBackgroundLoad((err, backgroundDeps) => {
      console.log(`a background with deps: ${Object.keys(backgroundDeps)}`);
      c = backgroundDeps.c;
    });
    return {
      printState() {
        if (c) {
          console.log(`${b.getName()} ${c.getName()}`);
        } else {
          console.log('Name not yet loaded');
        }
      }
    };
  }
})
