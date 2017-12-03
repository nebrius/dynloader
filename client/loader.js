let moduleInfo;

window.dyn = {
  init,
  load
};

function init(c) {
  moduleInfo = c;
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
  const depsToVisit = [ ...modNames ];
  while (true) {
    const depToParse = depsToVisit.shift();
    if (!depToParse) {
      break;
    }
    const moduleDefinition = moduleInfo[depToParse];
    if (!moduleDefinition) {
      throw new Error(`Unknown module ${depToParse}`);
    }
    depsToLoad.push(depToParse);
    depsToVisit.push(...moduleDefinition.loadDependencies.filter((loadDep) => depsToLoad.indexOf(loadDep) === -1));
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
    fetchModules(depsToFetch, (err, moduleData) => {
      if (err) {
        onLoad(err);
        return;
      }

      const lazyDepsToLoad = [];
      const depsWithLazyDeps = [];
      function loadDep(depName) {
        const moduleCode = moduleData[depName];
        let mod;
        window.dyn.register = (spec) => {
          mod = spec;
        };
        eval(moduleCode);
        delete window.dyn.register;
        const loadDeps = {};
        if (mod.loadDependencies) {
          for (const loadDepName of mod.loadDependencies) {
            if (!mods[loadDepName]) {
              loadDep(loadDepName);
            }
            loadDeps[loadDepName] = mods[loadDepName].value;
          }
        }
        if (mod.lazyDependencies) {
          depsWithLazyDeps.push(moduleInfo[depName]);
          lazyDepsToLoad.push(...mod.lazyDependencies);
        }
        mods[depName] = {
          spec: moduleInfo[depName],
          onBackgroundLoad: undefined
        }
        mods[depName].value = mod.onLoad(undefined, loadDeps, (listener) => mods[depName].onBackgroundLoad = listener);
      }
      depsToFetch.forEach(loadDep);

      onFetchComplete();

      if (!lazyDepsToLoad.length) {
        return;
      }
      setTimeout(() => {
        load(lazyDepsToLoad, (err, deps, onBackgroundLoad) => {
          for (const dep of depsWithLazyDeps) {
            const onBackgroundLoad = mods[dep.name].onBackgroundLoad;
            if (dep.lazyDependencies && onBackgroundLoad) {
              if (err) {
                onBackgroundLoad(err, undefined);
              } else {
                const deps = {};
                for (const depSpec of dep.lazyDependencies) {
                  deps[depSpec] = mods[depSpec].value;
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
