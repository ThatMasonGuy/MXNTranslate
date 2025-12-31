// commands/translate/config.js
const { SlashCommandSubcommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('config')
    .setDescription('Configure translation settings')
    .addSubcommand(subcommand =>
      subcommand
        .setName('block-channel')
        .setDescription('Block translation in a specific channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to block')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('unblock-channel')
        .setDescription('Unblock translation in a specific channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to unblock')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set-announcement')
        .setDescription('Route translations from a source channel to an announcement channel')
        .addChannelOption(option =>
          option
            .setName('source')
            .setDescription('Source channel where reactions happen')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
        .addChannelOption(option =>
          option
            .setName('announcement')
            .setDescription('Channel where translations will be posted')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove-announcement')
        .setDescription('Remove announcement routing for a channel')
        .addChannelOption(option =>
          option
            .setName('source')
            .setDescription('Source channel')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View current translation configuration')
    ),

  async execute(interaction) {
    // Check permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: '❌ You need the "Manage Server" permission to configure translation settings.',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const { storageService } = require('../../index');

    switch (subcommand) {
      case 'block-channel': {
        const channel = interaction.options.getChannel('channel');
        
        const result = storageService.translationConfig.blockChannel(
          interaction.guild.id,
          channel.id
        );

        if (result.success) {
          return interaction.reply({
            content: `✅ Translation has been **blocked** in ${channel}`,
            ephemeral: true
          });
        } else {
          return interaction.reply({
            content: `❌ Failed to block channel: ${result.error?.message}`,
            ephemeral: true
          });
        }
      }

      case 'unblock-channel': {
        const channel = interaction.options.getChannel('channel');
        
        const result = storageService.translationConfig.unblockChannel(
          interaction.guild.id,
          channel.id
        );

        if (result.success) {
          return interaction.reply({
            content: `✅ Translation has been **unblocked** in ${channel}`,
            ephemeral: true
          });
        } else {
          return interaction.reply({
            content: `❌ Failed to unblock channel: ${result.error?.message}`,
            ephemeral: true
          });
        }
      }

      case 'set-announcement': {
        const sourceChannel = interaction.options.getChannel('source');
        const announcementChannel = interaction.options.getChannel('announcement');

        if (sourceChannel.id === announcementChannel.id) {
          return interaction.reply({
            content: '❌ Source and announcement channels cannot be the same!',
            ephemeral: true
          });
        }

        const result = storageService.translationConfig.setAnnouncementChannel(
          interaction.guild.id,
          sourceChannel.id,
          announcementChannel.id
        );

        if (result.success) {
          return interaction.reply({
            content: `✅ Translations from ${sourceChannel} will now be posted to ${announcementChannel}\n` +
                     `💡 The user who reacts will be mentioned in the announcement.`,
            ephemeral: true
          });
        } else {
          return interaction.reply({
            content: `❌ Failed to set announcement channel: ${result.error?.message}`,
            ephemeral: true
          });
        }
      }

      case 'remove-announcement': {
        const sourceChannel = interaction.options.getChannel('source');
        
        const result = storageService.translationConfig.removeAnnouncementChannel(
          interaction.guild.id,
          sourceChannel.id
        );

        if (result.success) {
          return interaction.reply({
            content: `✅ Announcement routing removed for ${sourceChannel}`,
            ephemeral: true
          });
        } else {
          return interaction.reply({
            content: `❌ Failed to remove announcement routing: ${result.error?.message}`,
            ephemeral: true
          });
        }
      }

      case 'view': {
        const config = storageService.translationConfig.getFullGuildConfig(interaction.guild.id);
        
        let response = '**📋 Translation Configuration**\n\n';
        
        // Blocked channels
        if (config.blockedChannels && config.blockedChannels.length > 0) {
          response += '**🚫 Blocked Channels:**\n';
          for (const channelId of config.blockedChannels) {
            response += `• <#${channelId}>\n`;
          }
        } else {
          response += '**🚫 Blocked Channels:** None\n';
        }

        response += '\n';

        // Announcement channels
        if (config.announcementChannels && config.announcementChannels.length > 0) {
          response += '**📢 Announcement Routing:**\n';
          for (const mapping of config.announcementChannels) {
            response += `• <#${mapping.source_channel_id}> → <#${mapping.announcement_channel_id}>\n`;
          }
        } else {
          response += '**📢 Announcement Routing:** None\n';
        }

        return interaction.reply({
          content: response,
          ephemeral: true
        });
      }

      default:
        return interaction.reply({
          content: '❌ Unknown subcommand',
          ephemeral: true
        });
    }
  }
};
