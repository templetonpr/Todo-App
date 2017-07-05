import { MongoClient, ObjectID } from 'mongodb'

const user1Id = new ObjectID()
const user2Id = new ObjectID()
const user3Id = new ObjectID()

const dropDB = DB_URL => {
  return new Promise(function(resolve, reject) {
    MongoClient.connect(DB_URL, (err, db) => {
      if (err) reject(err)
      db.dropDatabase().then(() => db.close()).then(resolve)
    })
  })
}

const populateUsers = model => {
  let users = [
    { email: 'test1@test.test', password: 'hunter1', _id: user1Id },
    { email: 'test2@test.test', password: 'hunter2', _id: user2Id },
    { email: 'test3@test.test', password: 'hunter3', _id: user3Id },
  ]
  return Promise.all(
    users.map(userData => {
      let user = new model(userData)
      user.unhashedPassword = userData.password // attach user's unhashed password to model to test logging in
      return user.save()
    })
  )
}

const populateTodos = model => {
  return Promise.all(
    [
      { text: 'test todo 1', _creator: user1Id },
      { text: 'test todo 2', _creator: user2Id },
      { text: 'test todo 3', _creator: user3Id },
    ].map(todo => new model(todo).save())
  )
}

const cleanDB = (DB_URL, UserModel, TodoModel) => {
  // Run all database cleaning functions and return some users and todos for testing
  let users = []
  let todos = []
  return dropDB(DB_URL)
    .then(() => populateUsers(UserModel))
    .then(us => (users = us))
    .then(() => populateTodos(TodoModel))
    .then(ts => (todos = ts))
    .then(() => users[0].generateAuthToken()) // generate a token for users[0]
    .then(() => ({ users, todos }))
}

export { populateUsers, populateTodos, dropDB, cleanDB }
