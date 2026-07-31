const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Rate limit auth endpoints to prevent brute force / abuse
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts from this IP, please try again later.' },
});

// Public routes
router.post(
    '/register',
    authLimiter,
    [
        check('username', 'Username is required').not().isEmpty(),
        check('email', 'Please include a valid email').isEmail(),
        check('password', 'Password must be at least 6 characters').isLength({ min: 6 })
    ],
    authController.register
);

router.post(
    '/login',
    authLimiter,
    [
        check('email', 'Please include a valid email').isEmail(),
        check('password', 'Password is required').exists()
    ],
    authController.login
);

// Protected routes
router.get('/me', authMiddleware, authController.getCurrentUser);

module.exports = router;
