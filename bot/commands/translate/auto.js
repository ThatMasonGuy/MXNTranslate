// commands/translate/auto.js
const { SlashCommandSubcommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('auto')
    .setDescription('Manage auto-translate channels')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create an auto-translate channel that mirrors a source channel')
        .addChannelOption(option =>
          option
            .setName('source')
            .setDescription('Channel to watch and translate from')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('language')
            .setDescription('Target language for translations')
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
            .setName('name')
            .setDescription('Name for the auto-translate channel (optional)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Remove auto-translate setup from a channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Auto-translate channel to remove')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all auto-translate channels in this server')
    ),

  async execute(interaction) {
    // Check permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: '❌ You need the "Manage Channels" permission to manage auto-translate channels.',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const { storageService } = require('../../index');

    switch (subcommand) {
      case 'create': {
        await interaction.deferReply({ ephemeral: true });

        const sourceChannel = interaction.options.getChannel('source');
        const language = interaction.options.getString('language');
        const channelName = interaction.options.getString('name') || `${sourceChannel.name}-${language}`;

        try {
          // Create the new auto-translate channel
          const newChannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: sourceChannel.parent,
            topic: `🌐 Auto-translates messages from ${sourceChannel.name} to ${language.toUpperCase()}`,
            reason: `Auto-translate channel for ${language.toUpperCase()}`
          });

          // Create webhook for the channel
          const webhook = await newChannel.createWebhook({
            name: `Auto-Translate (${language.toUpperCase()})`,
            reason: 'Auto-translate channel webhook'
          });

          // Store configuration in database
          const result = storageService.autoTranslate.createAutoTranslate(
            interaction.guild.id,
            newChannel.id,
            sourceChannel.id,
            language,
            webhook.id,
            webhook.token
          );

          if (result.success) {
            await interaction.editReply({
              content: `✅ Created auto-translate channel ${newChannel}!\n\n` +
                       `**Source:** ${sourceChannel}\n` +
                       `**Language:** ${language.toUpperCase()}\n\n` +
                       `📝 **How it works:**\n` +
                       `• Messages in ${sourceChannel} will be auto-translated to ${language.toUpperCase()} and posted here\n` +
                       `• Messages sent here will be translated back to English and posted in ${sourceChannel}\n` +
                       `• All auto-translate channels watching ${sourceChannel} will see each other's messages`
            });
          } else {
            // Cleanup channel if database save failed
            await newChannel.delete();
            await interaction.editReply({
              content: `❌ Failed to save auto-translate configuration: ${result.error?.message}`
            });
          }

        } catch (error) {
          console.error('Error creating auto-translate channel:', error);
          await interaction.editReply({
            content: `❌ Failed to create auto-translate channel: ${error.message}`
          });
        }
        break;
      }

      case 'delete': {
        const channel = interaction.options.getChannel('channel');

        // Check if this is an auto-translate channel
        const config = storageService.autoTranslate.getByChannelId(channel.id);
        if (!config) {
          return interaction.reply({
            content: `❌ ${channel} is not an auto-translate channel.`,
            ephemeral: true
          });
        }

        try {
          // Delete the configuration
          const result = storageService.autoTranslate.delete(channel.id);
          
          if (result.success) {
            // Clean up webhook
            const { autoTranslateHandler } = require('../../index');
            await autoTranslateHandler.cleanupWebhook(channel.id);

            await interaction.reply({
              content: `✅ Removed auto-translate configuration from ${channel}\n\n` +
                       `💡 The channel itself still exists. Delete it manually if you want to remove it completely.`,
              ephemeral: true
            });
          } else {
            await interaction.reply({
              content: `❌ Failed to remove auto-translate configuration: ${result.error?.message}`,
              ephemeral: true
            });
          }

        } catch (error) {
          console.error('Error deleting auto-translate channel:', error);
          await interaction.reply({
            content: `❌ Failed to remove auto-translate: ${error.message}`,
            ephemeral: true
          });
        }
        break;
      }

      case 'list': {
        const configs = storageService.autoTranslate.getByGuildId(interaction.guild.id);

        if (!configs || configs.length === 0) {
          return interaction.reply({
            content: '📝 No auto-translate channels configured in this server.',
            ephemeral: true
          });
        }

        let response = `**🌐 Auto-Translate Channels (${configs.length})**\n\n`;

        for (const config of configs) {
          response += `• <#${config.channel_id}> → <#${config.source_channel_id}> (${config.target_language.toUpperCase()})\n`;
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
