dyn({
  name: 'app',
  init: [ 'a' ],
  onLoad(initDeps) {
    function print() {
      initDeps.a.printState();
      setTimeout(print, 100);
    }
    print();
    return {};
  }
});