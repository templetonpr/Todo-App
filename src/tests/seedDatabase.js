import MongoClient from 'mongodb'

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
    { email: 'test1@test.test', password: 'hunter1' },
    { email: 'test2@test.test', password: 'hunter2' },
    { email: 'test3@test.test', password: 'hunter3' },
  ]
  return Promise.all(
    users.map(userData => {
      let user = new model(userData)
      user.unhashedPassword = userData.password
      return user.generateAuthToken().then(() => user.save())
    })
  )
}

const populateTodos = model => {
  return Promise.all(
    [
      { text: 'test todo 1' },
      { text: 'test todo 2' },
      { text: 'test todo 3' },
    ].map(todo => new model(todo).save())
  )
}

export { populateUsers, populateTodos, dropDB }
