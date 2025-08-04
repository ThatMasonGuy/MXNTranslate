const axios = require("axios");

module.exports = async function translateFlow(content, fromLang = "detect", targetLang = "en", discordMeta = {}) {
  if (!content || content.trim().length === 0) return null;

  try {
    const response = await axios.post(
      "https://mxn.au/translate/post",
      {
        content,
        fromLang,
        targetLang,
        platform: "discord", // This ensures platform-specific tracking
        ...discordMeta, // userId, guildId, channelId, etc.
      },
      {
        headers: {
          "x-openai-key": process.env.OPENAI_KEY,
          "x-discord-bot": "true", // Flag for platform-specific logic
        },
      }
    );

    return response.data.translated || response.data.outputText || null;
  } catch (err) {
    console.error("❌ Translation request failed:", err.message);
    return null;
  }
};
