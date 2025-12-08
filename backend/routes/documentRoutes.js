import express from 'express';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';
import { deleteDocument, downloadDocument, listDocuments, uploadDocument } from '../controllers/documentController.js';
import { protect } from '../middleware/authMiddleware.js';

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (_req, file) => {
    const fileExtension = file.originalname.split('.').pop();
    return {
      folder: 'document-organizer',
      resource_type: 'auto',
      allowed_formats: ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip', 'rar'],
      public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname.replace(/\.[^/.]+$/, '')}`,
      context: { fileExtension }
    };
  }
});

const upload = multer({ storage });
const router = express.Router();

router.get('/', protect, listDocuments);
router.post('/', protect, upload.single('file'), uploadDocument);
router.get('/:id/download', protect, downloadDocument);
router.delete('/:id', protect, deleteDocument);

export default router;

// In your documentController.js downloadDocument function
const url = `https://res.cloudinary.com/duqdcj4cy/image/upload/v${document.cloudinary_version}/${document.public_id}.pdf`;
// Adjust the format (pdf, jpg, etc.) based on the stored file extension


