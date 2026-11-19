/**
 * /api/admin — composed from focused sub-routers.
 * Public routes (login, OAuth callback) come first; everything after requireAdmin needs auth.
 */
const express = require('express');
const requireAdmin = require('../../middleware/requireAdmin');
const auth = require('./auth');

const router = express.Router();

// Public (no auth)
router.use(auth);
router.use(require('./youtubeCallback'));

// Authenticated
router.use(requireAdmin);
router.use(require('./agents'));
router.use(require('./dashboard'));
router.use(require('./books'));
router.use(require('./duplicates'));
router.use(require('./externalImport'));
router.use(require('./authors'));
router.use(require('./youtube'));
router.use(require('./videos'));

router.seedInitialAdmin = auth.seedInitialAdmin;
module.exports = router;
