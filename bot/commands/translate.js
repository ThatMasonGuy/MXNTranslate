// commands/translate.js (Updated with role-locking for auto-translate)
const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("translate")
    .setDescription("Translation and reaction role management commands")
    // Original subcommands
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
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("set-language")
        .setDescription("Set your preferred translation language")
        .addStringOption(option =>
          option
            .setName("language")
            .setDescription("Your preferred language (leave empty to clear)")
            .setRequired(false)
            .addChoices(
              { name: '🇺🇸 English', value: 'en' },
              { name: '🇪🇸 Spanish', value: 'es' },
              { name: '🇫🇷 French', value: 'fr' },
              { name: '🇩🇪 German', value: 'de' },
              { name: '🇮🇹 Italian', value: 'it' },
              { name: '🇵🇹 Portuguese', value: 'pt' },
              { name: '🇯🇵 Japanese', value: 'ja' },
              { name: '🇰🇷 Korean', value: 'ko' },
              { name: '🇨🇳 Chinese', value: 'zh' },
              { name: '🇷🇺 Russian', value: 'ru' },
              { name: '🇸🇦 Arabic', value: 'ar' },
              { name: '🇮🇳 Hindi', value: 'hi' },
              { name: '🇹🇷 Turkish', value: 'tr' },
              { name: '🇳🇱 Dutch', value: 'nl' },
              { name: '🇸🇪 Swedish', value: 'sv' },
              { name: '🇳🇴 Norwegian', value: 'no' },
              { name: '🇩🇰 Danish', value: 'da' },
              { name: '🇫🇮 Finnish', value: 'fi' },
              { name: '🇵🇱 Polish', value: 'pl' },
              { name: '🇨🇿 Czech', value: 'cs' },
              { name: '🇭🇺 Hungarian', value: 'hu' },
              { name: '🇬🇷 Greek', value: 'el' },
              { name: '🇹🇭 Thai', value: 'th' },
              { name: '🇻🇳 Vietnamese', value: 'vi' },
              { name: '🇮🇩 Indonesian', value: 'id' }
            )
        )
    )
    // Config subcommand group
    .addSubcommandGroup(group =>
      group
        .setName("config")
        .setDescription("Configure translation settings")
        .addSubcommand(subcommand =>
          subcommand
            .setName("block-channel")
            .setDescription("Block translation in a specific channel")
            .addChannelOption(option =>
              option
                .setName("channel")
                .setDescription("Channel to block")
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName("unblock-channel")
            .setDescription("Unblock translation in a specific channel")
            .addChannelOption(option =>
              option
                .setName("channel")
                .setDescription("Channel to unblock")
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName("set-announcement")
            .setDescription("Route translations from a source channel to an announcement channel")
            .addChannelOption(option =>
              option
                .setName("source")
                .setDescription("Source channel where reactions happen")
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(true)
            )
            .addChannelOption(option =>
              option
                .setName("announcement")
                .setDescription("Channel where translations will be posted")
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName("remove-announcement")
            .setDescription("Remove announcement routing for a channel")
            .addChannelOption(option =>
              option
                .setName("source")
                .setDescription("Source channel")
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName("view")
            .setDescription("View current translation configuration")
        )
    )
    // Auto subcommand group
    .addSubcommandGroup(group =>
      group
        .setName("auto")
        .setDescription("Manage auto-translate channels")
        .addSubcommand(subcommand =>
          subcommand
            .setName("create")
            .setDescription("Create an auto-translate channel that mirrors a source channel")
            .addChannelOption(option =>
              option
                .setName("source")
                .setDescription("Channel to watch and translate from")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
            .addStringOption(option =>
              option
                .setName("language")
                .setDescription("Target language for translations")
                .setRequired(true)
                .addChoices(
                  { name: '🇪🇸 Spanish (es)', value: 'es' },
                  { name: '🇫🇷 French (fr)', value: 'fr' },
                  { name: '🇩🇪 German (de)', value: 'de' },
                  { name: '🇮🇹 Italian (it)', value: 'it' },
                  { name: '🇵🇹 Portuguese (pt)', value: 'pt' },
                  { name: '🇯🇵 Japanese (ja)', value: 'ja' },
                  { name: '🇰🇷 Korean (ko)', value: 'ko' },
                  { name: '🇨🇳 Chinese (zh)', value: 'zh' },
                  { name: '🇷🇺 Russian (ru)', value: 'ru' },
                  { name: '🇸🇦 Arabic (ar)', value: 'ar' },
                  { name: '🇮🇳 Hindi (hi)', value: 'hi' },
                  { name: '🇹🇷 Turkish (tr)', value: 'tr' },
                  { name: '🇳🇱 Dutch (nl)', value: 'nl' },
                  { name: '🇸🇪 Swedish (sv)', value: 'sv' },
                  { name: '🇳🇴 Norwegian (no)', value: 'no' },
                  { name: '🇩🇰 Danish (da)', value: 'da' },
                  { name: '🇫🇮 Finnish (fi)', value: 'fi' },
                  { name: '🇵🇱 Polish (pl)', value: 'pl' },
                  { name: '🇨🇿 Czech (cs)', value: 'cs' },
                  { name: '🇭🇺 Hungarian (hu)', value: 'hu' },
                  { name: '🇬🇷 Greek (el)', value: 'el' },
                  { name: '🇮🇱 Hebrew (he)', value: 'he' },
                  { name: '🇹🇭 Thai (th)', value: 'th' },
                  { name: '🇻🇳 Vietnamese (vi)', value: 'vi' },
                  { name: '🇮🇩 Indonesian (id)', value: 'id' }
                )
            )
            .addStringOption(option =>
              option
                .setName("name")
                .setDescription("Name for the auto-translate channel (optional)")
                .setRequired(false)
            )
            .addBooleanOption(option =>
              option
                .setName("create-role")
                .setDescription("Create a new role to lock this channel (default: false)")
                .setRequired(false)
            )
            .addStringOption(option =>
              option
                .setName("role-name")
                .setDescription("Name for the new role (only if create-role is true)")
                .setRequired(false)
            )
            .addRoleOption(option =>
              option
                .setName("existing-role")
                .setDescription("Use an existing role to lock this channel")
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName("delete")
            .setDescription("Remove auto-translate setup from a channel")
            .addChannelOption(option =>
              option
                .setName("channel")
                .setDescription("Auto-translate channel to remove")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName("list")
            .setDescription("List all auto-translate channels in this server")
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName("cleanup")
            .setDescription("Remove configs for deleted auto-translate channels")
        )
    ),

  async execute(interaction) {
    const subcommandGroup = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    try {
      // Handle subcommand groups
      if (subcommandGroup === 'config') {
        const configHandler = require('./translate/config');
        await configHandler.execute(interaction, subcommand);
      } else if (subcommandGroup === 'auto') {
        const autoHandler = require('./translate/auto');
        await autoHandler.execute(interaction, subcommand);
      } else {
        // Handle regular subcommands
        const subcommandFile = require(`./translate/${subcommand}`);
        await subcommandFile.execute(interaction);
      }
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