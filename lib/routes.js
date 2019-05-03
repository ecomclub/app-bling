'use strict'

const router = require('express').Router()
const pkg = require('../package.json')

module.exports = ({ ecomAuth, mysql, Bling, db }) => {
  router.use('/callback', require('./routes/callback')({ db, ecomAuth }))
  router.use('/triggers', require('./routes/triggers')({ ecomAuth, Bling, mysql }))
  // show package.json on domain root
  router.get('/', (req, res) => res.send(pkg))
  return router
}
