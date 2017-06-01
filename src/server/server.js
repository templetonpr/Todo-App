import path from 'path'

import express from 'express'
import bodyParser from 'body-parser'
import mongoose from 'mongoose'

import indexRoute from './routes/index.js'
import todoRoute from './routes/todos.js'

const app = express()

// configuration
import config from '../config/config.js'
const PORT = config.port
app.set('PORT', PORT)

app.use(bodyParser.json())

const DB_URL = config.db
if (!DB_URL) throw new Error('Database not found')
mongoose.Promise = global.Promise
mongoose.connect(DB_URL)

// routes
app.use('/', indexRoute)
app.use('/todos', todoRoute)

// catch 404 and forward to error handler
app.use((req, res, next) => {
  var err = new Error('Not Found')
  err.status = 404
  next(err)
})

// set meaningful error status
app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') err.status = 400
  next(err)
})

// development error handler - will print stacktrace
if (app.get('env') === 'development') {
  app.use((err, req, res, next) => {
    res.status(err.status || 500)
    res.json({
      message: err.message,
      error: err,
      status: err.status || 500,
    })
  })
}

// production error handler - no stacktraces leaked to user
app.use((err, req, res, next) => {
  res.status(err.status || 500)
  res.json({
    message: err.message,
    status: err.status || 500,
  })
})

export default app

app.listen(PORT, err => {
  if (err) return console.error(err)
  console.log(
    `Express server running on port ${app.get('PORT')} with ${app.get('env')} configuration`
  )
})
