import { parseScript, Syntax } from 'esprima';
import { join, extname, basename } from 'path';
import { existsSync, mkdirSync, readdirSync, readFileSync, readFile, writeFile, exists, unlink, statSync } from 'fs';
import { tmpdir } from 'os';
import * as webpack from 'webpack';
import { parallel, AsyncFunction, Dictionary } from 'async';
import { ObjectExpression } from 'estree';

const TEMP_DIR = join(tmpdir(), 'dynloader');
console.log(TEMP_DIR);
if (!existsSync(TEMP_DIR)) {
  mkdirSync(TEMP_DIR);
}

interface ICB<T> {
  (err?: Error | undefined, result?: T | undefined): void;
}

export interface IProjectInfo {
  projectPath: string;
  projectPackageJson: { [ key: string ]: any };
  modules: { [ moduleName: string ]: IModuleInfo }
}

export interface IModuleInfo {
  name: string;
  source: string;
  loadDependencyNames: string[];
  loadDependencies: { [ moduleName: string ]: IModuleInfo };
  lazyDependencyNames: string[];
  lazyDependencies: { [ moduleName: string ]: IModuleInfo };
}

function dictionaryToArray<T>(dictionary: { [ propName: string ]: T }): T[] {
  const results: T[] = [];
  for (const propName in dictionary) {
    results.push(dictionary[propName]);
  }
  return results;
}

function getCompileNodeModuleSource(name: string, projectPath: string, cb: ICB<IModuleInfo>): void {
  const wrapperBuildPath = join(TEMP_DIR, `${name}.js`);
  function finalize() {
    readFile(wrapperBuildPath, 'utf-8', (err, fileContents) => {
      if (err) {
        cb(err, undefined);
        return;
      }
      cb(undefined, {
        name,
        source: fileContents,
        loadDependencyNames: [],
        loadDependencies: {},
        lazyDependencyNames: [],
        lazyDependencies: {}
      });
    });
  }

  exists(wrapperBuildPath, (exists) => {
    if (exists) {
      finalize();
      return;
    }
    const wrapperSource =
`
dyn.register({
  name: '${name}',
  onLoad(err, loadDeps, onBackgroundLoad) {
    return require('${name}');
  }
});
`;
    const wrapperSourcePath = join(projectPath, `_node_module_wrapper_${name}.js`);
    writeFile(wrapperSourcePath, wrapperSource, (err) => {
      webpack({
        entry: wrapperSourcePath,
        output: {
          filename: `${name}.js`,
          path: TEMP_DIR
        }
      }, (err, stats) => {
        unlink(wrapperSourcePath, (unlinkErr) => {
          if (err || stats.hasErrors()) {
            cb(err || stats.toJson().errors, undefined);
            return;
          }
          finalize();
        });
      });
    });
  });
}

