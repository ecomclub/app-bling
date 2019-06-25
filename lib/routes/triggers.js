'use strict'
const triggers = require('express').Router()

module.exports = application => {
  const { mysql, ecomAuth, Bling, db } = application
  triggers.post('/ecomplus', require('../methods/ecomplus-triggers')({ mysql, ecomAuth, Bling, db }))
  triggers.post('/bling', require('../methods/bling-triggers')({ mysql, ecomAuth }))
  return triggers
}
