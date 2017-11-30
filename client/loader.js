let config;

window.dyn = {
  init,
  load
};

function init(c) {
  config = c;
}

const mods = {};

function fetchModules(moduleList, cb) {
  const loadModules = JSON.stringify(moduleList);
  fetch(`/dyn/load?modules=${loadModules}`)
    .then((res) => res.json())
    // Break out of the promise to get usable exceptions and reasonable debugging
    .then((moduleData) => setTimeout(() => cb(undefined, moduleData)))
    .catch((err) => setTimeout(() => cb(err, undefined)));
}

function load(modNames, cb) {
  if (!Array.isArray(modNames)) {
    modNames = [ modNames ];
  }
  const depsToLoad = [];
  for (const modName of modNames) {
    if (!config[modName]) {
      throw new Error(`Unknown module ${modName}`);
    }
    function visitNode(node) {
      for (const loadDep of node.loadDeps) {
        visitNode(loadDep);
      }
      depsToLoad.push(node);
    }
    visitNode(config[modName]);
  }

  function onFetchComplete() {
    const deps = {};
    for (const modName of modNames) {
      deps[modName] = mods[modName].value;
    }
    cb(undefined, deps);
  }

  const depsToFetch = depsToLoad.filter((depName) => !mods.hasOwnProperty(depName));
  if (!depsToFetch.length) {
    onFetchComplete();
  } else {
    fetchModules(depsToFetch.map((dep) => dep.name), (err, moduleData) => {
      if (err) {
        onLoad(err);
        return;
      }

      const backgroundDepsToLoad = [];
      const depsWithBackgroundDeps = [];
      function loadDep(depName) {
        const moduleCode = moduleData[depName];
        const mod = eval(moduleCode);
        const loadDeps = {};
        if (mod.loadDeps) {
          for (const loadDepName of mod.loadDeps) {
            if (!mods[loadDepName]) {
              loadDep(loadDepName);
            }
            loadDeps[loadDepName] = mods[loadDepName].value;
          }
        }
        if (mod.backgroundDeps) {
          depsWithBackgroundDeps.push(config[depName]);
          backgroundDepsToLoad.push(...mod.backgroundDeps);
        }
        mods[depName] = {
          spec: config[depName],
          onBackgroundLoad: undefined
        }
        mods[depName].value = mod.onLoad(undefined, loadDeps, (listener) => mods[depName].onBackgroundLoad = listener);
      }
      depsToFetch.map((dep) => dep.name).forEach(loadDep);

      onFetchComplete();

      if (!backgroundDepsToLoad.length) {
        return;
      }
      setTimeout(() => {
        load(backgroundDepsToLoad, (err, deps, onBackgroundLoad) => {
          for (const dep of depsWithBackgroundDeps) {
            const onBackgroundLoad = mods[dep.name].onBackgroundLoad;
            if (dep.backgroundDeps && onBackgroundLoad) {
              if (err) {
                onBackgroundLoad(err, undefined);
              } else {
                const deps = {};
                for (const depSpec of dep.backgroundDeps) {
                  deps[depSpec.name] = mods[depSpec.name].value;
                }
                onBackgroundLoad(undefined, deps);
              }
            }
          }
        });
      });
    });
  }
}
