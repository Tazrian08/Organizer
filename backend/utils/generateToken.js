import jwt from 'jsonwebtoken';

export const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET || 'devsecret', {
    expiresIn: '7d'
  });


