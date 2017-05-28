import express from 'express'

const route = new express.Router()

route.get('/', (req, res, next) => {
  return res.send('Hello World!')
})

export default route
