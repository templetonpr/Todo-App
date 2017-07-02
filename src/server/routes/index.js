import express from 'express'
import _ from 'lodash'

import authenticate from './../middleware/authenticate.js'
import User from './../models/User.js'

const route = new express.Router()

route.get('/', (req, res, next) => {
  return res.send('Hello World!')
})

route.post('/users', (req, res, next) => {
  let body = _.pick(req.body, ['email', 'password'])
  let user = new User(body)
  user
    .save()
    .then(() => user.generateAuthToken())
    .then(token => {
      return res.status(201).header('x-auth', token).json({ user })
    })
    .catch(err => {
      if (err.name === 'ValidationError') err.status = 400
      return next(err)
    })
})

route.post('/users/login', (req, res, next) => {
  let { email, password } = _.pick(req.body, ['email', 'password'])
  User.findByCredentials(email, password)
    .then(user => {
      return user
        .generateAuthToken()
        .then(token => res.status(200).header('x-auth', token).json({ user }))
    })
    .catch(err => {
      err.status = 400
      return next(err)
    })
})

route.get('/users/me', authenticate, (req, res, next) => {
  return res.json({ user: req.user })
})

export default route
