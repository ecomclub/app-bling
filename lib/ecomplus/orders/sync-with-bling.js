'use strict'
// logger
const logger = require('console-files')

// ecomClinet
const ecomClient = require('@ecomplus/client')

// mysql abstract
const database = require('../../database')

// get instances of stores
const getStores = require('../../get-stores')

// bling client
const blingClient = require('./../../../lib/bling/client')

// get stores
const MapStores = require('./../../map-stores')

// api schema
const { blingOrderSchema } = require('./../../../lib/schemas/orders')

module.exports = appSdk => {
  logger.log('<< Synchronization of orders with Bling started.')

  
}