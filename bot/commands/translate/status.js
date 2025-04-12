const { SlashCommandSubcommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("status")
    .setDescription("Check if systems are healthy"),

  async execute(interaction) {
    // Mock responses for now
    const redisStatus = "✅ Redis: Connected (mock)";
    const sqlStatus = "✅ SQL: Online (mock)";
    const translatorStatus = "✅ Translator API: Responding (mock)";

    await interaction.reply({
      flags: 64,
      content:
        `🧪 **Status Check**\n\n` +
        `${redisStatus}\n${sqlStatus}\n${translatorStatus}`,
    });
  },
};
