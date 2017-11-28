const esprima = require('esprima');
const path = require('path');
const fs = require('fs');

module.exports = {
  updateProject
};

function updateProject(projectPath) {

  const fileList = [];
  function searchDir(dirPath) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const fileStats = fs.statSync(filePath);
      if (fileStats.isDirectory()) {
        searchDir(filePath);
      } else if (path.extname(file) === '.js') {
        fileList.push(filePath);
      }
    }
  }
  searchDir(projectPath);

  const deps = {};
  fileList.forEach((filePath) => {
    const ast = esprima.parseScript(fs.readFileSync(filePath, 'utf-8'), {
      loc: true,
      comment: true
    });
    function printNotDynModule(msg) {
      console.warn(`File ${filePath} does not appear to be a dyn module: ${msg}`);
    }
    if (ast.body.length !== 1) {
      printNotDynModule('Found more than one top-level statement');
      return;
    }
    const declaration = ast.body[0];
    if (declaration.type !== 'ExpressionStatement' ||
      declaration.expression.type !== 'CallExpression' ||
      declaration.expression.callee.name !== 'dyn'
    ) {
      printNotDynModule('Expected a function call to "dyn"');
      return;
    }
    if (declaration.expression.arguments.length !== 1 ||
      declaration.expression.arguments[0].type !== 'ObjectExpression'
    ) {
      printNotDynModule('Expected a single object argument to "dyn"');
      return;
    }
    const spec = declaration.expression.arguments[0].properties;

    function getProperty(name) {
      const prop = spec.filter((property) => {
        return property.key.name === name;
      });
      if (prop.length > 1) {
        throw new Error(`More than one "${name}" property defined`);
      }
      return prop[0] && prop[0].value;
    }

    const nameProperty = getProperty('name');
    if (!nameProperty) {
      printNotDynModule(`Missing module name`);
      return;
    }
    if (nameProperty.type !== 'Literal' || typeof nameProperty.value !== 'string') {
      printNotDynModule('Module name must be a string literal');
      return;
    }
    const name = nameProperty.value;

    const loadDepsProperty = getProperty('loadDeps');
    const loadDepNames = [];
    if (loadDepsProperty) {
      for (const element of loadDepsProperty.elements) {
        if (element.type !== 'Literal' || typeof element.value !== 'string') {
          printNotDynModule('Dependency name must be a string literal');
          return;
        }
        loadDepNames.push(element.value);
      }
    }

    const backgroundDepsProperty = getProperty('backgroundDeps', true);
    const backgroundDepNames = [];
    if (backgroundDepsProperty) {
      for (const element of backgroundDepsProperty.elements) {
        if (element.type !== 'Literal' || typeof element.value !== 'string') {
          printNotDynModule('Dependency name must be a string literal');
          return;
        }
        backgroundDepNames.push(element.value);
      }
    }

    // Make sure onLoad exists, but don't do anything with it
    getProperty('onLoad', false);

    // Create the dependency entry, if one doesn't already exist
    if (deps[name]) {
      throw new Error(`Duplicate module name "${name}"`);
    }
    deps[name] = {
      name,
      loadDepNames,
      backgroundDepNames,
      loadDeps: [],
      backgroundDeps: [],
      flattenedLoadDeps: [],
      flattenedBackgroundDeps: []
    };
  });

  // Fill in links to dependencies
  for (const depName in deps) {
    const dep = deps[depName];
    dep.loadDeps = dep.loadDepNames.map((loadDepName) => {
      if (!deps[loadDepName]) {
        throw new Error(`Unknown dependency "${loadDepName}"`);
      }
      return deps[loadDepName];
    });
    dep.backgroundDeps = dep.backgroundDepNames.map((backgroundDepName) => {
      if (!deps[backgroundDepName]) {
        throw new Error(`Unknown dependency "${backgroundDepName}"`);
      }
      return deps[backgroundDepName];
    });
  }

  // Check for circular dependencies
  for (const depName in deps) {
    const visitedDependencies = [];
    const visitStack = [ deps[depName] ];
    while (true) {
      const nextDep = visitStack.shift();
      if (!nextDep) {
        break;
      }
      if (visitedDependencies.indexOf(nextDep.name) !== -1) {
        throw new Error(`Dependency ${nextDep.name} is in a circular dependency chain`);
      }
      visitedDependencies.push(nextDep.name);
      visitStack.push(...nextDep.loadDeps);
      visitStack.push(...nextDep.backgroundDeps);
    }
  }

  // Generate the flattened dep lists for each module
  for (const depName in deps) {
    const dep = deps[depName];
    const loadDepStack = [ ...dep.loadDeps ];
    const backgroundDepStack = [ ...dep.backgroundDeps ];
    while (true) {
      const nextDep = loadDepStack.shift();
      if (!nextDep) {
        break;
      }
      dep.flattenedLoadDeps.push(nextDep);
      loadDepStack.push(...nextDep.loadDeps);
      backgroundDepStack.push(...nextDep.backgroundDeps);
    }
    while (true) {
      const nextDep = backgroundDepStack.shift();
      if (!nextDep) {
        break;
      }
      dep.flattenedBackgroundDeps.push(nextDep);
      backgroundDepStack.push(...nextDep.loadDeps);
      backgroundDepStack.push(...nextDep.backgroundDeps);
    }
  }

  for (const depName in deps) {
    const dep = deps[depName];
    console.log(`${depName}:`);
    if (dep.flattenedLoadDeps.length) {
      console.log(`  Load deps: ${dep.flattenedLoadDeps.map((dep) => dep.name).join(',')}`);
    }
    if (dep.flattenedBackgroundDeps.length) {
      console.log(`  Background deps: ${dep.flattenedBackgroundDeps.map((dep) => dep.name).join(',')}`);
    }
  }
}
