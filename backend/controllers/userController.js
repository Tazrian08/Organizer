import User from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';

export const createUser = async (req, res) => {
  const { name, email, password, role = 'user' } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const user = await User.create({ name, email: email.toLowerCase(), password, role });
  return res.status(201).json({
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    token: generateToken(user._id, user.role)
  });
};

export const getProfile = async (req, res) => {
  return res.json(req.user);
};


