import cloudinary from '../config/cloudinary.js';
import Document from '../models/Document.js';

export const listDocuments = async (req, res) => {
  const filter = req.user.role === 'admin' && req.query.user ? { user: req.query.user } : { user: req.user._id };
  const docs = await Document.find(filter).sort({ createdAt: -1 });
  return res.json(docs);
};

export const uploadDocument = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const { title, category = 'other', description = '' } = req.body;
  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  const doc = await Document.create({
    user: req.user._id,
    title,
    category,
    description,
    cloudinaryUrl: req.file.path,
    cloudinaryPublicId: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size
  });

  return res.status(201).json(doc);
};

export const downloadDocument = async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Document not found' });

  const isOwner = doc.user.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized to access this file' });
  }

  // If document has Cloudinary URL, redirect to the stored secure URL (avoid mixed-content)
  if (doc.cloudinaryUrl && doc.cloudinaryPublicId) {
    try {
      // Use the stored URL (ensure https to avoid mixed content)
      let redirectUrl = doc.cloudinaryUrl;
      if (redirectUrl && redirectUrl.startsWith('http:')) {
        redirectUrl = redirectUrl.replace(/^http:/, 'https:');
      }

      // If for some reason stored URL is missing or not HTTPS, build a secure URL
      if (!redirectUrl) {
        redirectUrl = cloudinary.url(doc.cloudinaryPublicId, {
          resource_type: 'auto',
          secure: true,
          attachment: doc.originalName // force download filename
        });
      }

      return res.redirect(redirectUrl);
    } catch (error) {
      console.error('Error generating Cloudinary download URL:', error);
      return res.status(500).json({ message: 'Error generating download URL' });
    }
  }

  // Fallback for old documents stored locally (backward compatibility)
  return res.status(404).json({ message: 'File not available' });
};

export const deleteDocument = async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Document not found' });

  const isOwner = doc.user.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized to delete this file' });
  }

  // Delete from Cloudinary if public_id exists
  if (doc.cloudinaryPublicId) {
    try {
      await cloudinary.uploader.destroy(doc.cloudinaryPublicId, {
        resource_type: 'auto'
      });
    } catch (error) {
      console.error('Error deleting from Cloudinary:', error);
      // Continue with database deletion even if Cloudinary deletion fails
    }
  }

  await doc.deleteOne();
  return res.json({ message: 'Document deleted' });
};


