// handlers/interactionHandler.js (Updated to handle editing + context menu translate)
const ReactionRoleButtons = require('./reactionRoleButtons');
const { EmbedBuilder } = require('discord.js');

class InteractionHandler {
  constructor(storageService, translationService) {
    this.storageService = storageService;
    this.translationService = translationService;
    this.reactionRoleButtons = new ReactionRoleButtons(storageService);
  }

  async handleInteraction(interaction) {
    try {
      if (interaction.isButton()) {
        return await this.reactionRoleButtons.handleButtonInteraction(interaction);
      }

      if (interaction.isStringSelectMenu()) {
        // Handle context menu translation language selection
        if (interaction.customId.startsWith('ctx_translate:')) {
          return await this.handleContextTranslate(interaction);
        }

        // Handle edit reaction role selection
        if (interaction.customId === 'edit_rr_select') {
          return await this.handleEditRRSelection(interaction);
        }

        return await this.reactionRoleButtons.handleSelectMenu(interaction);
      }

      if (interaction.isModalSubmit()) {
        return await this.reactionRoleButtons.handleModal(interaction);
      }
    } catch (error) {
      console.error('Interaction handler error:', error);

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred while processing your interaction.',
            flags: 64
          });
        }
      } catch (replyError) {
        console.error('Failed to send error response:', replyError);
      }
    }

    return false;
  }

  async handleContextTranslate(interaction) {
    const messageId = interaction.customId.split(':')[1];
    const targetLang = interaction.values[0];

    await interaction.deferUpdate();

    try {
      // In DMs/private channels, interaction.channel may not be cached
      const channel = interaction.channel ?? await interaction.client.channels.fetch(interaction.channelId);

      if (!channel) {
        await interaction.editReply({
          content: 'Could not access this channel for translation.',
          components: [],
        });
        return true;
      }

      // Fetch the original message from the channel
      const message = await channel.messages.fetch(messageId);

      if (!message || !message.content || message.content.trim().length === 0) {
        await interaction.editReply({
          content: 'Could not find that message or it has no text content.',
          components: [],
        });
        return true;
      }

      const metadata = {
        discordUserId: interaction.user.id,
        userName: interaction.user.username,
        ...(interaction.guildId && { guildId: interaction.guildId }),
        ...(interaction.channelId && { channelId: interaction.channelId }),
        ...(interaction.guild?.name && { guildName: interaction.guild.name }),
        ...(interaction.channel?.name && { channelName: interaction.channel.name }),
      };

      const translatedText = await this.translationService.translateMessage(
        message.content,
        targetLang,
        metadata
      );

      if (!translatedText) {
        await interaction.editReply({
          content: 'Translation returned no result. The message may already be in the target language.',
          components: [],
        });
        return true;
      }

      const langNames = {
        en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
        pt: 'Portuguese', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ru: 'Russian',
        ar: 'Arabic', hi: 'Hindi', tr: 'Turkish', nl: 'Dutch', sv: 'Swedish',
        no: 'Norwegian', da: 'Danish', fi: 'Finnish', pl: 'Polish', cs: 'Czech',
        hu: 'Hungarian', el: 'Greek', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian',
      };

      const embed = new EmbedBuilder()
        .setColor('#50fa7b')
        .setAuthor({ name: `Translated to ${langNames[targetLang] || targetLang.toUpperCase()}` })
        .setDescription(translatedText)
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL({ extension: 'png' }),
        });

      await interaction.editReply({
        content: null,
        embeds: [embed],
        components: [],
      });
    } catch (err) {
      console.error('Context menu translation failed:', err);
      await interaction.editReply({
        content: `Translation failed: ${err.message}`,
        components: [],
      });
    }

    return true;
  }

  async handleEditRRSelection(interaction) {
    const configId = parseInt(interaction.values[0]);

    // Verify user owns this config
    if (!this.storageService.reactionRoles.isConfigOwner(configId, interaction.user.id)) {
      await interaction.reply({
        content: "❌ You can only edit reaction role messages that you created.",
        flags: 64
      });
      return true;
    }

    // Get the full config with mappings
    const config = this.storageService.reactionRoles.getConfigById(configId);
    if (!config) {
      await interaction.reply({
        content: "❌ Reaction role configuration not found.",
        flags: 64
      });
      return true;
    }

    // Load config into editing interface
    await this.reactionRoleButtons.loadEditingInterface(interaction, config);
    return true;
  }
}

module.exports = InteractionHandler;