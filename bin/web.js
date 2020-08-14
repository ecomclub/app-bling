#!/usr/bin/env node

'use strict'

// log to files
const logger = require('console-files')
// handle app authentication to Store API
// https://github.com/ecomplus/application-sdk
const { ecomAuth, ecomServerIps } = require('@ecomplus/application-sdk')
const ecomClient = require('@ecomplus/client')

// web server with Express
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const cors = require('cors')
const router = express.Router()
const port = process.env.PORT || 3000
const path = require('path')

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(cors())

app.use((req, res, next) => {
  if (req.url.startsWith('/ecom/')) {
    // get E-Com Plus Store ID from request header
    req.storeId = parseInt(req.get('x-store-id'), 10)
    if (req.url.startsWith('/ecom/modules/')) {
      // request from Mods API
      // https://github.com/ecomclub/modules-api
      const { body } = req
      if (typeof body !== 'object' || body === null || !body.params || !body.application) {
        return res.status(406).send('Request not comming from Mods API? Invalid body')
      }
    }

    // on production check if request is comming from E-Com Plus servers
    if (process.env.NODE_ENV === 'production' && ecomServerIps.indexOf(req.get('x-real-ip')) === -1) {
      return res.status(403).send('Who are you? Unauthorized IP address')
    }
  }

  // pass to the endpoint handler
  // next Express middleware
  next()
})

ecomAuth.then(appSdk => {
  // setup app routes
  const routes = './../routes'
  router.get('/', require(`${routes}/`)())

    // base routes for E-Com Plus Store API
    ;['auth-callback'].forEach(endpoint => {
      let filename = `/ecom/${endpoint}`
      router.post(filename, require(`${routes}${filename}`)(appSdk))
    })

  const blingClient = require('./../lib/bling/client')
  const getConfig = require('./../lib/store-api/get-config')
  const database = require('./../lib/database')

  const appParams = { appSdk, logger, blingClient, getConfig, database, ecomClient }

  // webhook ecom :$
  router.post('/ecom/webhook', require('./../routes/ecom/webhook')(appParams))

  /* Add custom app routes here */
  router.post('/bling/webhook', require('./../routes/bling/webhook')(appSdk, database))

  // todo
  // - depreciar as rotas abaixo
  router.post('/bling/products', require('./../routes/bling/products')(appParams))
  router.post('/ecomplus/products', require('./../routes/ecom/products')(appParams))
  router.post('/ecomplus/orders', require('./../routes/ecom/orders')(appParams))
  router.post('/ecomplus/stock', require('./../routes/ecom/stock')(appParams))
  // -

  router.post('/api/products/stock', require('../routes/api/products/stock')(appParams))
  router.post('/api/products/bling', require('../routes/api/products/bling')(appParams))
  router.post('/api/products/ecom', require('../routes/api/products/ecom')(appParams))
  router.post('/api/orders/bling', require('../routes/api/orders/bling')(appParams))
  router.get('/api/products', require('../routes/api/products/find')(appParams))
  router.get('/api/products/:id', require('../routes/api/products/find')(appParams))
  router.delete('/api/products/:id', require('./../routes/api/products/delete')(appParams))
  router.post('/authenticate', require('./../routes/api/authenticate')(appParams))

  // api middleware
  app.use(async (req, res, next) => {
    if (req.url.startsWith('/api/')) {
      // get E-Com Plus Store ID from request header
      req.storeId = parseInt(req.get('x-store-id'), 10)
      req.storeSecret = req.get('x-store-secret')

      if (!req.storeId || !req.storeSecret) {
        return res.status(406).send({
          status: 406,
          message: 'X-Store-Id e X-Store-Secrete são obrigatórios, acesse essa página via admin https://admin.e-com.plus'
        })
      }

      try {
        req.appConfig = await getConfig({ appSdk, storeId: req.storeId }, true)
      } catch (error) {
        return res.status(500).send({
          status: 500,
          message: 'Get appConfig error',
          error
        })
      }

      if (req.appConfig.store_secret !== req.storeSecret || req.storeSecret.length !== 32) {
        return res.status(401).send({
          status: 401,
          message: 'X-Store-Secret inválido.'
        })
      }

      if (req.method === 'POST' && !req.appConfig.bling_api_key) {
        res.status(409)
        return res.send({
          error: 'Unauthorized',
          message: 'Configure o campo bling_api_key no aplicativo instalado em https://admin.e-com.plus.'
        })
      }

      if (req.method === 'POST' && !req.body || typeof req.body === 'undefined') {
        res.status(400)
        return res.send({
          error: 'Body inválid.',
          message: 'Body inválido'
        })
      }
    }

    next()
  })

  app.use(express.static('assets'))
  router.get('/app/', function (req, res) {
    return res.sendFile(path.join(__dirname, '../assets', 'index.html'))
  })

  // add router and start web server
  app.use(router)
  app.listen(port)
  logger.log(`--> Starting web app on port :${port}`)
})

ecomAuth.catch(err => {
  logger.error(err)
  setTimeout(() => {
    // destroy Node process while Store API auth cannot be handled
    process.exit(1)
  }, 1100)
})
