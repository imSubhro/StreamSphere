const meetingService = require('../services/meetingService');

function initializeChatSocket(io) {
    io.on('connection', (socket) => {

        // Send chat message — persists to DB
        socket.on('send-message', async ({ roomId, userId, userName, message }) => {
            try {
                // Prefer server-verified identity from the JWT over client-supplied values
                const uid = socket.user?.id || userId;
                const uname = socket.user?.username || userName;
                console.log(`Chat: ${uname} in room ${roomId}`);

                // Try to save to DB (gracefully handle DB errors)
                let savedMsg = null;
                try {
                    const meeting = await meetingService.getMeetingByCode(roomId);
                    if (meeting) {
                        savedMsg = await meetingService.saveChatMessage(meeting.id, uid, message);
                    }
                } catch (dbErr) {
                    console.warn('Could not persist chat message:', dbErr.message);
                }

                // Broadcast to all participants regardless of DB status
                io.to(roomId).emit('new-message', {
                    id: savedMsg?.id || Date.now().toString(),
                    userId: uid,
                    userName: uname,
                    message,
                    timestamp: savedMsg?.created_at || new Date().toISOString(),
                });
            } catch (err) {
                console.error('Chat error:', err);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Emoji reactions
        socket.on('send-reaction', ({ roomId, emoji, userName }) => {
            io.to(roomId).emit('reaction', {
                socketId: socket.id,
                userName,
                emoji,
                timestamp: Date.now(),
            });
        });
    });
}

module.exports = { initializeChatSocket };
