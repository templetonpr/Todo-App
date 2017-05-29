import express from 'express'
import { ObjectID } from 'mongodb'
import _ from 'lodash'

import Todo from '../models/Todo.js'

const route = new express.Router()

route.get('/', (req, res, next) => {
  Todo.find()
    .then(todos => {
      return res.json({ todos })
    })
    .catch(err => {
      next(err)
    })
})

route.post('/', (req, res, next) => {
  let text = req.body.text
  let todo = new Todo({ text: text })
  todo
    .save()
    .then(todo => {
      return res.json({ todo })
    })
    .catch(err => {
      next(err)
    })
})

route.get('/:id', (req, res, next) => {
  let id = req.params.id

  if (!ObjectID.isValid(id)) {
    let err = new Error('Invalid ID format')
    err.status = 400
    return next(err)
  }

  Todo.findById(id)
    .then(todo => {
      if (!todo) return res.status(404).json({})
      return res.json({ todo })
    })
    .catch(err => {
      err.status = 400
      next(err)
    })
})

route.patch('/:id', (req, res, next) => {
  let id = req.params.id
  let body = _.pick(req.body, ['text', 'completed'])

  if (!ObjectID.isValid(id)) {
    let err = new Error('Invalid ID format')
    err.status = 400
    return next(err)
  }

  if (_.isBoolean(body.completed) && body.completed) {
    body.completedAt = Date.now()
  } else {
    body.completed = false
    body.completedAt = null
  }

  Todo.findByIdAndUpdate(id, { $set: body }, { new: true })
    .then(todo => {
      if (!todo) return res.status(404).json({})
      return res.json({ todo })
    })
    .catch(err => {
      next(err)
    })
})

route.delete('/:id', (req, res, next) => {
  let id = req.params.id

  if (!ObjectID.isValid(id)) {
    let err = new Error('Invalid ID format')
    err.status = 400
    return next(err)
  }

  Todo.findByIdAndRemove(id)
    .then(todo => {
      if (!todo) return res.status(404).json({})
      return res.json({ todo })
    })
    .catch(err => {
      next(err)
    })
})

export default route
