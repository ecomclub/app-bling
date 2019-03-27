'use strict'

const pkg = require('../package.json')

module.exports = (req, res) => {
  res.end(JSON.stringify(pkg))
}
