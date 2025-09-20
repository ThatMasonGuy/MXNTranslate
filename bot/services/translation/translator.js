// services/translation/translator.js
const axios = require("axios");

class Translator {
  async translate(content, fromLang = "detect", targetLang = "en", discordMeta = {}) {
    if (!content || content.trim().length === 0) return null;

    try {
      const response = await axios.post(
        "https://mxn.au/translate/post",
        {
          content,
          fromLang,
          targetLang,
          platform: "discord",
          ...discordMeta,
        },
        {
          headers: {
            "x-openai-key": process.env.OPENAI_KEY,
            "x-discord-bot": "true",
          },
        }
      );

      return response.data.translated || response.data.outputText || null;
    } catch (err) {
      console.error("Translation request failed:", err.message);
      throw new Error(`Translation failed: ${err.message}`);
    }
  }
}

module.exports = Translator;
