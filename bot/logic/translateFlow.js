const sanitizeMessage = require("../utils/sanitizeMessage");
const reconstructMessage = require("../utils/reconstructMessage");
const axios = require("axios");

module.exports = async function translateFlow(text, langTo = "en") {
  if (!text || text.trim().length === 0) return null;

  const { sanitized, placeholders } = sanitizeMessage(text);

  // If message is just <<1>> <<2>> etc. skip translation
  const placeholderOnly = sanitized.replace(/<<\d+>>/g, "").trim();
  if (placeholderOnly.length === 0) return null;

  try {
    const response = await axios.post("http://localhost:3600/translate", {
      text: sanitized,
      langTo,
      placeholders,
    });

    const translated = response.data.translated;
    return reconstructMessage(translated, placeholders);
  } catch (err) {
    console.error("❌ Bot translation error:", err.message);
    return null;
  }
};
