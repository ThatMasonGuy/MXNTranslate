const sanitizeMessage = require("../utils/sanitizeMessage");
const fakeTranslate = require("../utils/fakeTranslate");
const reconstructMessage = require("../utils/reconstructMessage");

module.exports = async function translateFlow(text, langTo = "en") {
  if (!text || text.trim().length === 0) return null;

  const { sanitized, placeholders } = sanitizeMessage(text);

  const placeholderOnly = sanitized.replace(/<<\d+>>/g, "").trim();
  if (placeholderOnly.length === 0) return null;

  const translated = await fakeTranslate(sanitized, langTo);

  const reconstructed = reconstructMessage(translated, placeholders);

  return reconstructed;
};
