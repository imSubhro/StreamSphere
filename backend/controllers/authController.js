const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const crypto = require('crypto');
const redisClient = require('../config/redis');

const generateAccessToken = (user) => {
  return jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

const generateRefreshToken = (user) => {
  return jwt.sign({ id: user.id, username: user.username }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

// Helper: Generate and Cache Stream Key
const generateAndCacheStreamKey = async (userId) => {
    const streamKey = crypto.randomBytes(20).toString('hex');
    
    // Update DB
    await db.query('UPDATE users SET stream_key = $1 WHERE id = $2', [streamKey, userId]);
    
    // Cache in Redis (Expire in 24 hours)
    await redisClient.set(`stream_key:${userId}`, streamKey, { EX: 24 * 60 * 60 });
    
    return streamKey;
};

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password } = req.body;

  try {
    // Check if user exists
    const userCheck = await db.query('SELECT * FROM users WHERE email = $1 OR username = $2', [email, username]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const newUser = await db.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hashedPassword]
    );

    const user = newUser.rows[0];
    
    // Generate Stream Key
    const streamKey = await generateAndCacheStreamKey(user.id);
    user.stream_key = streamKey;

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(201).json({ user, accessToken, refreshToken });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server Error', details: err.message });
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
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Ensure stream key is in Redis on login (if missing)
    let streamKey = user.stream_key;
    if (!streamKey) {
        streamKey = await generateAndCacheStreamKey(user.id);
    } else {
        // Refresh Redis TTL
        await redisClient.set(`stream_key:${user.id}`, streamKey, { EX: 24 * 60 * 60 });
    }
    user.stream_key = streamKey;

    res.json({ user: { id: user.id, username: user.username, email: user.email, stream_key: streamKey }, accessToken, refreshToken });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server Error', details: err.message });
  }
};

exports.refreshToken = async (req, res) => {
  const { token } = req.body;

  if (!token) return res.sendStatus(401);

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    
    // Ideally check if user still exists or if token is blacklisted
    const user = { id: decoded.id, username: decoded.username };
    const accessToken = generateAccessToken(user);

    res.json({ accessToken });
  } catch (err) {
    return res.sendStatus(403);
  }
};

exports.rotateStreamKey = async (req, res) => {
    try {
        const userId = req.user.id;
        const newKey = await generateAndCacheStreamKey(userId);
        res.json({ streamKey: newKey });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
};
