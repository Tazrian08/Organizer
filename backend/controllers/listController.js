import List from '../models/List.js';

export const createList = async (req, res) => {
  const { title, items = [] } = req.body;
  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  const normalizedItems = Array.isArray(items)
    ? items.filter(Boolean).map((text) => ({ text, done: false }))
    : [];

  const list = await List.create({ user: req.user._id, title, items: normalizedItems });
  return res.status(201).json(list);
};

export const getLists = async (req, res) => {
  const lists = await List.find({ user: req.user._id }).sort({ createdAt: -1 });
  return res.json(lists);
};

export const deleteList = async (req, res) => {
  const list = await List.findById(req.params.id);
  if (!list) return res.status(404).json({ message: 'List not found' });

  const isOwner = list.user.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized to delete this list' });
  }

  await list.deleteOne();
  return res.json({ message: 'List deleted' });
};


