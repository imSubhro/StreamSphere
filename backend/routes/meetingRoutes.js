const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const authMiddleware = require('../middleware/authMiddleware');

// All meeting routes require authentication
router.use(authMiddleware);

router.post('/', meetingController.createMeeting);
router.get('/', meetingController.listMeetings);
router.get('/:code/messages', meetingController.getMessages);
router.get('/:code', meetingController.getMeeting);
router.post('/:code/join', meetingController.joinMeeting);
router.post('/:code/leave', meetingController.leaveMeeting);

module.exports = router;