function parseModuleSource(filePath: string, cb: ICB<IModuleInfo>): void {
  readFile(filePath, 'utf-8', (err, fileContents) => {
    const ast = parseScript(fileContents, {
      loc: true,
      comment: true
    });
    function printNotDynModule(msg: string): void {
      console.warn(`File ${filePath} does not appear to be a dyn module: ${msg}`);
    }
    if (ast.body.length !== 1) {
      printNotDynModule('Found more than one top-level statement');
      return;
    }
    const declaration = ast.body[0];
    if (declaration.type !== 'ExpressionStatement' ||
      declaration.expression.type !== 'CallExpression' ||
      declaration.expression.callee.type !== 'MemberExpression' ||
      declaration.expression.callee.object.type !== 'Identifier' ||
      declaration.expression.callee.object.name !== 'dyn' ||
      declaration.expression.callee.property.type !== 'Identifier' ||
      declaration.expression.callee.property.name !== 'register'
    ) {
      printNotDynModule('Expected a single call to dyn.register()');
      return;
    }
    if (declaration.expression.arguments.length !== 1) {
      printNotDynModule('Expected a single object argument to dyn.register()');
      return;
    }
    const spec = <ObjectExpression>declaration.expression.arguments[0];
    if (spec.type !== 'ObjectExpression') {
      printNotDynModule('Expected a single object argument to dyn.register()');
      return;
    }

    function getProperty(name: string) {
      const prop = spec.properties.filter((property) => {
        return (<any>property).key.name === name;
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

    const loadDependenciesProperty = getProperty('loadDependencies');
    const loadDependencyNames = [];
    if (loadDependenciesProperty) {
      if (loadDependenciesProperty.type !== 'ArrayExpression') {
        printNotDynModule('Load Dependencies must be an array');
        return;
      }
      for (const element of loadDependenciesProperty.elements) {
        if (element.type !== 'Literal' || typeof element.value !== 'string') {
          printNotDynModule('Dependency name must be a string literal');
          return;
        }
        loadDependencyNames.push(element.value);
      }
    }

    const lazyDependenciesProperty = getProperty('lazyDependencies');
    const lazyDependencyNames = [];
    if (lazyDependenciesProperty) {
      if (lazyDependenciesProperty.type !== 'ArrayExpression') {
        printNotDynModule('Lazy Dependencies must be an array');
        return;
      }
      for (const element of lazyDependenciesProperty.elements) {
        if (element.type !== 'Literal' || typeof element.value !== 'string') {
          printNotDynModule('Dependency name must be a string literal');
          return;
        }
        lazyDependencyNames.push(element.value);
      }
    }

    // Make sure onLoad exists, but don't do anything with it
    getProperty('onLoad');

    cb(undefined, {
      name,
      source: fileContents,
      loadDependencyNames,
      loadDependencies: {},
      lazyDependencyNames,
      lazyDependencies: {}
    });
  });
}

function assembleModuleDependencies(
  partialModuleDefinition: IModuleInfo,
  projectInfo: IProjectInfo,
  cb: (err: Error | undefined) => void
): void {

  function getModuleDependencyInfo(depedencyName: string, cb: ICB<IModuleInfo>): void {
    if (projectInfo.modules[depedencyName]) {
      cb(undefined, projectInfo.modules[depedencyName]);
      return;
    }
    if (projectInfo.projectPackageJson.dependencies && projectInfo.projectPackageJson.dependencies[depedencyName]) {
      getCompileNodeModuleSource(depedencyName, projectInfo.projectPath, (err, moduleInfo) => {
        if (err || !moduleInfo) {
          cb(err, undefined);
          return;
        }
        cb(undefined, moduleInfo);
      })
      return;
    }
    throw new Error(`Unknown or missing dependency "${depedencyName}"`);
  }

  // Fill in links to dependencies
  const assembleModuleDependencyTasks: Dictionary<AsyncFunction<IModuleInfo, Error>> = {};
  for (const loadDependencyName of partialModuleDefinition.loadDependencyNames) {
    assembleModuleDependencyTasks[loadDependencyName] = (next) => {
      getModuleDependencyInfo(loadDependencyName, (err, moduleInfo) => {
        if (err) {
          next(err, undefined);
          return;
        }
        if (!moduleInfo) {
          throw new Error('Internal Error: "err" and "moduleInfo" are both undefined');
        }
        partialModuleDefinition.loadDependencies[loadDependencyName] = moduleInfo;
        if (!projectInfo.modules[loadDependencyName]) {
          projectInfo.modules[loadDependencyName] = moduleInfo;
        }
        next();
      });
    };
  }
  for (const lazyDependencyName of partialModuleDefinition.lazyDependencyNames) {
    assembleModuleDependencyTasks[lazyDependencyName] = (next) => {
      getModuleDependencyInfo(lazyDependencyName, (err, moduleInfo) => {
        if (err) {
          next(err, undefined);
          return;
        }
        if (!moduleInfo) {
          throw new Error('Internal Error: "err" and "moduleInfo" are both undefined');
        }
        partialModuleDefinition.lazyDependencies[lazyDependencyName] = moduleInfo;
        if (!projectInfo.modules[lazyDependencyName]) {
          projectInfo.modules[lazyDependencyName] = moduleInfo;
        }
        next();
      });
    };
  }
  parallel(assembleModuleDependencyTasks, cb);
}

export function getProjectInfo(projectPath: string, cb: ICB<IProjectInfo>): void {

  const fileList: string[] = [];
  function searchDir(dirPath: string): void {
    const files = readdirSync(dirPath);
    for (const file of files) {
      const filePath = join(dirPath, file);
      const fileStats = statSync(filePath);
      if (fileStats.isDirectory()) {
        if (file !== 'node_modules') {
          searchDir(filePath);
        }
      } else if (extname(file) === '.js') {
        fileList.push(filePath);
      }
    }
  }
  searchDir(projectPath);

  const projectInfo: IProjectInfo = {
    projectPath,
    projectPackageJson: JSON.parse(readFileSync(join(projectPath, 'package.json'), 'utf-8')),
    modules: {}
  };

  const parseModuleDefinitionTasks: Dictionary<AsyncFunction<IModuleInfo, Error>> = {};
  for (const filePath of fileList) {
    parseModuleDefinitionTasks[basename(filePath, '.js')] = (next) => parseModuleSource(filePath, next);
  }
  parallel(parseModuleDefinitionTasks, (err: Error | undefined, results: Dictionary<IModuleInfo | undefined>) => {
    if (err) {
      cb(err, undefined);
      return;
    }
    if (!results) {
      throw new Error('Internal error: "results" and "err" are both undefined');
    }
    const moduleDefinitions: { [ moduleName: string ]: IModuleInfo } = {};
    for (const moduleFileName in results) {
      const moduleDefinition = results[moduleFileName];
      if (!moduleDefinition) {
        throw new Error('Internal Error: one of the module definitions was undefined');
      }
      moduleDefinitions[moduleDefinition.name] = moduleDefinition;
    }
    projectInfo.modules = moduleDefinitions;

    // Check for circular dependencies
    function cycleCheck(node: IModuleInfo | undefined, path: string[]): void {
      if (!node) {
        return;
      }
      const children = [ ...node.loadDependencyNames, ...node.lazyDependencyNames ];
      for (const child of children) {
        if (path.indexOf(child) !== -1) {
          throw new Error(`Cyclic dependency detected! Module ${node.name} has a dependency ${child} that is also a parent!`);
        }
        cycleCheck(moduleDefinitions[child], [ ...path, child ]);
      }
    }
    for (const moduleName in moduleDefinitions) {
      cycleCheck(moduleDefinitions[moduleName], [ moduleName ]);
    }

    // Fill in the dependency info
    const assembleModuleDependencyTasks: Dictionary<AsyncFunction<IModuleInfo, Error>> = {};
    for (const moduleDefinitionName in moduleDefinitions) {
      assembleModuleDependencyTasks[moduleDefinitionName] =
        (next) => assembleModuleDependencies(moduleDefinitions[moduleDefinitionName], projectInfo, next);
    }
    parallel(assembleModuleDependencyTasks, (err: Error | undefined) => {
      if (err) {
        cb(err, undefined);
        return;
      }
      cb(undefined, projectInfo);
    });
  });
}
