// commands/utils/status.js - Simple fix using db directly
const { SlashCommandSubcommandBuilder, EmbedBuilder } = require("discord.js");
const axios = require("axios");
const db = require("../../db");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("status")
    .setDescription("Check if systems are healthy"),

  async execute(interaction) {
    try {
      // Acknowledge interaction immediately to prevent timeout
      await interaction.deferReply({ flags: 64 }); // flags: 64 = ephemeral

      // Firebase/Translation API status
      let firebaseStatus = "❌ Translator API: Unreachable";
      try {
        const res = await axios.options("https://mxn.au/translate/post", { timeout: 3000 });
        if (res.status === 204) firebaseStatus = "✅ Translator API: Responding";
      } catch (err) {
        firebaseStatus = `❌ Translator API: ${err.code || "Error"}`;
      }

      // DB summary (direct database access)
      let dbInfoLines = [];
      try {
        const stats = db.prepare(`
          SELECT
            (SELECT COUNT(*) FROM guilds) AS guildCount,
            (SELECT COUNT(*) FROM authors) AS authorCount,
            (SELECT COUNT(*) FROM messages) AS messageCount,
            (SELECT COUNT(*) FROM reactions) AS reactionCount
        `).get();

        dbInfoLines.push(`🏘️ **Servers:** ${stats.guildCount}`);
        dbInfoLines.push(`👤 **Users:** ${stats.authorCount}`);
        dbInfoLines.push(`💬 **Messages:** ${stats.messageCount}`);
        dbInfoLines.push(`🎯 **Reactions:** ${stats.reactionCount}`);
      } catch (err) {
        dbInfoLines.push(`❌ DB Error: ${err.message}`);
      }

      const embed = new EmbedBuilder()
        .setColor("#8be9fd")
        .setTitle("🧪 System Status")
        .addFields(
          {
            name: "💾 Database",
            value: dbInfoLines.join("\n"),
            inline: false,
          },
          {
            name: "🌍 Translator API",
            value: firebaseStatus,
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({ text: "MXNTranslate Bot Health", iconURL: interaction.client.user.displayAvatarURL() });

      await interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      console.error("Status command error:", error);
      try {
        if (interaction.deferred) {
          await interaction.editReply({ content: "❌ Status check failed!" });
        } else {
          await interaction.reply({ content: "❌ Status check failed!", flags: 64 });
        }
      } catch (replyError) {
        console.error("Failed to send error response:", replyError);
      }
    }
  },
};
