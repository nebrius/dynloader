const path = require('path');
const updateProject = require('../src/index').updateProject;

updateProject(path.join(__dirname, '..', 'examples'));
