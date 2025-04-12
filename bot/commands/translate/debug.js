const { SlashCommandSubcommandBuilder } = require("discord.js");
const cache = require("../../cache/translatedCache");
const sanitizeMessage = require("../../utils/sanitizeMessage");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("debug")
    .setDescription("Debug translation info for a message")
    .addStringOption((opt) =>
      opt
        .setName("message_id")
        .setDescription("Message ID to debug")
        .setRequired(false)
    ),

  async execute(interaction) {
    const messageId = interaction.options.getString("message_id");
    const channel = interaction.channel;

    try {
      let message;
      if (messageId) {
        message = await channel.messages.fetch(messageId);
      } else {
        const msgs = await channel.messages.fetch({ limit: 10 });
        message = msgs.filter((m) => !m.author.bot).first();
      }

      if (!message) {
        return interaction.reply({
          content: "❌ Message not found.",
          flags: 64,
        });
      }

      const { sanitized, placeholders } = sanitizeMessage(message.content);
      const langs = cache.getTranslatedLanguages(message.id);

      await interaction.reply({
        flags: 64,
        content:
          `🛠 Debug for Message ${message.id}\n` +
          `Original: ${message.content}\n` +
          `Sanitized: ${sanitized}\n` +
          `Placeholders:\n` +
          `${
            Object.entries(placeholders)
              .map(([k, v]) => `→ ${k}: ${v}`)
              .join("\n") || "None"
          }\n` +
          `Already Translated: ${langs.join(", ") || "None"}`,
      });
    } catch (err) {
      console.error("❌ Debug failed:", err);
      await interaction.reply({
        content: "Failed to debug message.",
        flags: 64,
      });
    }
  },
};
