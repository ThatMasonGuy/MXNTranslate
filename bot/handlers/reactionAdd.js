// reactionAdd.js
const flagMap = require("../utils/flagMap");
const translateFlow = require("../logic/translateFlow");
const db = require('../db');
const { EmbedBuilder } = require("discord.js");

module.exports = async function handleReactionAdd(reaction, user) {
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    if (!user.bot) {
      // Upsert author (Discord user)
      db.prepare(`
        INSERT OR REPLACE INTO authors
          (id, name, nickname, discriminator, color, is_bot, avatar_url, created_at, joined_at, is_webhook)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        user.id,
        user.username,
        user.nickname ?? null,
        user.discriminator ?? null,
        null, // color
        user.bot ? 1 : 0,
        user.displayAvatarURL?.({ extension: "png", size: 128 }) ?? null,
        user.createdAt?.toISOString?.() ?? null,
        guildMember?.joinedAt?.toISOString?.() ?? null,
        user.isWebhook ? 1 : 0
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
          INSERT INTO reactions (message_id, emoji_name, emoji_id, count, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          reaction.message.id,
          reaction.emoji.name,
          reaction.emoji.id ?? null,
          reaction.count,
          new Date().toISOString()
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

    // ---- Updated Translation Logic ----
    const flag = reaction.emoji.name;
    const targetLang = flagMap[flag];
    if (!targetLang) return;

    // Don’t translate bot messages
    if (reaction.message.author?.bot) return;

    const original = reaction.message.content;

    // Send to Firebase function
    const translated = await translateFlow(original, "detect", targetLang, {
      discordUserId: user.id,
      userName: user.username,
      guildId: reaction.message.guild?.id,
      channelId: reaction.message.channel?.id,
      guildName: reaction.message.guild?.name,
      channelName: reaction.message.channel?.name,
    });

    if (!translated) {
      console.log(` ^=^z  Skipping translation: Nothing returned for ${reaction.message.id}`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor("#50fa7b") // Soft green
      .setAuthor({ name: `Translated to ${targetLang.toUpperCase()} ${flag}` })
      .setDescription(translated)
      .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL({ extension: "png" }) });

    await reaction.message.channel.send({ embeds: [embed] });

  } catch (err) {
    console.error(" ^z   ^o Error in reaction handler:", err);
  }
};
