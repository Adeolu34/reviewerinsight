const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const AdminUser = require('../../models/AdminUser');
const config = require('../../config/env');
const logger = require('../../utils/logger');
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);
const router = express.Router();


/** Run once after MongoDB is connected. Creates first admin from env when collection is empty. */
async function seedInitialAdmin() {
  try {
    const count = await AdminUser.countDocuments();
    if (count > 0) return;

    const email = (process.env.ADMIN_INITIAL_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_INITIAL_PASSWORD;
    if (!email || !password) {
      logger.warn(
        '[Admin] No admin users in DB. Set ADMIN_INITIAL_EMAIL and ADMIN_INITIAL_PASSWORD (e.g. in Coolify env) to create the first account on startup.'
      );
      return;
    }

    await AdminUser.create({
      email,
      password,
      name: (process.env.ADMIN_INITIAL_NAME || 'Admin').trim() || 'Admin',
    });
    logger.info(`[Admin] Seeded initial admin account: ${email}`);
  } catch (err) {
    logger.error('[Admin] Failed to seed admin account:', err.message);
  }
}

// ─── POST /api/admin/login (public — no auth required) ─────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || password.length > 200 || email.length > 200) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await AdminUser.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Burn comparable time so response timing does not reveal whether the email exists
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      config.jwtSecret,
      { expiresIn: '8h', algorithm: 'HS256' }
    );

    res.json({ token, user: { email: user.email, name: user.name } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.seedInitialAdmin = seedInitialAdmin;
module.exports = router;
