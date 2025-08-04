// bot/cache/translatedCache.js
const redis = require("./redisClient");

const EXPIRATION_SECONDS = 86400; // 24 hours cache expiration (adjust as needed)

function generateKey(messageId, langCode) {
  return `translated:${messageId}:${langCode}`;
}

module.exports = {
  async isAlreadyTranslated(messageId, lang) {
    const key = generateKey(messageId, lang);
    const exists = await redis.exists(key);
    return exists === 1;
  },

  async markTranslated(messageId, lang) {
    const key = generateKey(messageId, lang);
    await redis.set(key, '1', 'EX', EXPIRATION_SECONDS);
  },

  async getTranslatedLanguages(messageId) {
    const keys = await redis.keys(`translated:${messageId}:*`);
    return keys.map(key => key.split(':')[2]);
  },
};
