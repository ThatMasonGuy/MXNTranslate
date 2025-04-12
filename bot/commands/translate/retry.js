const { SlashCommandSubcommandBuilder } = require("discord.js");
const translateFlow = require("../../logic/translateFlow");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("retry")
    .setDescription("Manually retry a translation for a message")
    .addStringOption((opt) =>
      opt
        .setName("message_id")
        .setDescription("Message ID to retry")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("lang")
        .setDescription("Language code (e.g., es, ja)")
        .setRequired(true)
    ),

  async execute(interaction) {
    const messageId = interaction.options.getString("message_id");
    const lang = interaction.options.getString("lang");

    try {
      const msg = await interaction.channel.messages.fetch(messageId);
      if (!msg || msg.author?.bot) {
        return interaction.reply({
          content: "❌ Message not found or is a bot message.",
          flags: 64,
        });
      }

      const translated = await translateFlow(msg.content, lang);
      if (!translated) {
        return interaction.reply({
          content: "🚫 Nothing to translate in that message.",
          flags: 64,
        });
      }

      await msg.channel.send({
        content: `🗨️ **(Manual Retry) Translated to ${lang} by ${interaction.user.username}:**\n${translated}`,
      });

      await interaction.reply({
        content: "✅ Translation sent.",
        flags: 64,
      });
    } catch (err) {
      console.error("❌ Retry failed:", err);
      await interaction.reply({
        content: "❌ Failed to retry translation.",
        flags: 64,
      });
    }
  },
};
