const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// In-memory stores
const streams = {}; // { streamKey: { hostId, viewers: [] } }

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.post('/api/stream', (req, res) => {
  const streamKey = crypto.randomBytes(10).toString('hex');
  const { password } = req.body;
  streams[streamKey] = { viewers: [], password }; // Store password if provided
  res.json({ streamKey });
});

app.post('/api/validate-room', (req, res) => {
  const { streamId, password } = req.body;
  const stream = streams[streamId];

  if (!stream) {
    return res.status(404).json({ error: 'Stream not found' });
  }

  if (stream.password && stream.password !== password) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  res.json({ success: true, hasPassword: !!stream.password });
});

app.get('/api/check-room/:streamId', (req, res) => {
    const { streamId } = req.params;
    const stream = streams[streamId];
    if (!stream) return res.status(404).json({ error: 'Stream not found' });
    res.json({ hasPassword: !!stream.password });
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-stream', (streamId) => {
    socket.join(streamId);
    console.log(`User ${socket.id} joined stream ${streamId}`);
    
    // Notify others in the room
    socket.to(streamId).emit('user-joined', socket.id);
  });

  // WebRTC Signaling (P2P Mesh)
  // Relay offer to specific target
  socket.on('offer', (data) => {
    io.to(data.target).emit('offer', {
      offer: data.sdp, 
      caller: socket.id
    });
  });

  // Relay answer to specific target
  socket.on('answer', (data) => {
    io.to(data.target).emit('answer', {
      answer: data.sdp,
      caller: socket.id
    });
  });

  // Relay ICE candidate to specific target
  socket.on('ice-candidate', (data) => {
    io.to(data.target).emit('ice-candidate', {
      candidate: data.candidate,
      sender: socket.id
    });
  });

  // Chat
  socket.on('chat-message', (data) => {
    io.to(data.streamId).emit('chat-message', {
      message: data.message,
      user: data.user || 'Anonymous', 
      from: socket.id,
      timestamp: Date.now()
    });
  });

  // Media Toggle Signaling
  socket.on('toggle-media', (data) => {
    socket.to(data.streamId).emit('user-toggled-media', {
      userId: socket.id,
      type: data.type, // 'audio' or 'video'
      enabled: data.enabled
    });
  });

  socket.on('disconnecting', () => {
    socket.rooms.forEach(room => {
      socket.to(room).emit('user-left', socket.id);
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
