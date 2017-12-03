import { readFileSync } from 'fs';
import { join } from 'path';
import * as express from 'express';
import { compile } from 'handlebars';
import { getProjectInfo } from './parser';

export function run(projectPath: string): void {

  getProjectInfo(projectPath, (err, projectInfo) => {
    if (err || !projectInfo) {
      process.exit(-1);
      return;
    }
    const modules = projectInfo.modules;
    const template = compile(readFileSync(join(__dirname, '..', '..', 'templates', 'index.handlebars'), 'utf-8'));
    const moduleInfo: { [ depName: string ]: {} } = {};
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
    app.use(express.static(join(__dirname, '..', '..', 'client')));

    app.get('/', (req, res) => {
      res.send(index);
    });

    app.get('/dyn/load', (req, res) => {
      const depNames = JSON.parse(req.query.modules);
      const deps: { [ moduleName: string ]: string } = {};
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
