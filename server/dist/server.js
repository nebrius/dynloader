"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const express = require("express");
const handlebars_1 = require("handlebars");
const parser_1 = require("./parser");
function run(projectPath) {
    parser_1.getProjectInfo(projectPath, (err, projectInfo) => {
        if (err || !projectInfo) {
            process.exit(-1);
            return;
        }
        const modules = projectInfo.modules;
        const template = handlebars_1.compile(fs_1.readFileSync(path_1.join(__dirname, '..', '..', 'templates', 'index.handlebars'), 'utf-8'));
        const moduleInfo = {};
        for (const depName in modules) {
            moduleInfo[depName] = {
                name: depName,
                loadDependencies: modules[depName].loadDependencyNames,
                lazyDependencies: modules[depName].lazyDependencyNames
            };
        }
        const index = template({
            moduleInfo: JSON.stringify(moduleInfo)
        });
        const app = express();
        app.use(express.static(path_1.join(__dirname, '..', '..', 'client')));
        app.get('/', (req, res) => {
            res.send(index);
        });
        app.get('/dyn/load', (req, res) => {
            const depNames = JSON.parse(req.query.modules);
            const deps = {};
            for (const depName of depNames) {
                if (!moduleInfo[depName]) {
                    res.send(400);
                    return;
                }
                deps[depName] = modules[depName].source;
            }
            res.send(deps);
        });
        app.listen(3000, () => {
            console.log('Server listening on port 3000!');
        });
    });
}
exports.run = run;
//# sourceMappingURL=server.js.map