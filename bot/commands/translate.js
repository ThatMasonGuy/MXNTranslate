// commands/translate.js (Main command file - this defines the /translate command)
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Translation and language tools')
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check if systems are healthy')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reaction-roles')
        .setDescription('Create and manage reaction role messages')
    ),
  
  async execute(interaction) {
    // This shouldn't be called directly since we have subcommands
    // The subcommand handlers will be called instead
    await interaction.reply({
      content: 'Please use a subcommand!',
      flags: 64
    });
  },
};
