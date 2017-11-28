dyn({
  name: 'a',
  init: [ 'async' ],
  background: [ 'b' ],
  onLoad(initDeps, onBackgroundDepsLoaded) {
    let getName;
    onBackgroundDepsLoaded((backgroundDeps) => {
      getName = backgroundDeps.b.getName;
    });
    return {
      printState() {
        if (getName) {
          console.log(getName());
        } else {
          console.log('Name not yet loaded');
        }
      }
    };
  }
});