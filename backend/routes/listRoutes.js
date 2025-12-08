import express from 'express';
import { createList, getLists, updateList, deleteList } from '../controllers/listController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getLists);
router.post('/', protect, createList);
router.put('/:id', protect, updateList);
router.delete('/:id', protect, deleteList);

export default router;


