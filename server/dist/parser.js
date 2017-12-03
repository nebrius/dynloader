"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const esprima_1 = require("esprima");
const path_1 = require("path");
const fs_1 = require("fs");
const os_1 = require("os");
const webpack = require("webpack");
const async_1 = require("async");
const TEMP_DIR = path_1.join(os_1.tmpdir(), 'dynloader');
console.log(TEMP_DIR);
if (!fs_1.existsSync(TEMP_DIR)) {
    fs_1.mkdirSync(TEMP_DIR);
}
function dictionaryToArray(dictionary) {
    const results = [];
    for (const propName in dictionary) {
        results.push(dictionary[propName]);
    }
    return results;
}
function getCompileNodeModuleSource(name, projectPath, cb) {
    const wrapperBuildPath = path_1.join(TEMP_DIR, `${name}.js`);
    function finalize() {
        fs_1.readFile(wrapperBuildPath, 'utf-8', (err, fileContents) => {
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
    fs_1.exists(wrapperBuildPath, (exists) => {
        if (exists) {
            finalize();
            return;
        }
        const wrapperSource = `
dyn.register({
  name: '${name}',
  onLoad(err, loadDeps, onBackgroundLoad) {
    return require('${name}');
  }
});
`;
        const wrapperSourcePath = path_1.join(projectPath, `_node_module_wrapper_${name}.js`);
        fs_1.writeFile(wrapperSourcePath, wrapperSource, (err) => {
            webpack({
                entry: wrapperSourcePath,
                output: {
                    filename: `${name}.js`,
                    path: TEMP_DIR
                }
            }, (err, stats) => {
                fs_1.unlink(wrapperSourcePath, (unlinkErr) => {
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
function parseModuleSource(filePath, cb) {
    fs_1.readFile(filePath, 'utf-8', (err, fileContents) => {
        const ast = esprima_1.parseScript(fileContents, {
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
            declaration.expression.callee.type !== 'MemberExpression' ||
            declaration.expression.callee.object.type !== 'Identifier' ||
            declaration.expression.callee.object.name !== 'dyn' ||
            declaration.expression.callee.property.type !== 'Identifier' ||
            declaration.expression.callee.property.name !== 'register') {
            printNotDynModule('Expected a single call to dyn.register()');
            return;
        }
        if (declaration.expression.arguments.length !== 1) {
            printNotDynModule('Expected a single object argument to dyn.register()');
            return;
        }
        const spec = declaration.expression.arguments[0];
        if (spec.type !== 'ObjectExpression') {
            printNotDynModule('Expected a single object argument to dyn.register()');
            return;
        }
        function getProperty(name) {
            const prop = spec.properties.filter((property) => {
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
function assembleModuleDependencies(partialModuleDefinition, projectInfo, cb) {
    function getModuleDependencyInfo(depedencyName, cb) {
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
            });
            return;
        }
        throw new Error(`Unknown or missing dependency "${depedencyName}"`);
    }
    // Fill in links to dependencies
    const assembleModuleDependencyTasks = {};
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
    async_1.parallel(assembleModuleDependencyTasks, cb);
}
function getProjectInfo(projectPath, cb) {
    const fileList = [];
    function searchDir(dirPath) {
        const files = fs_1.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path_1.join(dirPath, file);
            const fileStats = fs_1.statSync(filePath);
            if (fileStats.isDirectory()) {
                if (file !== 'node_modules') {
                    searchDir(filePath);
                }
            }
            else if (path_1.extname(file) === '.js') {
                fileList.push(filePath);
            }
        }
    }
    searchDir(projectPath);
    const projectInfo = {
        projectPath,
        projectPackageJson: JSON.parse(fs_1.readFileSync(path_1.join(projectPath, 'package.json'), 'utf-8')),
        modules: {}
    };
    const parseModuleDefinitionTasks = {};
    for (const filePath of fileList) {
        parseModuleDefinitionTasks[path_1.basename(filePath, '.js')] = (next) => parseModuleSource(filePath, next);
    }
    async_1.parallel(parseModuleDefinitionTasks, (err, results) => {
        if (err) {
            cb(err, undefined);
            return;
        }
        if (!results) {
            throw new Error('Internal error: "results" and "err" are both undefined');
        }
        const moduleDefinitions = {};
        for (const moduleFileName in results) {
            const moduleDefinition = results[moduleFileName];
            if (!moduleDefinition) {
                throw new Error('Internal Error: one of the module definitions was undefined');
            }
            moduleDefinitions[moduleDefinition.name] = moduleDefinition;
        }
        projectInfo.modules = moduleDefinitions;
        // Check for circular dependencies
        function cycleCheck(node, path) {
            if (!node) {
                return;
            }
            const children = [...node.loadDependencyNames, ...node.lazyDependencyNames];
            for (const child of children) {
                if (path.indexOf(child) !== -1) {
                    throw new Error(`Cyclic dependency detected! Module ${node.name} has a dependency ${child} that is also a parent!`);
                }
                cycleCheck(moduleDefinitions[child], [...path, child]);
            }
        }
        for (const moduleName in moduleDefinitions) {
            cycleCheck(moduleDefinitions[moduleName], [moduleName]);
        }
        // Fill in the dependency info
        const assembleModuleDependencyTasks = {};
        for (const moduleDefinitionName in moduleDefinitions) {
            assembleModuleDependencyTasks[moduleDefinitionName] =
                (next) => assembleModuleDependencies(moduleDefinitions[moduleDefinitionName], projectInfo, next);
        }
        async_1.parallel(assembleModuleDependencyTasks, (err) => {
            if (err) {
                cb(err, undefined);
                return;
            }
            cb(undefined, projectInfo);
        });
    });
}
exports.getProjectInfo = getProjectInfo;
//# sourceMappingURL=parser.js.map