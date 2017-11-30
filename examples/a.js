({
  name: 'a',
  loadDeps: [ 'b' ],
  backgroundDeps: [ 'c' ],
  onLoad(err, { b }, onBackgroundLoad) {
    console.log('a load');
    let c;
    onBackgroundLoad((err, { c: cdep }) => {
      console.log('a background');
      c = cdep;
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
