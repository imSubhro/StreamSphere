const roomParticipants = {};

function initializeMeetingSocket(io) {
    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // Join meeting room
        socket.on('join-room', ({ roomId, userId, userName }) => {
            // Prefer server-verified identity from the JWT over client-supplied values
            const uid = socket.user?.id || userId;
            const uname = socket.user?.username || userName;
            console.log(`User ${uname} (${uid}) joining room ${roomId}`);
            socket.join(roomId);

            if (!roomParticipants[roomId]) {
                roomParticipants[roomId] = new Set();
            }
            roomParticipants[roomId].add(socket.id);

            // Store user info on socket for disconnect handling
            socket.userData = { roomId, userId: uid, userName: uname };

            // Tell new user about existing participants
            const existing = Array.from(roomParticipants[roomId]).filter(id => id !== socket.id);
            socket.emit('existing-participants', {
                participants: existing.map(id => {
                    const info = io.sockets.sockets.get(id)?.userData || {};
                    return { socketId: id, userName: info.userName, userId: info.userId };
                }),
            });

            // Tell others about new user
            socket.to(roomId).emit('user-joined', {
                socketId: socket.id,
                userId: uid,
                userName: uname,
            });

            // Broadcast participant count
            io.to(roomId).emit('participant-count', roomParticipants[roomId].size);
            console.log(`Room ${roomId} now has ${roomParticipants[roomId].size} participants`);
        });

        // WebRTC signaling
        socket.on('offer', ({ offer, to, userName }) => {
            io.to(to).emit('offer', { offer, from: socket.id, userName, userId: socket.user?.id });
        });

        socket.on('answer', ({ answer, to }) => {
            io.to(to).emit('answer', { answer, from: socket.id });
        });

        socket.on('ice-candidate', ({ candidate, to }) => {
            io.to(to).emit('ice-candidate', { candidate, from: socket.id });
        });

        // Media toggle notifications
        socket.on('toggle-media', ({ roomId, type, enabled }) => {
            socket.to(roomId).emit('user-toggled-media', {
                socketId: socket.id,
                type,
                enabled,
            });
        });

        // Screen share state notifications
        socket.on('share-screen', ({ roomId, sharing }) => {
            socket.to(roomId).emit('user-shared-screen', {
                socketId: socket.id,
                sharing,
            });
        });

        // Leave room
        socket.on('leave-room', ({ roomId }) => {
            handleUserLeaving(socket, io, roomId);
        });

        // Disconnect cleanup
        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
            Object.keys(roomParticipants).forEach(roomId => {
                if (roomParticipants[roomId]?.has(socket.id)) {
                    handleUserLeaving(socket, io, roomId);
                }
            });
        });
    });
}

function handleUserLeaving(socket, io, roomId) {
    console.log(`User ${socket.id} leaving room ${roomId}`);

    if (roomParticipants[roomId]) {
        roomParticipants[roomId].delete(socket.id);

        if (roomParticipants[roomId].size === 0) {
            delete roomParticipants[roomId];
        } else {
            io.to(roomId).emit('participant-count', roomParticipants[roomId].size);
        }
    }

    socket.to(roomId).emit('user-left', { socketId: socket.id });
    socket.leave(roomId);
}

module.exports = { initializeMeetingSocket };
