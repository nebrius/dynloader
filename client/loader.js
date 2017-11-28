const depCache = {};

window.dyn = dyn;
window.dyn.load = load;

function dyn(mod) {
  // Goal is to call onLoad and onBackgroundLoad at the end of everything
}

function load(modName, onLoad) {
  fetch(`/dyn/load?module=${modName}`)
    .then((res) => res.json())
    .then((data) => {
      onLoad(undefined, data);
      setTimeout(() => background(modName));
    })
    .catch((err) => onLoad(err, undefined));
}

function background(modName) {
  fetch(`/dyn/background?module=${modName}`)
    .then((res) => res.json())
    .then((data) => {

    })
    .catch()
}
