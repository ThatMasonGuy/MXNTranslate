// reactionAdd.js
const flagMap = require("../utils/flagMap");
const translateFlow = require("../logic/translateFlow");
const cache = require("../cache/translatedCache");
const { logTranslation } = require("../cache/translateLogs");
const db = require('../db');

module.exports = async function handleReactionAdd(reaction, user) {
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    if (!user.bot) {
      // Upsert author
      db.prepare(`
        INSERT OR REPLACE INTO authors (id, name, nickname, discriminator, color, is_bot, avatar_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        user.id,
        user.username,
        user.nickname ?? null,
        user.discriminator ?? null,
        null,
        user.bot ? 1 : 0,
        user.displayAvatarURL?.({ extension: "png", size: 128 }) ?? null
      );

      // Upsert or update the reaction row
      const reactionRow = db.prepare(`
        SELECT id FROM reactions
        WHERE message_id = ? AND emoji_name = ? AND (emoji_id IS ? OR emoji_id IS NULL)
        ORDER BY id DESC LIMIT 1
      `).get(
        reaction.message.id,
        reaction.emoji.name,
        reaction.emoji.id ?? null
      );

      let reactionId;
      if (reactionRow) {
        db.prepare(`
          UPDATE reactions SET count = ? WHERE id = ?
        `).run(
          reaction.count,
          reactionRow.id
        );
        reactionId = reactionRow.id;
      } else {
        db.prepare(`
          INSERT INTO reactions (message_id, emoji_name, emoji_id, count)
          VALUES (?, ?, ?, ?)
        `).run(
          reaction.message.id,
          reaction.emoji.name,
          reaction.emoji.id ?? null,
          reaction.count
        );
        // Get the new reaction id
        reactionId = db.prepare(`
          SELECT id FROM reactions
          WHERE message_id = ? AND emoji_name = ? AND (emoji_id IS ? OR emoji_id IS NULL)
          ORDER BY id DESC LIMIT 1
        `).get(
          reaction.message.id,
          reaction.emoji.name,
          reaction.emoji.id ?? null
        )?.id;
      }

      // Insert or ignore user reaction link
      if (reactionId) {
        db.prepare(`
          INSERT OR IGNORE INTO reaction_users (reaction_id, user_id)
          VALUES (?, ?)
        `).run(reactionId, user.id);
      }
    }

    // ---- Your Translation Logic ----
    const flag = reaction.emoji.name;
    const targetLang = flagMap[flag];
    if (!targetLang) return;

    if (reaction.message.author?.bot) {
      logTranslation(reaction.message.id, targetLang, "denied", "bot message");
      return;
    }

    if (await cache.isAlreadyTranslated(reaction.message.id, targetLang)) {
      console.log(
        ` ^o  Already translated ${reaction.message.id} to ${targetLang}`
      );
      logTranslation(reaction.message.id, targetLang, "denied", "duplicate");
      return;
    }

    const original = reaction.message.content;
    const translated = await translateFlow(original, targetLang);

    if (!translated) {
      console.log(
        ` ^=^z  Skipping translation: Nothing to translate in message ${reaction.message.id}`
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
      content: `**Translated to ${flag} by ${user.username}:**\n${translated}`,
    });

    await cache.markTranslated(reaction.message.id, targetLang);
    logTranslation(reaction.message.id, targetLang, "success");
  } catch (err) {
    console.error(" ^z   ^o Error in reaction handler:", err);
  }
};
