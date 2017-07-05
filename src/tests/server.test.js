import path from 'path'

import expect from 'expect'
import request from 'supertest'

import { MongoClient, ObjectID } from 'mongodb'
import { cleanDB } from './databaseUtils.js'

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

describe('Authentication API', () => {
  let sampleData

  beforeEach(done => {
    cleanDB(config.db, User, Todo)
      .then(response => (sampleData = response))
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
              let t = user.tokens[0].token
              expect(t).toBe(token)
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

  describe('POST /users/login', () => {
    it('should return user and token header on correct email/passwd', done => {
      let email = sampleData.users[1].email
      let password = sampleData.users[1].unhashedPassword

      request(app)
        .post('/users/login')
        .send({ email, password })
        .expect(200)
        .expect(res => {
          expect(res.headers['x-auth']).toExist()
          expect(res.body.user.email).toBe(email)
        })
        .end((err, res) => {
          if (err) return done(err)

          User.findById(sampleData.users[1]._id)
            .then(user => {
              expect(user.tokens[0]).toInclude({
                access: 'auth',
                token: res.headers['x-auth'],
              })
              done()
            })
            .catch(err => done(err))
        })
    })

    it('should return an error on incorrect email/passwd', done => {
      let email = 'test123@test.fake'
      let password = 'fakefakefake!@#321'

      request(app)
        .post('/users/login')
        .send({ email, password })
        .expect(400)
        .expect(res => {
          expect(res.headers['x-auth']).toNotExist()
          expect(res.body.message).toBe('Email or password incorrect')
        })
        .then(() => done())
        .catch(err => done(err))
    })
  })

  describe('GET /users/me', () => {
    it('should correctly parse jwt for valid user', done => {
      sampleData.users[1]
        .generateAuthToken()
        .then(t => {
          request(app)
            .get('/users/me')
            .set('x-auth', t)
            .expect(200)
            .expect(res => {
              expect(res.body.user.email).toBe(users[1].email)
            })
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
      sampleData.users[1]
        .generateAuthToken()
        .then(t => `${t}asdfasdfasdf`) // mess up the token signature
        .then(t => {
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

  describe('DELETE /users/me/token', () => {
    it('should log the user out', done => {
      sampleData.users[1].generateAuthToken().then(token => {
        request(app)
          .delete('/users/me/token')
          .set('x-auth', token)
          .expect(200, { success: true })
          .end((err, res) => {
            if (err) return done(err)
            User.findById(sampleData.users[1]._id)
              .then(user => {
                expect(user.tokens.length).toBe(0)
              })
              .then(() => done())
              .catch(err => done(err))
          })
      })
    })
  })
})

describe('Todos API', () => {
  let sampleData

  beforeEach(done => {
    cleanDB(config.db, User, Todo)
      .then(response => (sampleData = response))
      .then(() => done())
      .catch(err => done(err))
  })

  describe('POST /todos', () => {
    it('should create a new todo with POST /todos', done => {
      let text = 'test todo test'
      request(app)
        .post('/todos')
        .set('x-auth', sampleData.users[0].tokens[0].token)
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
      request(app)
        .post('/todos')
        .set('x-auth', sampleData.users[0].tokens[0].token)
        .send({ text })
        .expect(400)
        .end((err, res) => {
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
        .set('x-auth', sampleData.users[0].tokens[0].token)
        .expect(res => {
          expect(res.body.todos.length).toBe(1)
        })
        .expect(200, done)
    })
  })

  describe('GET /todos/:id', () => {
    it('should retrieve a todo with GET /todos/:id', done => {
      let { id, text } = sampleData.todos[0]
      request(app)
        .get(`/todos/${id}`)
        .set('x-auth', sampleData.users[0].tokens[0].token)
        .expect(res => {
          expect(res.body.todo.text).toExist()
          expect(res.body.todo.text).toEqual(text)
        })
        .expect(200, done)
    })

    it("should not allow a user to see another user's todos", done => {
      request(app)
        .get(`/todos/${sampleData.todos[1]._id}`)
        .set('x-auth', sampleData.users[0].tokens[0].token)
        .expect(404, done)
    })

    it('should return 404 if :id was not found', done => {
      let id = new ObjectID().toHexString()
      request(app)
        .get(`/todos/${id}`)
        .set('x-auth', sampleData.users[0].tokens[0].token)
        .expect(404, done)
    })

    it('should return 400 if :id was invalid', done => {
      let id = '12345asdf'
      request(app)
        .get(`/todos/${id}`)
        .set('x-auth', sampleData.users[0].tokens[0].token)
        .expect(res => {
          expect(res.body.message).toBe('Invalid ID format')
        })
        .expect(400, done)
    })
  })

  describe('PATCH /todos/:id', () => {
    it('should modify the text property of a todo', done => {
      request(app)
        .patch(`/todos/${sampleData.todos[0]._id}`)
        .set('x-auth', sampleData.users[0].tokens[0].token)
        .send({ text: 'modified' })
        .expect(200)
        .expect(res => {
          expect(res.body.todo.text).toExist()
          expect(res.body.todo.text).toBe('modified')
        })
        .end((err, res) => {
          if (err) return done(err)
          Todo.findById(sampleData.todos[0]._id).then(todo => {
            expect(todo.text).toBe('modified')
            return done()
          })
        })
    })

    it("should not allow a user to modify another user's todos", done => {
      request(app)
        .patch(`/todos/${sampleData.todos[1]._id}`)
        .set('x-auth', sampleData.users[0].tokens[0].token)
        .send({ text: 'modified' })
        .expect(404)
        .end((err, res) => {
          if (err) return done(err)
          Todo.findById(sampleData.todos[1]._id).then(todo => {
            expect(todo.text).toNotBe('modified')
            return done()
          })
        })
    })

    it('should set the completed and completedAt properties when completing a todo', done => {
      request(app)
        .patch(`/todos/${sampleData.todos[0]._id}`)
        .set('x-auth', sampleData.users[0].tokens[0].token)
        .send({ completed: true })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          Todo.findById(sampleData.todos[0]._id)
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
        .patch(`/todos/${sampleData.todos[0]._id}`)
        .set('x-auth', sampleData.users[0].tokens[0].token)
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
        .set('x-auth', sampleData.users[0].tokens[0].token)
        .send({ text: 'modified' })
        .expect(400, done)
    })

    it('should return 404 if :id was not found', done => {
      let id = new ObjectID().toHexString()
      request(app)
        .patch(`/todos/${id}`)
        .set('x-auth', sampleData.users[0].tokens[0].token)
        .send({ text: 'modified' })
        .expect(404, done)
    })
  })

  describe('DELETE /todos/:id', () => {
    it('should delete a todo with DELETE /todos/:id', done => {
      request(app)
        .delete(`/todos/${sampleData.todos[0]._id}`)
        .set('x-auth', sampleData.users[0].tokens[0].token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          Todo.findById(sampleData.todos[0]._id).then(todo => {
            expect(todo).toNotExist()
            return done()
          })
        })
    })

    it("should not allow a user to delete another user's todos", done => {
      request(app)
        .delete(`/todos/${sampleData.todos[1]._id}`)
        .set('x-auth', sampleData.users[0].tokens[0].token)
        .expect(404)
        .end((err, res) => {
          if (err) return done(err)
          Todo.findById(sampleData.todos[0]._id)
            .then(todo => {
              expect(todo).toExist()
              return done()
            })
            .catch(err => done(err))
        })
    })

    it('should return 404 if :id was not found', done => {
      let id = new ObjectID().toHexString()
      request(app)
        .delete(`/todos/${id}`)
        .set('x-auth', sampleData.users[0].tokens[0].token)
        .expect(404, done)
    })

    it('should return 400 if :id is invalid', done => {
      let id = 'qqwerqwerqwerrewq'
      request(app)
        .delete(`/todos/${id}`)
        .set('x-auth', sampleData.users[0].tokens[0].token)
        .expect(400, done)
    })
  })
})
