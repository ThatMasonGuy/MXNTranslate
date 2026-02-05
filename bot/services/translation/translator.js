// services/translation/translator.js
const axios = require("axios");

class Translator {
  async translate(content, fromLang = "detect", targetLang = "en", discordMeta = {}) {
    if (!content || content.trim().length === 0) return null;

    try {
      const translationStartTime = Date.now();
      
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

      const responseTime = Date.now() - translationStartTime;
      const data = response.data;

      // Fire-and-forget async logging (non-blocking)
      if (data.logData) {
        this.logTranslation(data, responseTime).catch(err => {
          console.warn('Translation logging failed (non-critical):', err.message);
        });
      }

      return data.translated || data.outputText || null;
    } catch (err) {
      console.error("Translation request failed:", err.message);
      throw new Error(`Translation failed: ${err.message}`);
    }
  }

  /**
   * Fire-and-forget logging to /log/post endpoint
   * @param {Object} data - Translation response data
   * @param {number} responseTime - Client request time in ms
   */
  async logTranslation(data, responseTime) {
    try {
      await axios.post(
        "https://mxn.au/log/post",
        {
          translationData: {
            inputText: data.inputText,
            sourceLang: data.sourceLang,
            targetLang: data.targetLang,
            translated: data.translated,
            modelUsed: data.modelUsed,
            tokenUsage: data.tokenUsage,
            wordCount: data.wordCount,
            charCount: data.charCount,
          },
          cached: data.cached,
          responseTime: responseTime,
          platform: data.logData.platform,
          platformInfo: data.logData.platformInfo,
          version: data.logData.version,
        },
        {
          timeout: 5000, // Don't wait too long for logging
        }
      );
    } catch (err) {
      // Don't throw - logging failures shouldn't break translations
      throw err;
    }
  }
}

module.exports = Translator;