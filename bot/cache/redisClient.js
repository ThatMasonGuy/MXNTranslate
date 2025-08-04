const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

redis.on('connect', () => console.log(' ^=^= Redis (bot-side) connected'));
redis.on('error', err => console.error(' ^=^t Redis (bot-side) error', err));

module.exports = redis;
