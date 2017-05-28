import path from 'path'
const rootPath = path.join('__dirname', '..')
const env = process.env.NODE_ENV || 'development'

const config = {
  env: env,
  root: rootPath,
  port: process.env.PORT || 3000,
  db: (env === 'test') ? process.env.MONGODB_TEST_URI : process.env.MONGODB_URI,
}

export default config
