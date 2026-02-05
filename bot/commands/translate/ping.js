// ~/MXNTranslate/bot/commands/translate/ping.js
const { SlashCommandSubcommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("ping")
    .setDescription("Ping the bot"),

  async execute(interaction) {
    await interaction.reply({ content: "🏓 Pong!", flags: 64 });
  },
};
