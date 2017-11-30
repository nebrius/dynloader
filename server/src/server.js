const fs = require('fs');
const path = require('path');
const express = require('express');
const handlebars = require('handlebars');
const getModuleInfo = require('./parser').getModuleInfo;

module.exports = {
  run
};

function run(projectPath) {

  const moduleInfo = getModuleInfo(projectPath);
  const template = handlebars.compile(fs.readFileSync(path.join(__dirname, '..', '..', 'templates', 'index.handlebars'), 'utf-8'));
  const index = template({
    moduleInfo: JSON.stringify(moduleInfo)
  });

  const app = express();
  app.use(express.static(path.join(__dirname, '..', '..', 'client')));

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
      deps[depName] = fs.readFileSync(moduleInfo[depName].filePath, 'utf-8');
    }
    res.send(deps);
  });

  app.listen(3000, () => {
    console.log('Server listening on port 3000!');
  });
}
