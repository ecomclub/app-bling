'use strict'
const triggers = require('express').Router()

module.exports = application => {
  const { mysql, ecomAuth, Bling } = application
  triggers.post('/ecomplus', require('../methods/ecomplus-triggers')({ mysql, ecomAuth, Bling }))
  triggers.post('/bling', require('../methods/bling-triggers')({ mysql, ecomAuth }))
  return triggers
}
