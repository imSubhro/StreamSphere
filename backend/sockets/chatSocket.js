const meetingService = require('../services/meetingService');

function initializeChatSocket(io) {
    io.on('connection', (socket) => {

        // Send chat message — persists to DB
        socket.on('send-message', async ({ roomId, userId, userName, message }) => {
            try {
                console.log(`Chat: ${userName} in room ${roomId}`);

                // Try to save to DB (gracefully handle DB errors)
                let savedMsg = null;
                try {
                    const meeting = await meetingService.getMeetingByCode(roomId);
                    if (meeting) {
                        savedMsg = await meetingService.saveChatMessage(meeting.id, userId, message);
                    }
                } catch (dbErr) {
                    console.warn('Could not persist chat message:', dbErr.message);
                }

                // Broadcast to all participants regardless of DB status
                io.to(roomId).emit('new-message', {
                    id: savedMsg?.id || Date.now().toString(),
                    userId,
                    userName,
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
