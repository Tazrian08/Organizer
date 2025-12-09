import cloudinary from '../config/cloudinary.js';
import Document from '../models/Document.js';
import axios from 'axios';

// GET /api/documents
export const listDocuments = async (req, res) => {
  const filter =
    req.user.role === 'admin' && req.query.user
      ? { user: req.query.user }
      : { user: req.user._id };

  const docs = await Document.find(filter).sort({ createdAt: -1 });
  return res.json(docs);
};

// POST /api/documents  (upload)
export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { title, category = 'other', description = '' } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    // multer-storage-cloudinary gives us:
    // - req.file.path        -> URL (with secure: true this will be https)
    // - req.file.secure_url  -> (sometimes present)
    // - req.file.filename    -> public_id
    // - req.file.mimetype    -> mime type
    // - req.file.size        -> size in bytes
    // - req.file.originalname-> original filename
    const rawUrl = req.file.secure_url || req.file.path || '';
    const cloudinaryUrl = rawUrl.replace(/^http:/, 'https:');

    if (!cloudinaryUrl) {
      return res.status(500).json({ message: 'Could not determine Cloudinary URL' });
    }

    const doc = await Document.create({
      user: req.user._id,
      title: title.trim(),
      category,
      description: description.trim(),
      cloudinaryUrl,
      cloudinaryPublicId: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      filePath: null // legacy field unused now
    });

    return res.status(201).json(doc);
  } catch (error) {
    console.error('Error in uploadDocument:', error);
    return res.status(500).json({ message: 'Error uploading document' });
  }
};

// GET /api/documents/:id/download
export const downloadDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Authorization: owner or admin only
    const isOwner = doc.user.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access this file' });
    }

    if (!doc.cloudinaryUrl && !doc.cloudinaryPublicId) {
      return res.status(404).json({ message: 'File not available' });
    }

    // Prefer the stored secure URL
    let fileUrl = doc.cloudinaryUrl;

    // If not stored for some reason, build from public id
    if (!fileUrl && doc.cloudinaryPublicId) {
      fileUrl = cloudinary.url(doc.cloudinaryPublicId, {
        resource_type: 'raw',
        type: 'upload',
        secure: true
      });
    }

    if (!fileUrl) {
      return res.status(404).json({ message: 'File URL not available' });
    }

    fileUrl = fileUrl.replace(/^http:/, 'https:');

    // Fetch from Cloudinary on the server, stream to client
    const cloudinaryResponse = await axios.get(fileUrl, { responseType: 'stream' });

    // Set headers for download
    const contentType =
      cloudinaryResponse.headers['content-type'] ||
      doc.mimeType ||
      'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    const filename = encodeURIComponent(doc.originalName || 'document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe Cloudinary stream to the client
    cloudinaryResponse.data.pipe(res);
  } catch (error) {
    console.error('Error in downloadDocument:', error);
    return res.status(500).json({ message: 'Error downloading file' });
  }
};

// DELETE /api/documents/:id
export const deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const isOwner = doc.user.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this file' });
    }

    // Delete from Cloudinary if public_id exists
    if (doc.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(doc.cloudinaryPublicId, {
          resource_type: 'raw',
          type: 'upload'
        });
      } catch (error) {
        console.error('Error deleting from Cloudinary:', error);
        // Continue with DB deletion even if Cloudinary deletion fails
      }
    }

    await doc.deleteOne();
    return res.json({ message: 'Document deleted' });
  } catch (error) {
    console.error('Error in deleteDocument:', error);
    return res.status(500).json({ message: 'Error deleting document' });
  }
};


// GET /api/documents/search
export const searchDocuments = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const documents = await Document.find({
      $or: [
        { originalName: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    }).populate('user', 'username');

    return res.json(documents);
  } catch (error) {
    console.error('Error in searchDocuments:', error);
    return res.status(500).json({ message: 'Error searching documents' });
  }
};