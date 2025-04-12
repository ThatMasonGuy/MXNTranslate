const { SlashCommandSubcommandBuilder } = require("discord.js");
const { getLogs } = require("../../cache/translateLogs");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("debugall")
    .setDescription("List the last 10 translation attempts"),

  async execute(interaction) {
    const logs = getLogs();

    if (logs.length === 0) {
      return interaction.reply({ content: "No logs yet!", flags: 64 });
    }

    const logText = logs
      .map(
        (log) =>
          `🔹 [${log.status.toUpperCase()}] ${log.lang} → msg ${
            log.messageId
          } at ${log.time} ${log.reason ? `(${log.reason})` : ""}`
      )
      .join("\n");

    await interaction.reply({
      flags: 64,
      content: `🧾 **Last ${logs.length} Translation Attempts**\n\n${logText}`,
    });
  },
};
