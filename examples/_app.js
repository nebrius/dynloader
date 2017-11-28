dyn.load('a', (err, deps) => {
  function print() {
    loadDeps.a.printState();
    setTimeout(print, 100);
  }
  print();
});
