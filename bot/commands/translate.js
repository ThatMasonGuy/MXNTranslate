// commands/translate.js (Updated to include all subcommands)
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("translate")
    .setDescription("Translation and reaction role management commands")
    .addSubcommand(subcommand =>
      subcommand
        .setName("ping")
        .setDescription("Check if the bot is responsive")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("status")
        .setDescription("Check bot status and features")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("reaction-roles")
        .setDescription("Create and manage reaction role messages")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("edit-reaction-roles")
        .setDescription("Edit existing reaction role messages")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      // Load the appropriate subcommand handler
      const subcommandFile = require(`./translate/${subcommand}`);
      await subcommandFile.execute(interaction);
    } catch (error) {
      console.error(`Error executing subcommand ${subcommand}:`, error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ An error occurred while executing this command.",
          flags: 64
        });
      }
    }
  },
};