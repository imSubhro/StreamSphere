const crypto = require('crypto');

/**
 * Generates a unique meeting code in Google Meet style: abc-defg-hij
 */
function generateMeetingCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const segments = [3, 4, 3];

    const code = segments.map(len => {
        let segment = '';
        for (let i = 0; i < len; i++) {
            segment += chars[crypto.randomBytes(1)[0] % chars.length];
        }
        return segment;
    }).join('-');

    return code;
}

module.exports = { generateMeetingCode };
