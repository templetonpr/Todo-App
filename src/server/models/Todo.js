import mongoose from 'mongoose'
const Schema = mongoose.Schema

const Todo = new Schema(
  {
    text: {
      type: String,
      required: true,
      minlength: 1,
      trim: true,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Number,
      default: null,
    },
    _creator: {
      required: true,
      type: Schema.Types.ObjectId,
    },
  },
  {
    timestamps: true,
  }
)
export default mongoose.model('Todo', Todo)
