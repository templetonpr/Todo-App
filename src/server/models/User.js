import mongoose from 'mongoose'
const Schema = mongoose.Schema

const User = new Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
  },
})


export default mongoose.model('User', User)
