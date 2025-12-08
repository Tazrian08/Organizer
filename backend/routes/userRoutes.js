import express from 'express';
import { createUser, getProfile } from '../controllers/userController.js';
import { adminOnly, protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/me', protect, getProfile);
router.post('/', protect, adminOnly, createUser);

export default router;


