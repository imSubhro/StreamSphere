console.log('Starting StreamSphere Backend...');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();
const { createAdapter } = require('@socket.io/redis-adapter');

const authMiddleware = require('./middleware/authMiddleware');
const redisClient = require('./config/redis');
const { apiLimiter, streamLimiter } = require('./middleware/rateLimiters');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Redis Adapter Setup
const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()])
    .then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        console.log('Redis Adapter connected');
    })
    .catch(err => {
        console.warn('Failed to connect Redis Adapter. Falling back to in-memory adapter.');
    });

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));

// Health Check Endpoint
app.get('/api/health', async (req, res) => {
    const health = {
        server: 'OK',
        timestamp: new Date().toISOString(),
        database: 'NOT_CHECKED',
        redis: 'NOT_CHECKED',
        env: {
            jwt_secret: !!process.env.JWT_SECRET,
            jwt_refresh_secret: !!process.env.JWT_REFRESH_SECRET,
            database_url: !!process.env.DATABASE_URL
        }
    };

    // Check Database
    try {
        const db = require('./config/db');
        await db.query('SELECT 1');
        health.database = 'OK';
    } catch (err) {
        health.database = `ERROR: ${err.message}`;
    }

    // Check Redis
    try {
        if (redisClient.isOpen) {
            await redisClient.ping();
            health.redis = 'OK';
        } else {
            health.redis = 'DISCONNECTED';
        }
    } catch (err) {
        health.redis = `ERROR: ${err.message}`;
    }

    const statusCode = (health.database === 'OK' && health.redis === 'OK') ? 200 : 503;
    res.status(statusCode).json(health);
});

app.post('/api/stream', authMiddleware, streamLimiter, async (req, res) => {
  try {
      const userId = req.user.id;
      let streamKey = await redisClient.get(`stream_key:${userId}`);
      
      if (!streamKey) {
          const db = require('./config/db');
          const result = await db.query('SELECT stream_key FROM users WHERE id = $1', [userId]);
          if (result.rows.length > 0 && result.rows[0].stream_key) {
              streamKey = result.rows[0].stream_key;
              await redisClient.set(`stream_key:${userId}`, streamKey, { EX: 24 * 60 * 60 });
          } else {
              return res.status(403).json({ error: 'No stream key found. Please register/login.' });
          }
      }

      const { password } = req.body;
      // Store in Redis
      await redisClient.hSet('active_streams', streamKey, JSON.stringify({ hostId: userId, password }));
      
      res.json({ streamKey });
  } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error', details: err.message });
  }
});

app.post('/api/validate-room', async (req, res) => {
  const { streamId, password } = req.body;
  const streamData = await redisClient.hGet('active_streams', streamId);

  if (!streamData) {
    return res.status(404).json({ error: 'Stream not found' });
  }

  const stream = JSON.parse(streamData);

  if (stream.password && stream.password !== password) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  res.json({ success: true, hasPassword: !!stream.password });
});

app.get('/api/check-room/:streamId', async (req, res) => {
    const { streamId } = req.params;
    const streamData = await redisClient.hGet('active_streams', streamId);
    if (!streamData) return res.status(404).json({ error: 'Stream not found' });
    
    const stream = JSON.parse(streamData);
    res.json({ hasPassword: !!stream.password });
});

app.get('/api/config/ice', (req, res) => {
    res.json({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: process.env.TURN_URL || 'stun:stun1.l.google.com:19302' }
        ]
    });
});

