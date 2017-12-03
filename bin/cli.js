const path = require('path');
const run = require('../server/dist/server').run;

run(path.join(__dirname, '..', 'examples'));
