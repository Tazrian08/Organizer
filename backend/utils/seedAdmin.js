import User from '../models/User.js';

const DEFAULT_ADMIN = {
  name: 'Admin',
  email: process.env.ADMIN_EMAIL || 'tazrian.hossain08@gmail.com',
  password: process.env.ADMIN_PASSWORD || '39039820',
  role: 'admin'
};

export const ensureAdminUser = async () => {
  const adminEmail = DEFAULT_ADMIN.email.toLowerCase();
  const existing = await User.findOne({ email: adminEmail });
  if (existing) return existing;

  const admin = new User(DEFAULT_ADMIN);
  await admin.save();
  console.log(`Seeded admin user ${adminEmail}`);
  return admin;
};

