'use strict'

const pkg = require('../package.json')

// setup local (repeatable) tasks
require('./bin/procedures')

module.exports = (req, res) => {
  console.log(JSON.stringify(req))
  res.end(JSON.stringify(pkg))
}
