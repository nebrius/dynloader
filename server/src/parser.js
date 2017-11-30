const esprima = require('esprima');
const path = require('path');
const fs = require('fs');

module.exports = {
  getModuleInfo
};

function getModuleInfo(projectPath) {

  const fileList = [];
  function searchDir(dirPath) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const fileStats = fs.statSync(filePath);
      if (fileStats.isDirectory()) {
        if (file !== 'node_modules') {
          searchDir(filePath);
        }
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
      declaration.expression.type !== 'ObjectExpression'
    ) {
      printNotDynModule('Expected a single object expression, e.g. ({ ... })');
      return;
    }
    const spec = declaration.expression.properties;

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
      filePath,
      loadDepNames,
      backgroundDepNames,
      loadDeps: [],
      backgroundDeps: []
    };
  });

  // Fill in links to dependencies
  for (const depName in deps) {
    const dep = deps[depName];
    dep.loadDeps = dep.loadDepNames.map((loadDepName) => {
      if (!deps[loadDepName]) {
        if (fs.existsSync(path.join(projectPath, 'node_modules', loadDepName))) {
          console.log('node_modules module');
          // TODO
        } else {
          throw new Error(`Unknown or missing dependency "${loadDepName}"`);
        }
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
  // TODO: need to do a full DFS to do this properly, skipping for now
  function cycleCheck(node, path) {
    const children = [ ...node.loadDeps, ...node.backgroundDeps ];
    for (const child of children) {
      if (path.indexOf(child.name) !== -1) {
        throw new Error(`Cyclic dependency detected! Module ${node.name} has a dependency ${child.name} that is also a parent!`);
      }
      cycleCheck(child, [ ...path, child.name ]);
    }
  }
  for (const depName in deps) {
    cycleCheck(deps[depName], [ depName ]);
  }

  return deps;
}
