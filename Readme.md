# 🎬 StreamSphere

A modern, real-time video conferencing and live streaming platform built with **Next.js**, **WebRTC**, and **Socket.IO**. Start meetings, share your screen, and chat with participants — all with low-latency peer-to-peer connections.

[![Live Demo](https://img.shields.io/badge/Demo-streamsphere--iota.vercel.app-blue?style=for-the-badge)](https://streamsphere-iota.vercel.app)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎥 **Video Meetings** | Create or join meetings with unique room codes |
| 🔴 **Live Streaming** | Start streams with camera + mic, viewers join via link |
| 💬 **Real-time Chat** | Instant messaging within meeting rooms |
| 🔒 **Authentication** | Secure JWT-based user accounts |
| 🖥️ **Screen Sharing** | Share your screen with participants |
| 🎛️ **Media Controls** | Mute/unmute audio, toggle video on/off |
| ⚡ **Low Latency** | P2P WebRTC connections for minimal delay |
| 🌐 **Responsive** | Works on desktop and mobile browsers |

---

## 🛠️ Tech Stack

**Frontend**
- Next.js 16 + TypeScript
- TailwindCSS
- WebRTC API
- Socket.IO Client

**Backend**
- Express.js + Node.js
- Socket.IO (signaling + chat)
- PostgreSQL (Supabase)
- JWT Authentication

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database (or Supabase account)

### 1. Clone & Install

```bash
git clone https://github.com/imSubhro/StreamSphere.git
cd StreamSphere

# Install backend
cd backend && npm install

# Install frontend
cd ../frontend && npm install
```

### 2. Configure Environment

**Backend** (`backend/.env`):
```env
DATABASE_URL= 
JWT_SECRET=
FRONTEND_URL= 
PORT=
```

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

### 3. Run Development Servers

```bash
# Terminal 1 - Backend
cd backend && npm start

# Terminal 2 - Frontend
cd frontend && npm run dev
```

---

## 🔧 How It Works

### Video/Audio Streaming
1. User clicks **Create Meeting** → generates unique room code
2. Browser captures camera/mic via `getUserMedia()`
3. WebRTC peer connections established between participants
4. Signaling (offers/answers/ICE candidates) handled via Socket.IO

### Real-time Chat
1. Users join a meeting room
2. Socket.IO connection established
3. Messages broadcast to all room participants instantly


---

## 📄 License

MIT License — free to use and modify.

---

**made with ❤️ by [Subhro](https://github.com/imSubhro)**
