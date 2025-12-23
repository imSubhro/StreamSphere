const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.header('Authorization');

  if (!token) {
    console.log('❌ No token provided');
    return res.status(403).json({ error: 'Access denied. No token provided.' });
  }

  try {
    // Bearer <token>
    const bearer = token.split(' ');
    const tokenValue = bearer[1] || token;
    
    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET is not defined in environment variables!');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    const decoded = jwt.verify(tokenValue, process.env.JWT_SECRET);
    req.user = decoded;
    console.log('✅ Token verified for user:', decoded.username || decoded.id);
    next();
  } catch (err) {
    console.log('❌ Token verification failed:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    res.status(401).json({ error: 'Invalid token.' });
  }
};

module.exports = verifyToken;
