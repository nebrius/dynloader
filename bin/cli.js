const path = require('path');
const run = require('../server/src/server').run;

run(path.join(__dirname, '..', 'examples'));
