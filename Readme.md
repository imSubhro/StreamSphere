# 📺 LiveStream + Chat Platform

A full-stack project where users can **start live streams** and others can **watch via a unique stream ID**. Viewers can also participate in a **real-time general chat**. Built with **Next.js (frontend)**, **WebRTC (streaming)**, and **WebSockets (chat + signaling)**, with an **Express.js backend**.

---

## 🚀 Features

* 🔴 Start a live stream (with camera + mic).
* 👀 Watch streams by unique link/ID.
* 💬 Real-time chat for each stream.
* 🔑 Secure authentication with JWT.
* 🛡️ Stream keys to prevent hijacking.
* 📊 Scalable architecture (Redis, Docker, Kubernetes ready).

---

## 🛠️ Tech Stack

### Frontend

* [Next.js](https://nextjs.org/) – React-based framework.
* [TailwindCSS](https://tailwindcss.com/) – Styling.
* WebRTC API – Handle live video/audio.
* WebSocket client – Real-time chat + signaling.

### Backend

* [Express.js](https://expressjs.com/) – Node.js API + signaling.
* [Socket.IO](https://socket.io/) – WebSocket communication.
* PostgreSQL (supabase) – User, stream, and chat storage.
* Redis – Scaling WebSockets.
* MediaSoup / LiveKit – WebRTC media server (optional for production).

### Security

* JWT for user authentication.
* Unique stream keys.
* HTTPS + WSS (secure traffic).
* Rate limiting for chat spam protection.

---

## 📂 Project Structure

```
StreamSphere/
├── backend/               # Express.js backend
│   ├── server.js          # Express entrypoint
│   ├── package.json       # Node.js dependencies
│   └── ...
├── frontend/              # Next.js frontend
│   ├── pages/
│   │   ├── index.tsx      # Landing page
│   │   ├── stream/[id].tsx # Stream room page
│   ├── components/        # Reusable UI components
│   └── ...
├── docker-compose.yml     # For local setup
├── README.md              # Documentation
└── ...
```

---

## 🏁 Getting Started

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/yourusername/StreamSphere.git
cd StreamSphere
```

### 2️⃣ Setup Backend (Express)

```bash
cd backend
npm install
npm start
```

Backend will run on: `http://localhost:5000`

### 3️⃣ Setup Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on: `http://localhost:3000`

---

## 🔧 How It Works

### 🎥 Live Streaming (WebRTC)

1. Streamer clicks **Start Stream**.
2. Browser uses `getUserMedia()` to capture camera/mic.
3. WebRTC sends stream to backend (via WebSocket signaling).
4. Backend distributes stream to viewers.

### 💬 Real-time Chat (WebSocket)

1. Viewer joins a stream room.
2. Client connects to WebSocket (`wss://.../chat`).
3. Messages are broadcast to everyone in that room.

---

## 🔒 Security Implementation

* **JWT Authentication** – Only logged-in users can start/join streams.
* **Stream Keys** – Each stream requires a unique key.
* **HTTPS/WSS** – Encrypts data.
* **Rate Limiting** – Prevents spam.

---

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## 📜 License

MIT License – feel free to use and modify.

---

