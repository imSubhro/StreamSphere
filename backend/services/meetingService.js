const db = require('../config/db');
const { generateMeetingCode } = require('../utils/codeGenerator');

async function createMeeting(hostId, title) {
    let meetingCode = generateMeetingCode();

    // Ensure unique code
    let existing = await db.query('SELECT id FROM meetings WHERE meeting_code = $1', [meetingCode]);
    while (existing.rows.length > 0) {
        meetingCode = generateMeetingCode();
        existing = await db.query('SELECT id FROM meetings WHERE meeting_code = $1', [meetingCode]);
    }

    const result = await db.query(
        `INSERT INTO meetings (meeting_code, title, host_id, status)
         VALUES ($1, $2, $3, 'SCHEDULED')
         RETURNING *`,
        [meetingCode, title || `Meeting ${meetingCode}`, hostId]
    );

    // Get host info
    const host = await db.query(
        'SELECT id, username, email, avatar_url FROM users WHERE id = $1',
        [hostId]
    );

    return { ...result.rows[0], host: host.rows[0] };
}

async function getMeetingByCode(meetingCode) {
    const result = await db.query(
        `SELECT m.*, 
                json_build_object('id', u.id, 'username', u.username, 'email', u.email, 'avatar_url', u.avatar_url) as host
         FROM meetings m
         JOIN users u ON m.host_id = u.id
         WHERE m.meeting_code = $1`,
        [meetingCode]
    );

    if (result.rows.length === 0) return null;

    // Get participants
    const participants = await db.query(
        `SELECT mp.*, 
                json_build_object('id', u.id, 'username', u.username, 'email', u.email, 'avatar_url', u.avatar_url) as user
         FROM meeting_participants mp
         JOIN users u ON mp.user_id = u.id
         WHERE mp.meeting_id = $1
         ORDER BY mp.joined_at DESC`,
        [result.rows[0].id]
    );

    return { ...result.rows[0], participants: participants.rows };
}

async function listUserMeetings(userId) {
    const result = await db.query(
        `SELECT m.*,
                jsonb_build_object('id', u.id, 'username', u.username, 'email', u.email) as host
         FROM meetings m
         JOIN users u ON m.host_id = u.id
         WHERE m.host_id = $1
            OR EXISTS (
                SELECT 1 FROM meeting_participants mp
                WHERE mp.meeting_id = m.id AND mp.user_id = $1
            )
         ORDER BY m.created_at DESC
         LIMIT 5`,
        [userId]
    );

    return result.rows;
}

async function joinMeeting(meetingId, userId, isHost = false) {
    // Check if already in meeting
    const existing = await db.query(
        'SELECT * FROM meeting_participants WHERE meeting_id = $1 AND user_id = $2 AND left_at IS NULL',
        [meetingId, userId]
    );

    if (existing.rows.length > 0) return existing.rows[0];

    const participant = await db.query(
        `INSERT INTO meeting_participants (meeting_id, user_id, role)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [meetingId, userId, isHost ? 'HOST' : 'PARTICIPANT']
    );

    // Set meeting to ACTIVE
    await db.query(
        `UPDATE meetings SET status = 'ACTIVE', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
         WHERE id = $1`,
        [meetingId]
    );

    return participant.rows[0];
}

async function leaveMeeting(meetingId, userId) {
    await db.query(
        `UPDATE meeting_participants SET left_at = NOW()
         WHERE meeting_id = $1 AND user_id = $2 AND left_at IS NULL`,
        [meetingId, userId]
    );

    // Check if everyone left
    const active = await db.query(
        'SELECT COUNT(*) as count FROM meeting_participants WHERE meeting_id = $1 AND left_at IS NULL',
        [meetingId]
    );

    if (parseInt(active.rows[0].count) === 0) {
        await db.query(
            `UPDATE meetings SET status = 'ENDED', ended_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [meetingId]
        );
    }

    return true;
}

async function saveChatMessage(meetingId, userId, message) {
    const result = await db.query(
        `INSERT INTO chat_messages (meeting_id, user_id, message, message_type)
         VALUES ($1, $2, $3, 'TEXT')
         RETURNING *`,
        [meetingId, userId, message]
    );
    return result.rows[0];
}

async function getChatMessages(meetingId) {
    const result = await db.query(
        `SELECT cm.id, cm.user_id, cm.message, cm.created_at,
                json_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url) as user
         FROM chat_messages cm
         JOIN users u ON cm.user_id = u.id
         WHERE cm.meeting_id = $1
         ORDER BY cm.created_at ASC
         LIMIT 200`,
        [meetingId]
    );
    return result.rows;
}

module.exports = {
    createMeeting,
    getMeetingByCode,
    listUserMeetings,
    joinMeeting,
    leaveMeeting,
    saveChatMessage,
    getChatMessages
};