// Socket.IO Middleware for Auth
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const guestName = socket.handshake.auth.guestName;

  if (token) {
    try {
      const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      return next();
    } catch (err) {
      // If token is invalid, we could fall back to guest, but usually that means auth failed.
      // However, for smoother UX, let's log it and treat as guest if they have a name?
      // For now, let's return error to force re-login if token is bad.
      return next(new Error('Authentication error'));
    }
  }

  // Handle Guest
  if (guestName) {
      socket.user = { username: guestName, id: `guest-${socket.id}` };
      return next();
  }

  // Fallback
  socket.user = { username: `Guest-${socket.id.substr(0,4)}`, id: `guest-${socket.id}` };
  next();
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id, socket.user ? socket.user.username : 'Anon');

  socket.on('join-stream', async (streamId) => {
    socket.join(streamId);
    console.log(`User ${socket.id} joined stream ${streamId}`);
    socket.to(streamId).emit('user-joined', socket.id);

    // Send current pinned message if exists
    const pinnedMsg = await redisClient.get(`pinned:${streamId}`);
    if (pinnedMsg) {
        socket.emit('message-pinned', JSON.parse(pinnedMsg));
    }

    // Update and broadcast viewer count
    const room = io.sockets.adapter.rooms.get(streamId);
    const viewerCount = room ? room.size : 0;
    io.to(streamId).emit('viewer-count-update', viewerCount);
  });

  // Pin Message
  socket.on('pin-message', async (data) => { // { streamId, message: { user, message, id } }
      await redisClient.set(`pinned:${data.streamId}`, JSON.stringify(data.message));
      io.to(data.streamId).emit('message-pinned', data.message);
  });

  // Unpin Message
  socket.on('unpin-message', async (data) => { // { streamId }
      await redisClient.del(`pinned:${data.streamId}`);
      io.to(data.streamId).emit('message-unpinned');
  });

  // WebRTC Signaling (P2P Mesh)
  socket.on('offer', (data) => io.to(data.target).emit('offer', { offer: data.sdp, caller: socket.id }));
  socket.on('answer', (data) => io.to(data.target).emit('answer', { answer: data.sdp, caller: socket.id }));
  socket.on('ice-candidate', (data) => io.to(data.target).emit('ice-candidate', { candidate: data.candidate, sender: socket.id }));

  // Chat with Anti-Spam & Moderation
  socket.on('chat-message', async (data) => {
    try {
        // Check if muted
        const isMuted = await redisClient.get(`muted:${data.streamId}:${socket.user.id}`);
        if (isMuted) return socket.emit('error', { message: 'You are muted.' });

        // Check slow mode
        const slowModeDelay = await redisClient.get(`slowmode:${data.streamId}`);
        if (slowModeDelay) {
            const lastMessageTime = await redisClient.get(`lastmsg:${data.streamId}:${socket.user.id}`);
            if (lastMessageTime) {
                const timeSinceLastMessage = Date.now() - parseInt(lastMessageTime);
                const delay = parseInt(slowModeDelay) * 1000; // Convert to milliseconds
                
                if (timeSinceLastMessage < delay) {
                    const remainingTime = Math.ceil((delay - timeSinceLastMessage) / 1000);
                    return socket.emit('error', { message: `Slow mode: Please wait ${remainingTime}s before sending another message.` });
                }
            }
            // Update last message time
            await redisClient.set(`lastmsg:${data.streamId}:${socket.user.id}`, Date.now().toString(), { EX: parseInt(slowModeDelay) + 5 });
        }
        
        io.to(data.streamId).emit('chat-message', {
            message: data.message,
            user: socket.user.username, 
            from: socket.id,
            timestamp: Date.now(),
            id: crypto.randomUUID()
        });
    } catch (err) {
        console.error("Chat error:", err);
    }
  });

  // Moderation: Mute User (Host Only)
  socket.on('mute-user', async (data) => { // { streamId, targetUserId }
      const streamData = await redisClient.hGet('active_streams', data.streamId);
      if (!streamData) return;
      const stream = JSON.parse(streamData);
      
      if (stream.hostId === socket.user.id) {
          await redisClient.set(`muted:${data.streamId}:${data.targetUserId}`, 'true', { EX: 300 }); // 5 mins
          io.to(data.streamId).emit('system-message', { message: `User was muted by host.` });
      }
  });

  // Moderation: Ban User (Host Only)
  socket.on('ban-user', async (data) => { // { streamId, targetSocketId }
      const streamData = await redisClient.hGet('active_streams', data.streamId);
      if (!streamData) return;
      const stream = JSON.parse(streamData);
      
      if (stream.hostId === socket.user.id) {
          // Disconnect the user
          io.in(data.targetSocketId).disconnectSockets(true);
      }
  });

  // Moderation: Toggle Slow Mode (Host Only)
  socket.on('toggle-slow-mode', async (data) => { // { streamId, enabled, delay }
      const streamData = await redisClient.hGet('active_streams', data.streamId);
      if (!streamData) return;
      const stream = JSON.parse(streamData);
      
      if (stream.hostId === socket.user.id) {
          if (data.enabled && data.delay) {
              await redisClient.set(`slowmode:${data.streamId}`, data.delay.toString());
              io.to(data.streamId).emit('slow-mode-update', { enabled: true, delay: data.delay });
          } else {
              await redisClient.del(`slowmode:${data.streamId}`);
              io.to(data.streamId).emit('slow-mode-update', { enabled: false, delay: 0 });
          }
      }
  });

  socket.on('toggle-media', (data) => {
    socket.to(data.streamId).emit('user-toggled-media', {
      userId: socket.id,
      type: data.type,
      enabled: data.enabled
    });
  });

  // Emoji Reactions
  socket.on('send-reaction', (data) => { // { streamId, emoji }
    io.to(data.streamId).emit('reaction', {
      userId: socket.id,
      username: socket.user.username,
      emoji: data.emoji,
      timestamp: Date.now()
    });
  });

  socket.on('disconnecting', async () => {
    const rooms = [...socket.rooms];
    rooms.forEach(async (room) => {
        if (room !== socket.id) {
            socket.to(room).emit('user-left', socket.id);
            
            // Update viewer count after user leaves
            setTimeout(() => {
                const roomData = io.sockets.adapter.rooms.get(room);
                const viewerCount = roomData ? roomData.size : 0;
                io.to(room).emit('viewer-count-update', viewerCount);
            }, 100);
            
            // Check if this user is the host of the stream (room)
            try {
                const streamData = await redisClient.hGet('active_streams', room);
                if (streamData) {
                    const stream = JSON.parse(streamData);
                    if (stream.hostId === socket.user.id) {
                        await redisClient.hDel('active_streams', room);
                        io.to(room).emit('stream-ended');
                        console.log(`Stream ${room} ended by host ${socket.user.username}`);
                    }
                }
            } catch (err) {
                console.error('Error handling disconnect:', err);
            }
        }
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5002;
server.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`);
});
