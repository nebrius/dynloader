dyn({
  name: 'a',
  loadDeps: [ 'b' ],
  backgroundDeps: [ 'c' ],
  onLoad(loadDeps, onBackgroundLoad) {
    let getName;
    onBackgroundLoad((backgroundDeps) => {
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
