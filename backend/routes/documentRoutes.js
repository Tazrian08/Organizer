import express from 'express';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';
import { deleteDocument, downloadDocument, listDocuments, uploadDocument } from '../controllers/documentController.js';
import { protect } from '../middleware/authMiddleware.js';

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (_req, file) => {
    return {
      folder: 'document-organizer',
      resource_type: 'auto',
      allowed_formats: ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip', 'rar'],
      // public_id will be automatically prefixed with folder when folder is set
      public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname.replace(/\.[^/.]+$/, '')}`
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


