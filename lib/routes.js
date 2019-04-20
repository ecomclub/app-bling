
'use strict'

const router = require('express').Router()
const pkg = require('../package.json')

router.use('/callback', require('./routes/callback'))
router.use('/triggers', require('./routes/triggers'))

// show package.json on domain root
router.get('/', (req, res) => res.send(pkg))

module.exports = router
