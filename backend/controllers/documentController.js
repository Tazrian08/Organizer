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

  try {
    // Extract Cloudinary data - CloudinaryStorage stores public_id in filename
    // When folder is set, the public_id should include the folder path
    let cloudinaryPublicId = req.file.filename || req.file.public_id;
    
    // Ensure public_id includes folder path if it doesn't already
    if (cloudinaryPublicId && !cloudinaryPublicId.includes('/')) {
      cloudinaryPublicId = `document-organizer/${cloudinaryPublicId}`;
    }

    const doc = await Document.create({
      user: req.user._id,
      title,
      category,
      description,
      cloudinaryUrl: req.file.path,
      cloudinaryPublicId: cloudinaryPublicId,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    });

    return res.status(201).json(doc);
  } catch (error) {
    console.error('Error uploading document:', error);
    return res.status(500).json({ message: 'Error uploading document', error: error.message });
  }
};

export const downloadDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const isOwner = doc.user.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access this file' });
    }

    // If document has Cloudinary URL, generate a secure HTTPS download URL
    if (doc.cloudinaryUrl && doc.cloudinaryPublicId) {
      try {
        // Ensure public_id includes folder path if it doesn't already
        let publicId = doc.cloudinaryPublicId;
        if (!publicId.includes('/')) {
          publicId = `document-organizer/${publicId}`;
        }

        // Generate HTTPS URL explicitly with secure flag
        const downloadUrl = cloudinary.url(publicId, {
          resource_type: 'auto',
          secure: true, // Force HTTPS
          attachment: true,
          flags: 'attachment:' + doc.originalName
        });
        
        // Return URL as JSON to avoid CORS issues with redirects
        // Frontend can then open/download the file directly
        return res.json({ 
          downloadUrl: downloadUrl,
          filename: doc.originalName 
        });
      } catch (error) {
        console.error('Error generating Cloudinary download URL:', error);
        console.error('Document data:', { 
          cloudinaryUrl: doc.cloudinaryUrl, 
          cloudinaryPublicId: doc.cloudinaryPublicId 
        });
        // Fallback: return the stored Cloudinary URL directly, ensuring HTTPS
        let fallbackUrl = doc.cloudinaryUrl;
        if (fallbackUrl && fallbackUrl.startsWith('http://')) {
          fallbackUrl = fallbackUrl.replace('http://', 'https://');
        }
        return res.json({ 
          downloadUrl: fallbackUrl,
          filename: doc.originalName 
        });
      }
    }

    // Fallback for old documents stored locally (backward compatibility)
    return res.status(404).json({ message: 'File not available' });
  } catch (error) {
    console.error('Error in downloadDocument:', error);
    return res.status(500).json({ message: 'Error downloading document', error: error.message });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const isOwner = doc.user.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this file' });
    }

    // Delete from Cloudinary if public_id exists
    if (doc.cloudinaryPublicId) {
      try {
        // Ensure public_id includes folder path if it doesn't already
        let publicId = doc.cloudinaryPublicId;
        if (!publicId.includes('/')) {
          publicId = `document-organizer/${publicId}`;
        }

        await cloudinary.uploader.destroy(publicId, {
          resource_type: 'auto'
        });
      } catch (error) {
        console.error('Error deleting from Cloudinary:', error);
        console.error('Document public_id:', doc.cloudinaryPublicId);
        // Continue with database deletion even if Cloudinary deletion fails
      }
    }

    await doc.deleteOne();
    return res.json({ message: 'Document deleted' });
  } catch (error) {
    console.error('Error in deleteDocument:', error);
    return res.status(500).json({ message: 'Error deleting document', error: error.message });
  }
};


