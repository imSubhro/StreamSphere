const meetingService = require('../services/meetingService');

exports.createMeeting = async (req, res) => {
    try {
        const userId = req.user.id;
        const { title } = req.body;

        const meeting = await meetingService.createMeeting(userId, title);
        res.status(201).json({ meeting });
    } catch (err) {
        console.error('Create meeting error:', err.message);
        res.status(500).json({ error: 'Failed to create meeting' });
    }
};

exports.getMeeting = async (req, res) => {
    try {
        const { code } = req.params;
        const meeting = await meetingService.getMeetingByCode(code);

        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        res.json({ meeting });
    } catch (err) {
        console.error('Get meeting error:', err.message);
        res.status(500).json({ error: 'Failed to get meeting' });
    }
};

exports.listMeetings = async (req, res) => {
    try {
        const userId = req.user.id;
        const meetings = await meetingService.listUserMeetings(userId);
        res.json({ meetings });
    } catch (err) {
        console.error('List meetings error:', err.message);
        res.status(500).json({ error: 'Failed to list meetings' });
    }
};

exports.joinMeeting = async (req, res) => {
    try {
        const userId = req.user.id;
        const { code } = req.params;

        const meeting = await meetingService.getMeetingByCode(code);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        const isHost = meeting.host_id === userId;
        const participant = await meetingService.joinMeeting(meeting.id, userId, isHost);

        res.json({ participant, meeting });
    } catch (err) {
        console.error('Join meeting error:', err.message);
        res.status(500).json({ error: 'Failed to join meeting' });
    }
};

exports.leaveMeeting = async (req, res) => {
    try {
        const userId = req.user.id;
        const { code } = req.params;

        const meeting = await meetingService.getMeetingByCode(code);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        await meetingService.leaveMeeting(meeting.id, userId);
        res.json({ success: true });
    } catch (err) {
        console.error('Leave meeting error:', err.message);
        res.status(500).json({ error: 'Failed to leave meeting' });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const { code } = req.params;

        const meeting = await meetingService.getMeetingByCode(code);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        const messages = await meetingService.getChatMessages(meeting.id);
        res.json({ messages });
    } catch (err) {
        console.error('Get messages error:', err.message);
        res.status(500).json({ error: 'Failed to get messages' });
    }
};
