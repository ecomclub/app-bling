'use strict'

const bodyParser = require('body-parser')
const express = require('express')
const app = express()
const port = process.env.PORT || 3000
const logger = require('console-files')

logger.log(process.env)

require('./bin/uncaughtException')

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(require('./lib/routes'))
app.listen(port)

//
require('./lib/app-manager')
