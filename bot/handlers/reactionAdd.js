const flagMap = require("../utils/flagMap");
const translateFlow = require("../logic/translateFlow");
const cache = require("../cache/translatedCache");
const { logTranslation } = require("../cache/translateLogs");

module.exports = async function handleReactionAdd(reaction, user) {
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const flag = reaction.emoji.name;
    const targetLang = flagMap[flag];
    if (!targetLang) return;

    if (reaction.message.author?.bot) {
      logTranslation(reaction.message.id, targetLang, "denied", "bot message");
      return;
    }

    if (cache.isAlreadyTranslated(reaction.message.id, targetLang)) {
      console.log(
        `⏩ Already translated ${reaction.message.id} to ${targetLang}`
      );
      logTranslation(reaction.message.id, targetLang, "denied", "duplicate");
      return;
    }

    const original = reaction.message.content;
    const translated = await translateFlow(original, targetLang);

    if (!translated) {
      console.log(
        `🚫 Skipping translation: Nothing to translate in message ${reaction.message.id}`
      );
      logTranslation(
        reaction.message.id,
        targetLang,
        "denied",
        "empty content"
      );
      return;
    }

    await reaction.message.channel.send({
      content: `🗨️ **Translated from ${flag} by ${user.username}:**\n${translated}`,
    });

    cache.markTranslated(reaction.message.id, targetLang);
    logTranslation(reaction.message.id, targetLang, "success");
  } catch (err) {
    console.error("⚠️ Error in reaction handler:", err);
  }
};
