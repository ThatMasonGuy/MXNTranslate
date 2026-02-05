// ~/MXNTranslate/bot/commands/translate/auto.js
const { PermissionFlagsBits, ChannelType, PermissionsBitField } = require('discord.js');

module.exports = {
  async execute(interaction, subcommand) {
    // Check permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: '❌ You need the "Manage Channels" permission to manage auto-translate channels.',
        ephemeral: true
      });
    }

    const { storageService } = require('../../index');

    switch (subcommand) {
      case 'create': {
        await interaction.deferReply({ ephemeral: true });

        const sourceChannel = interaction.options.getChannel('source');
        const language = interaction.options.getString('language');
        const channelName = interaction.options.getString('name') || `${sourceChannel.name}-${language}`;
        const createRole = interaction.options.getBoolean('create-role') || false;
        const roleName = interaction.options.getString('role-name');
        const existingRole = interaction.options.getRole('existing-role');

        try {
          let roleToUse = null;

          // Step 1: Handle role creation/selection
          if (existingRole) {
            roleToUse = existingRole;
          } else if (createRole) {
            const roleNameFinal = roleName || `${language.toUpperCase()} Speaker`;
            
            // Create the role
            roleToUse = await interaction.guild.roles.create({
              name: roleNameFinal,
              reason: `Auto-translate channel role for ${language.toUpperCase()}`
            });
          }

          // Step 2: Set up permission overwrites for the channel
          const permissionOverwrites = [
            {
              id: interaction.guild.id, // @everyone
              deny: [PermissionsBitField.Flags.ViewChannel] // Hide from everyone by default
            },
            {
              id: interaction.client.user.id, // Bot
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ManageWebhooks
              ]
            }
          ];

          // If we have a role, allow it to view the channel
          if (roleToUse) {
            permissionOverwrites.push({
              id: roleToUse.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory
              ]
            });
          }

          // Step 3: Create the auto-translate channel
          const newChannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: sourceChannel.parent,
            topic: `🌐 Auto-translates messages from ${sourceChannel.name} to ${language.toUpperCase()}`,
            permissionOverwrites: permissionOverwrites,
            reason: `Auto-translate channel for ${language.toUpperCase()}`
          });

          // Step 4: Create webhook for the channel
          const webhook = await newChannel.createWebhook({
            name: `Auto-Translate (${language.toUpperCase()})`,
            reason: 'Auto-translate channel webhook'
          });

          // Step 5: Store configuration in database
          const result = storageService.autoTranslate.createAutoTranslate(
            interaction.guild.id,
            newChannel.id,
            sourceChannel.id,
            language,
            webhook.id,
            webhook.token
          );

          if (result.success) {
            let response = `✅ Created auto-translate channel ${newChannel}!\n\n` +
                         `**Source:** ${sourceChannel}\n` +
                         `**Language:** ${language.toUpperCase()}\n`;

            if (roleToUse) {
              response += `**Role:** ${roleToUse} (only users with this role can see the channel)\n`;
              if (createRole) {
                response += `\n💡 **Tip:** Use \`/translate reaction-roles\` to set up a reaction role message where users can get the ${roleToUse} role!`;
              }
            }

            response += `\n\n📝 **How it works:**\n` +
                       `• Messages in ${sourceChannel} will be auto-translated to ${language.toUpperCase()} and posted in ${newChannel}\n` +
                       `• Messages sent in ${newChannel} will be translated back to English and posted in ${sourceChannel}\n` +
                       `• All auto-translate channels watching ${sourceChannel} will see each other's messages`;

            await interaction.editReply({ content: response });
          } else {
            // Cleanup on failure
            await newChannel.delete();
            if (createRole && roleToUse) {
              await roleToUse.delete();
            }
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

      case 'cleanup': {
        await interaction.deferReply({ ephemeral: true });

        try {
          const { autoTranslateHandler } = require('../../index');
          const removedCount = await autoTranslateHandler.cleanupDeadChannels(interaction.guild.id);

          if (removedCount === 0) {
            await interaction.editReply({
              content: '✅ All auto-translate channels are valid! No cleanup needed.'
            });
          } else {
            await interaction.editReply({
              content: `🧹 Cleaned up ${removedCount} dead auto-translate channel config(s)!`
            });
          }
        } catch (error) {
          console.error('Error during cleanup:', error);
          await interaction.editReply({
            content: `❌ Error during cleanup: ${error.message}`
          });
        }
        break;
      }

      default:
        return interaction.reply({
          content: '❌ Unknown subcommand',
          ephemeral: true
        });
    }
  }
};