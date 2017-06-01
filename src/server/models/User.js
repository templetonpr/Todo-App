import mongoose from 'mongoose'
import validator from 'validator'
import uniqueValidator from 'mongoose-unique-validator'
import jwt from 'jsonwebtoken'
import _ from 'lodash'
import bcrypt from 'bcryptjs'

import config from './../../config/config.js'
const SECRET_KEY = config.secretKey

const Schema = mongoose.Schema

const User = new Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    unique: true,
    uniqueCaseInsensitive: true,
    validate: {
      validator: v => validator.isEmail(v),
      message: '{VALUE} is not a valid email address',
    },
  },
  password: {
    type: String,
    require: true,
    minlength: 6,
  },
  tokens: [
    {
      access: {
        type: String,
        required: true,
      },
      token: {
        type: String,
        required: true,
      },
    },
  ],
})

User.plugin(uniqueValidator, {
  message: `The email address '{VALUE}' is already in use. Please use a different one.`,
})

User.methods.toJSON = function() {
  let userObject = this.toObject()
  return _.pick(userObject, ['_id', 'email'])
}

User.methods.generateAuthToken = function() {
  let user = this
  let access = 'auth'
  let token = jwt
    .sign({ _id: user._id.toHexString(), access }, SECRET_KEY)
    .toString()
  user.tokens.push({ access, token })
  return user.save().then(() => {
    return token
  })
}

User.statics.findByToken = function(token) {
  let User = this
  let decoded
  try {
    decoded = jwt.verify(token, SECRET_KEY)
  } catch (err) {
    return Promise.reject(err)
  }
  return User.findOne({
    _id: decoded._id,
    'tokens.token': token,
    'tokens.access': 'auth',
  })
}

User.pre('save', function(next) {
  let user = this
  if (user.isModified('password')) {
    bcrypt
      .hash(this.password, 10)
      .then(hash => {
        user.password = hash
        next()
      })
      .catch(err => next(err))
  } else {
    return next()
  }
})

export default mongoose.model('User', User)
