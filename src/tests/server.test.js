import path from 'path'

import expect from 'expect'
import request from 'supertest'

import { MongoClient, ObjectID } from 'mongodb'
import { populateUsers, populateTodos, dropDB } from './seedDatabase.js'

// import config settings
import config from '../config/config.js'

// immediately exit if not using 'test' env to prevent accidentally ruining the wrong database
if (config.env !== 'test') {
  throw new Error("NODE_ENV must be set to 'test' for testing")
  process.exit(1)
}

import app from '../server/server.js'
import Todo from '../server/models/Todo.js'
import User from '../server/models/User.js'

describe('Server', () => {
  it('should start server and accept http requests', done => {
    request(app).get('/').expect(200).end((err, res) => {
      if (err) return done(err)
      return done()
    })
  })
})

describe('Todos API', () => {
  let todos = []

  beforeEach(done => {
    dropDB(config.db)
      .then(() => populateTodos(Todo))
      .then(ts => (todos = ts))
      .then(() => done())
      .catch(err => done(err))
  })

  describe('POST /todos', () => {
    it('should create a new todo with POST /todos', done => {
      let text = 'test todo test'
      request(app)
        .post('/todos')
        .send({ text })
        .expect(201)
        .expect(res => {
          expect(res.body.todo.text).toBe(text)
        })
        .end((err, res) => {
          if (err) return done(err)
          let id = res.body.todo._id
          Todo.findById(id)
            .then(todo => {
              expect(todo.text).toBe(text)
              return done()
            })
            .catch(err => done(err))
        })
    })

    it('should not create a new todo when invalid data is passed', done => {
      let text = ''
      let count = Todo.find().length
      request(app).post('/todos').send({ text }).expect(400).end((err, res) => {
        if (err) return done(err)
        expect(Todo.find().length).toBe(count)
        return done()
      })
    })
  })

  describe('GET /todos', () => {
    it('should retrieve all todos with GET /todos', done => {
      request(app)
        .get('/todos')
        .expect(res => {
          expect(res.body.todos.length).toBe(3)
        })
        .expect(200, done)
    })
  })

  describe('GET /todos/:id', () => {
    it('should retrieve a todo with GET /todos/:id', done => {
      let { id, text } = todos[0]
      request(app)
        .get(`/todos/${id}`)
        .expect(res => {
          expect(res.body.todo.text).toExist()
          expect(res.body.todo.text).toEqual(text)
        })
        .expect(200, done)
    })

    it('should return 404 if :id was not found', done => {
      let id = new ObjectID().toHexString()
      request(app).get(`/todos/${id}`).expect(404, done)
    })

    it('should return 400 if :id was invalid', done => {
      let id = '12345asdf'
      request(app)
        .get(`/todos/${id}`)
        .expect(res => {
          expect(res.body.message).toBe('Invalid ID format')
        })
        .expect(400, done)
    })
  })

  describe('PATCH /todos/:id', () => {
    it('should modify the text property of a todo', done => {
      request(app)
        .patch(`/todos/${todos[0]._id}`)
        .send({ text: 'modified' })
        .expect(200)
        .expect(res => {
          expect(res.body.todo.text).toExist()
          expect(res.body.todo.text).toBe('modified')
        })
        .end((err, res) => {
          if (err) return done(err)
          Todo.findById(todos[0]._id).then(todo => {
            expect(todo.text).toBe('modified')
            return done()
          })
        })
    })

    it('should set the completed and completedAt properties when completing a todo', done => {
      request(app)
        .patch(`/todos/${todos[1]._id}`)
        .send({ completed: true })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          Todo.findById(todos[1]._id)
            .then(todo => {
              expect(todo.completed).toBe(true)
              expect(todo.completedAt).toBeA('number')
              return done()
            })
            .catch(err => done(err))
        })
    })

    it('should clear completedAt when todo.completed === false', done => {
      request(app)
        .patch(`/todos/${todos[1]._id}`)
        .send({ completed: false })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.todo.completed).toBe(false)
          expect(res.body.todo.completedAt).toBe(null)
          return done()
        })
    })

    it('should return 400 if :id is invalid', done => {
      let id = 'zzzzzzzzzzzzz'
      request(app)
        .patch(`/todos/${id}`)
        .send({ text: 'modified' })
        .expect(400, done)
    })

    it('should return 404 if :id was not found', done => {
      let id = new ObjectID().toHexString()
      request(app)
        .patch(`/todos/${id}`)
        .send({ text: 'modified' })
        .expect(404, done)
    })
  })

  describe('DELETE /todos/:id', () => {
    it('should delete a todo with DELETE /todos/:id', done => {
      request(app)
        .delete(`/todos/${todos[0]._id}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          Todo.findById(todos[0]._id).then(todo => {
            expect(todo).toNotExist()
            return done()
          })
        })
    })

    it('should return 404 if :id was not found', done => {
      let id = new ObjectID().toHexString()
      request(app).delete(`/todos/${id}`).expect(404, done)
    })

    it('should return 400 if :id is invalid', done => {
      let id = 'qqwerqwerqwerrewq'
      request(app).delete(`/todos/${id}`).expect(400, done)
    })
  })
})

describe('Authentication API', () => {
  let users = []

  beforeEach(done => {
    dropDB(config.db)
      .then(() => populateUsers(User))
      .then(us => (users = us))
      .then(() => done())
      .catch(err => done(err))
  })

  describe('POST /users', () => {
    it('should create a new user', done => {
      let email = 'test@test.test'
      let password = 'hunter2'
      let token
      request(app)
        .post('/users')
        .send({ email, password })
        .expect(201)
        .expect(res => {
          expect(res.body.user.email).toBe(email)
          expect(res.body.user._id).toExist()
          expect(res.headers['x-auth']).toExist()
          token = res.headers['x-auth']
        })
        .end((err, res) => {
          if (err) return done(err)
          let id = res.body.user._id
          User.findById(id)
            .then(user => {
              expect(user.email).toBe(email)
              let t = user.tokens.filter(token => token.access === 'auth')[0]
              expect(t.token).toBe(token)
              return done()
            })
            .catch(err => done(err))
        })
    })

    it('should return an error if email is taken', done => {
      let email = 'test123@test.test'
      let password = '123123123123'

      User.create({ email, password }).then(() => {
        request(app)
          .post('/users')
          .send({ email, password })
          .expect(400)
          .expect(res => {
            expect(res.body.message).toBe(
              `User validation failed: email: The email address '${email}' is already in use. Please use a different one.`
            )
          })
          .then(() => done())
          .catch(err => done(err))
      })
    })

    it('should return an error if email validation fails', done => {
      request(app)
        .post('/users')
        .send({ email: 'test1@test', password: 'hunter2' }) // email is missing TLD
        .expect(400)
        .expect(res => {
          expect(res.body.message).toBe(
            'User validation failed: email: test1@test is not a valid email address'
          )
        })
        .end(done)
    })

    it('should not store the unhashed password in the database', done => {
      let email = 'test12345@test.test'
      let password = '123123123123'

      request(app)
        .post('/users')
        .send({ email, password })
        .expect(201)
        .then(res => res.body.user._id)
        .then(id => User.findById(id))
        .then(u => {
          expect(u.password).toNotBe(password)
          expect(u.password).toExist()
        })
        .then(() => done())
        .catch(err => done(err))
    })
  })

  describe('GET /users/me', () => {
    it('should correctly parse jwt for valid user', done => {
      let t = users[0].tokens.filter(token => token.access === 'auth')[0].token

      request(app)
        .get('/users/me')
        .set('x-auth', t)
        .expect(200)
        .expect(res => {
          expect(res.body.user.email).toBe(users[0].email)
        })
        .then(() => done())
        .catch(err => done(err))
    })

    it('should return an error on malformed token', done => {
      let t = 'this_is_obviously_a_fake_token'

      request(app)
        .get('/users/me')
        .set('x-auth', t)
        .expect(401)
        .expect(res => expect(res.body.message).toBe('jwt malformed'))
        .then(() => done())
        .catch(err => done(err))
    })

    it('should return an error on valid but incorrect token', done => {
      let t = `${users[0].tokens.filter(token => token.access === 'auth')[0]
        .token}asdasdsad`

      request(app)
        .get('/users/me')
        .set('x-auth', t)
        .expect(401)
        .expect(res => expect(res.body.message).toBe('invalid signature'))
        .then(() => done())
        .catch(err => done(err))
    })
  })
})
