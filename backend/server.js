console.log('Starting StreamSphere Backend...');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

// Route imports
const authRoutes = require('./routes/authRoutes');
const meetingRoutes = require('./routes/meetingRoutes');

// Socket handlers
const { initializeMeetingSocket } = require('./sockets/meetingSocket');
const { initializeChatSocket } = require('./sockets/chatSocket');

// Middleware
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'https://streamsphere-iota.vercel.app',
        methods: ['GET', 'POST'],
    },
});

// Express Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'https://streamsphere-iota.vercel.app',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root route — server status page
app.get('/', (_req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>StreamSphere API</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    background: linear-gradient(135deg, #0a0a1a, #1a0a2e, #0a1a2e);
                    color: #e0e0e0;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .card {
                    text-align: center;
                    padding: 3rem;
                    background: rgba(255,255,255,0.04);
                    border-radius: 20px;
                    border: 1px solid rgba(255,255,255,0.08);
                    max-width: 480px;
                    width: 90%;
                }
                .dot {
                    display: inline-block;
                    width: 10px; height: 10px;
                    background: #00d4aa;
                    border-radius: 50%;
                    margin-right: 8px;
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(0,212,170,0.5); }
                    50% { box-shadow: 0 0 0 8px rgba(0,212,170,0); }
                }
                h1 { font-size: 1.6rem; margin-bottom: 0.5rem; }
                p { color: #8a8a9a; margin-bottom: 1.5rem; }
                .links { display: flex; flex-direction: column; gap: 0.6rem; }
                a {
                    color: #00d4aa;
                    text-decoration: none;
                    padding: 0.5rem 1rem;
                    border: 1px solid rgba(0,212,170,0.2);
                    border-radius: 10px;
                    transition: all 0.3s;
                }
                a:hover { background: rgba(0,212,170,0.1); }
            </style>
        </head>
        <body>
            <div class="card">
                <h1><span class="dot"></span> StreamSphere API</h1>
                <p>Server running on port ${process.env.PORT || 5000}</p>
                <div class="links">
                    <a href="/api/health">Health Check</a>
                    <a href="/api/auth">Auth API</a>
                    <a href="/api/meetings">Meetings API</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Health check
app.get('/api/health', async (_req, res) => {
    const health = {
        server: 'OK',
        timestamp: new Date().toISOString(),
        database: 'NOT_CHECKED',
    };

    try {
        const db = require('./config/db');
        await db.query('SELECT 1');
        health.database = 'OK';
    } catch (err) {
        health.database = `ERROR: ${err.message}`;
    }

    const statusCode = health.database === 'OK' ? 200 : 503;
    res.status(statusCode).json(health);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);

// Initialize Socket.IO handlers
initializeMeetingSocket(io);
initializeChatSocket(io);

// Error handling (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port http://localhost:${PORT}`);
    console.log(`Socket.IO initialized`);
    console.log(`CORS: ${process.env.FRONTEND_URL || 'https://streamsphere-iota.vercel.app'}`);
});
