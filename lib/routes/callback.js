'use strict'
const callback = require('express').Router()
/**
 * @description handle ecomplus callbacks
 */
module.exports = ({ db, ecomAuth }) => {
  callback.post('', require('../methods/callbacks-haddle')({ db, ecomAuth }))
  return callback
}
