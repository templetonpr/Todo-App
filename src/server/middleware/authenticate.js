import User from './../models/User.js'

let authenticate = (req, res, next) => {
  let token = req.header('x-auth')
  User.findByToken(token)
    .then(user => {
      if (!user) throw new Error('User not found')
      req.user = user
      return next()
    })
    .catch(err => {
      err.status = 401
      return next(err)
    })
}

export default authenticate
