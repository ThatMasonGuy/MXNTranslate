// bot/cache/translatedCache.js
const translated = new Set();

function generateKey(messageId, langCode) {
  return `${messageId}:${langCode}`;
}

module.exports = {
  isAlreadyTranslated(messageId, lang) {
    return translated.has(generateKey(messageId, lang));
  },
  markTranslated(messageId, lang) {
    translated.add(generateKey(messageId, lang));
  },
  getTranslatedLanguages(messageId) {
    return [...translated]
      .filter((key) => key.startsWith(`${messageId}:`))
      .map((key) => key.split(":")[1]);
  },
};
