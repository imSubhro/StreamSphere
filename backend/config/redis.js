const { createClient } = require('redis');
require('dotenv').config();

const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('error', (err) => {
    console.warn('Redis Client Error', err.message);
    // Prevent crash on connection error
});

(async () => {
    try {
        if (!client.isOpen) {
            await client.connect();
            console.log('Connected to Redis');
        }
    } catch (err) {
        console.warn('Failed to connect to Redis. Features dependent on Redis (Scaling, Rate Limiting) may not work.');
    }
})();

module.exports = client;
