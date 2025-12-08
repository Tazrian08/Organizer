import mongoose from 'mongoose';

const listSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    items: [
      {
        text: { type: String, required: true, trim: true },
        done: { type: Boolean, default: false }
      }
    ]
  },
  { timestamps: true }
);

const List = mongoose.model('List', listSchema);

export default List;


