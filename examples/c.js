({
  name: 'c',
  loadDeps: [ 'e' ],
  backgroundDeps: [ 'f', 'g' ],
  onLoad(err, { e, f }, onBackgroundLoad) {
    console.log('c load');
    onBackgroundLoad((err, { g }) => {
      console.log('c background');
    });
    return {
      getName() {
        return 'Bender Bending Rodriguez'
      }
    };
  }
});
