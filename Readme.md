# 📺 LiveStream + Chat Platform

A full-stack project where users can **start live streams** and others can **watch via a unique stream ID**. Viewers can also participate in a **real-time general chat**. Built with **Next.js (frontend)**, **WebRTC (P2P Mesh)**, and **WebSockets (chat + signaling)**, with an **Express.js backend**.

---

## 🚀 Features

* 🔴 Start a live stream (with camera + mic).
* 👀 Watch streams by unique link/ID.
* 💬 Real-time chat for each stream.
* � Optional password protection for streams.
* 🛡️ Stream keys to prevent hijacking.
* ⚡ Low-latency P2P streaming.

---

## 🛠️ Tech Stack

### Frontend

* [Next.js](https://nextjs.org/) – React-based framework.
* [TailwindCSS](https://tailwindcss.com/) – Styling.
* WebRTC API – Handle live video/audio (P2P Mesh).
* WebSocket client – Real-time chat + signaling.

### Backend

* [Express.js](https://expressjs.com/) – Node.js API + signaling.
* [Socket.IO](https://socket.io/) – WebSocket communication.
* In-Memory Storage – Temporary storage for active streams and passwords.

### Security

* Unique stream keys.
* Password protection for rooms.
* HTTPS + WSS (secure traffic).

---

## 📂 Project Structure

```
StreamSphere/
├── backend/               # Express.js backend
│   ├── server.js          # Express entrypoint
│   ├── package.json       # Node.js dependencies
│   └── ...
├── frontend/              # Next.js frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.tsx      # Landing page
│   │   │   ├── stream/[id].tsx # Stream room page
│   │   ├── components/        # Reusable UI components
│   └── ...
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

Backend will run on: `http://localhost:5002`

### 3️⃣ Setup Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on: `http://localhost:3000`

---

## 🔧 How It Works

### 🎥 Live Streaming (WebRTC P2P)

1. Streamer clicks **Start Stream**.
2. Browser uses `getUserMedia()` to capture camera/mic.
3. WebRTC connections are established directly between Streamer and Viewers (Mesh topology).
4. Signaling (offers/answers/candidates) is handled via Socket.IO.

### 💬 Real-time Chat (WebSocket)

1. Viewer joins a stream room.
2. Client connects to WebSocket (`wss://...`).
3. Messages are broadcast to everyone in that room.

---

## �️ Roadmap (Planned Features)

* [x] **Database**: PostgreSQL (Supabase) for persistent user/stream data.
* [x] **Authentication**: JWT for secure user accounts.
* [x] **Scaling**: Redis for WebSocket scaling.
* [x] **Video Quality**: Simulcast (ABR) for adaptive bitrate streaming.
* [ ] **Media Server**: Switch from P2P Mesh to SFU (MediaSoup/LiveKit) for better scalability with many viewers.
* [ ] **Rate Limiting**: Add protection against spam.

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## 📜 License

MIT License – feel free to use and modify.

---












<!-- 
4. NEW FEATURES TO ADD (Highly Recommended)
🎥 1. Multi-Device Support

Mobile streaming

Mobile viewing with responsive layout

💬 2. Emoji Reactions / Floating Hearts

Like Instagram Live.

📢 3. Stream Dashboard for Creators

Real-time viewer count

Stream key reset

Chat moderation tools

Ban user / mute user

🎙️ 4. Screen Sharing

Add:

navigator.mediaDevices.getDisplayMedia()

🔄 5. Recording + VOD

Save streams using:

MediaRecorder API (client-side)
or

SFU integrated recording (server-side)

👤 6. Profile + Follow System

Users can follow creators

Notification when creator goes live

👁‍🗨 7. Thumbnail + Title

Every stream has:

Title

Description

Thumbnail
(saved inside PostgreSQL or Supabase)

🧩 8. Chat Features

Chat roles (Admin / Moderator / Viewer)

Slow mode

Message pinning

Polls

🌈 9. Dark Mode + Themes

Add Tailwind dark mode. -->