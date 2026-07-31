function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is required. Set it in backend/.env');
    }
    return secret;
}

module.exports = { getJwtSecret };
