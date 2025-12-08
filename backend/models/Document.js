import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['business', 'health', 'education', 'identification', 'finance', 'other'],
      default: 'other'
    },
    description: { type: String, trim: true },
    cloudinaryUrl: { type: String, required: true },
    cloudinaryPublicId: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String },
    size: { type: Number },
    // Keep filePath for backward compatibility, but it's optional now
    filePath: { type: String }
  },
  { timestamps: true }
);

const Document = mongoose.model('Document', documentSchema);

export default Document;


