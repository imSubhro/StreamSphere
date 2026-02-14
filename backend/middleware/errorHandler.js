function errorHandler(err, _req, res, _next) {
    console.error('Error:', err.message);

    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: 'Validation error', message: err.message });
    }

    if (err.code === '23505') {
        return res.status(409).json({ error: 'Resource already exists' });
    }

    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    });
}

module.exports = { errorHandler };
