const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { getJwtSecret } = require('../config/secrets');

const JWT_SECRET = getJwtSecret();
const JWT_EXPIRY = '7d';

function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

exports.register = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;

    try {
        // Check if user exists
        const existing = await db.query(
            'SELECT id FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'User with this email or username already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create user
        const result = await db.query(
            `INSERT INTO users (username, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, username, email, avatar_url, created_at`,
            [username, email, passwordHash]
        );

        const user = result.rows[0];
        const token = generateToken({ id: user.id, username: user.username, email: user.email });

        res.status(201).json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatarUrl: user.avatar_url,
            },
            token,
        });
    } catch (err) {
        console.error('Registration error:', err.message);
        res.status(500).json({ error: 'Failed to register user' });
    }
};

exports.login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken({ id: user.id, username: user.username, email: user.email });

        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatarUrl: user.avatar_url,
            },
            token,
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Failed to login' });
    }
};

exports.getCurrentUser = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await db.query(
            'SELECT id, username, email, avatar_url, created_at FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatarUrl: user.avatar_url,
                createdAt: user.created_at,
            },
        });
    } catch (err) {
        console.error('Get current user error:', err.message);
        res.status(500).json({ error: 'Failed to get user' });
    }
};
