const { SlashCommandSubcommandBuilder, EmbedBuilder } = require("discord.js");
const axios = require("axios");
const db = require("../db");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("status")
    .setDescription("Check if systems are healthy"),

  async execute(interaction) {
    // Firebase status
    let firebaseStatus = "❌ Translator API: Unreachable";
    try {
      const res = await axios.options("https://mxn.au/translate/post", { timeout: 4000 });
      if (res.status === 204) firebaseStatus = "✅ Translator API: Responding";
    } catch (err) {
      firebaseStatus = `❌ Translator API: ${err.code || "Error"}`;
    }

    // DB summary
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
          name: "📦 Database",
          value: dbInfoLines.join("\n"),
          inline: false,
        },
        {
          name: "🌐 Translator API",
          value: firebaseStatus,
          inline: false,
        }
      )
      .setTimestamp()
      .setFooter({ text: "MXNTranslate Bot Health", iconURL: interaction.client.user.displayAvatarURL() });

    await interaction.reply({
      ephemeral: true,
      embeds: [embed],
    });
  },
};
