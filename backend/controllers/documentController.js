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

    // If document has Cloudinary URL, proxy it through backend to set download headers
    if (doc.cloudinaryUrl && doc.cloudinaryPublicId) {
      try {
        // Ensure the URL is HTTPS (convert http:// to https://)
        let cloudinaryUrl = doc.cloudinaryUrl;
        if (cloudinaryUrl && cloudinaryUrl.startsWith('http://')) {
          cloudinaryUrl = cloudinaryUrl.replace('http://', 'https://');
        }

        // Fetch the file from Cloudinary
        const fileResponse = await fetch(cloudinaryUrl);
        if (!fileResponse.ok) {
          throw new Error('Failed to fetch file from Cloudinary');
        }

        // Get the file content
        const fileBuffer = await fileResponse.arrayBuffer();
        const contentType = doc.mimeType || fileResponse.headers.get('content-type') || 'application/octet-stream';

        // Set headers to force download with correct filename
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${doc.originalName.replace(/"/g, '\\"')}"`);
        res.setHeader('Content-Length', fileBuffer.byteLength);

        // Send the file
        return res.send(Buffer.from(fileBuffer));
      } catch (error) {
        console.error('Error proxying file from Cloudinary:', error);
        // Fallback: return URL as JSON
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

// Helper function to determine Cloudinary resource type from mimeType
const getResourceType = (mimeType) => {
  if (!mimeType) return 'raw'; // Default to raw for unknown types
  
  if (mimeType.startsWith('image/')) {
    return 'image';
  } else if (mimeType.startsWith('video/')) {
    return 'video';
  } else {
    // For documents (pdf, doc, etc.), use 'raw'
    return 'raw';
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

        // Determine resource type from mimeType (auto is not supported for destroy)
        const resourceType = getResourceType(doc.mimeType);

        await cloudinary.uploader.destroy(publicId, {
          resource_type: resourceType
        });
      } catch (error) {
        console.error('Error deleting from Cloudinary:', error);
        console.error('Document public_id:', doc.cloudinaryPublicId);
        console.error('Document mimeType:', doc.mimeType);
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


