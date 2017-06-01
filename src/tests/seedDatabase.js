import MongoClient from 'mongodb'

const dropDB = DB_URL => {
  return new Promise(function(resolve, reject) {
    MongoClient.connect(DB_URL, (err, db) => {
      if (err) reject(err)
      db.dropDatabase().then(() => db.close()).then(resolve)
    })
  })
}

const populate = seedData => model => {
  return model.create(seedData)
}

const populateUsers = populate([
  { email: 'test1@test.test', password: 'hunter2' },
  { email: 'test2@test.test', password: 'hunter2' },
  { email: 'test3@test.test', password: 'hunter2' },
])

const populateTodos = populate([
  { text: 'test todo 1' },
  { text: 'test todo 2' },
  { text: 'test todo 3' },
])

export { populateUsers, populateTodos, dropDB }
