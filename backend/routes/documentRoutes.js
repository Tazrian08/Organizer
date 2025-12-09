import express from 'express';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';
import {
  deleteDocument,
  downloadDocument,
  listDocuments,
  uploadDocument
} from '../controllers/documentController.js';
import { protect } from '../middleware/authMiddleware.js';

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, file) => {
    const originalNameNoExt = file.originalname.replace(/\.[^/.]+$/, '');
    const ext = file.originalname.split('.').pop()?.toLowerCase();

    return {
      folder: 'document-organizer',
      // treat all documents as raw files
      resource_type: 'raw',
      // public upload type (no signed URL needed to access)
      type: 'upload',
      format: ext,
      public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}-${originalNameNoExt.replace(
        /\s+/g,
        '_'
      )}`,
      allowed_formats: [
        'pdf',
        'jpg',
        'jpeg',
        'png',
        'gif',
        'doc',
        'docx',
        'xls',
        'xlsx',
        'txt',
        'zip',
        'rar'
      ]
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
