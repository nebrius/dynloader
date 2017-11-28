const depCache = {};

window.dyn = ({ name, init, background, onLoad }) => {
  console.debug(`Registering module ${name}`);
  depCache[name] = { init, background, onLoad };
  // Goal is to call onLoad at the end of everything
};