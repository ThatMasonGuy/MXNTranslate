// handlers/reactionRoleButtons.js (Enhanced modal version)
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, ChannelType, ButtonBuilder, ButtonStyle } = require("discord.js");

class ReactionRoleButtons {
  constructor(storageService) {
    this.storageService = storageService;
  }

  async handleButtonInteraction(interaction) {
    if (!interaction.customId.startsWith('rr_')) return false;

    const configId = this.findConfigByUser(interaction.client, interaction.user.id);
    if (!configId) {
      await interaction.reply({
        content: "❌ Configuration session expired. Please run the command again.",
        flags: 64
      });
      return true;
    }

    const config = interaction.client.reactionRoleConfigs.get(configId);

    switch (interaction.customId) {
      case 'rr_set_channel':
        await this.handleSetChannel(interaction, config, configId);
        break;
      case 'rr_set_message':
        await this.handleSetMessage(interaction, config, configId);
        break;
      case 'rr_toggle_mode':
        await this.handleToggleMode(interaction, config, configId);
        break;
      case 'rr_add_reaction':
        await this.handleAddReaction(interaction, config, configId);
        break;
      case 'rr_preview':
        await this.handlePreview(interaction, config);
        break;
      case 'rr_create':
        await this.handleCreate(interaction, config, configId);
        break;
    }

    return true;
  }

  findConfigByUser(client, userId) {
    for (const [configId, config] of client.reactionRoleConfigs.entries()) {
      if (config.createdBy === userId) {
        return configId;
      }
    }
    return null;
  }

  async handleSetChannel(interaction, config, configId) {
    const channels = interaction.guild.channels.cache
      .filter(c => c.type === ChannelType.GuildText && c.permissionsFor(interaction.guild.members.me).has('SendMessages'))
      .first(25);

    if (channels.length === 0) {
      await interaction.reply({
        content: "❌ No accessible text channels found.",
        flags: 64
      });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('rr_channel_select')
      .setPlaceholder('Choose a channel')
      .addOptions(
        channels.map(channel => ({
          label: `#${channel.name}`,
          value: channel.id,
          description: channel.topic ? channel.topic.substring(0, 100) : 'No description'
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: "Select the channel where the reaction role message will be posted:",
      components: [row],
      flags: 64
    });
  }

  async handleSetMessage(interaction, config, configId) {
    const modal = new ModalBuilder()
      .setCustomId('rr_message_modal')
      .setTitle('Set Reaction Role Message');

    const messageInput = new TextInputBuilder()
      .setCustomId('message_content')
      .setLabel('Message Content')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Enter the message that will be posted with the reactions...')
      .setRequired(true)
      .setMaxLength(2000);

    const firstActionRow = new ActionRowBuilder().addComponents(messageInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
  }

  async handleToggleMode(interaction, config, configId) {
    config.isSingleRole = !config.isSingleRole;
    await this.updateConfigEmbed(interaction, config);
    
    await interaction.reply({
      content: `✅ Mode changed to: **${config.isSingleRole ? 'Single role' : 'Multiple roles'}**`,
      flags: 64
    });
  }

  async handleAddReaction(interaction, config, configId) {
    const modal = new ModalBuilder()
      .setCustomId('rr_add_reaction_modal')
      .setTitle('Add Reaction Role');

    const emojiInput = new TextInputBuilder()
      .setCustomId('emoji')
      .setLabel('Emoji')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('🟣 or :custom_emoji: or <:name:123456789>')
      .setRequired(true)
      .setMaxLength(100);

    const roleInput = new TextInputBuilder()
      .setCustomId('role_name')
      .setLabel('Role Name')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Type the exact role name (e.g., "VLR")')
      .setRequired(true)
      .setMaxLength(100);

    const prefixInput = new TextInputBuilder()
      .setCustomId('nickname_prefix')
      .setLabel('Nickname Prefix (Optional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VLR (becomes [VLR] Username)')
      .setRequired(false)
      .setMaxLength(10);

    modal.addComponents(
      new ActionRowBuilder().addComponents(emojiInput),
      new ActionRowBuilder().addComponents(roleInput),
      new ActionRowBuilder().addComponents(prefixInput)
    );

    await interaction.showModal(modal);
  }

  async handlePreview(interaction, config) {
    if (!config.channelId || !config.messageContent || config.reactions.length === 0) {
      await interaction.reply({
        content: "❌ Please configure channel, message, and at least one reaction before previewing.",
        flags: 64
      });
      return;
    }

    const channel = interaction.guild.channels.cache.get(config.channelId);
    const reactionsText = config.reactions.map(r => 
      `${r.emoji} → @${r.roleName}${r.nicknamePrefix ? ` (prefix: [${r.nicknamePrefix}])` : ''}`
    ).join('\n');

    const embed = new EmbedBuilder()
      .setColor("#5865f2")
      .setTitle("📋 Reaction Role Preview")
      .addFields(
        { name: "Channel", value: `${channel}`, inline: true },
        { name: "Mode", value: config.isSingleRole ? "Single role" : "Multiple roles", inline: true },
        { name: "Message", value: config.messageContent.substring(0, 1024), inline: false },
        { name: "Reactions", value: reactionsText, inline: false }
      );

    await interaction.reply({
      embeds: [embed],
      flags: 64
    });
  }

  async handleCreate(interaction, config, configId) {
    // Validation
    if (!config.channelId || !config.messageContent || config.reactions.length === 0) {
      await interaction.reply({
        content: "❌ Please configure all required fields before creating.",
        flags: 64
      });
      return;
    }

    // Check bot permissions
    const channel = interaction.guild.channels.cache.get(config.channelId);
    const botPermissions = channel.permissionsFor(interaction.guild.members.me);
    
    if (!botPermissions.has(['SendMessages', 'AddReactions', 'ManageMessages'])) {
      await interaction.reply({
        content: "❌ I need 'Send Messages', 'Add Reactions', and 'Manage Messages' permissions in the target channel.",
        flags: 64
      });
      return;
    }

    // Check if bot can manage roles
    const highestBotRole = interaction.guild.members.me.roles.highest;
    const unmanageableRoles = config.reactions.filter(r => {
      const role = interaction.guild.roles.cache.get(r.roleId);
      return role && role.position >= highestBotRole.position;
    });

    if (unmanageableRoles.length > 0) {
      await interaction.reply({
        content: `❌ I cannot manage these roles (they're above my highest role):\n${unmanageableRoles.map(r => `@${r.roleName}`).join(', ')}`,
        flags: 64
      });
      return;
    }

    try {
      await interaction.deferReply({ flags: 64 });

      // Create database config
      const dbConfigId = this.storageService.reactionRoles.createConfig(
        config.guildId,
        config.channelId,
        config.messageContent,
        config.isSingleRole,
        config.createdBy
      );

      // Add role mappings
      for (const reaction of config.reactions) {
        this.storageService.reactionRoles.addRoleMapping(
          dbConfigId,
          reaction.emojiName,
          reaction.emojiId,
          reaction.roleId,
          reaction.nicknamePrefix || null
        );
      }

      // Post the message
      const message = await channel.send({ content: config.messageContent });

      // Update config with message ID
      this.storageService.reactionRoles.updateConfigMessageId(dbConfigId, message.id);

      // Add reactions to the message
      for (const reaction of config.reactions) {
        try {
          await message.react(reaction.emoji);
        } catch (error) {
          console.error(`Failed to add reaction ${reaction.emoji}:`, error);
        }
      }

      // Set up reaction monitoring
      this.setupReactionMonitoring(interaction.client, message.id, config.reactions);

      // Clean up temp config
      interaction.client.reactionRoleConfigs.delete(configId);

      const permissionWarning = interaction.guild.members.me.permissions.has('ManageNicknames') ? 
        '' : '\n⚠️ **Note**: I don\'t have "Manage Nicknames" permission, so nickname prefixes won\'t work.';

      await interaction.editReply({
        content: `✅ Reaction role message created successfully in ${channel}!\n🔗 [Jump to message](${message.url})${permissionWarning}\n🛡️ **Protection enabled**: Unauthorized reactions will be automatically removed.`
      });

    } catch (error) {
      console.error("Error creating reaction role message:", error);
      await interaction.editReply({
        content: "❌ Failed to create reaction role message."
      });
    }
  }

  setupReactionMonitoring(client, messageId, allowedReactions) {
    // Store allowed reactions for this message
    if (!client.reactionRoleProtection) {
      client.reactionRoleProtection = new Map();
    }
    
    const allowedEmojis = allowedReactions.map(r => ({
      name: r.emojiName,
      id: r.emojiId,
      full: r.emoji
    }));
    
    client.reactionRoleProtection.set(messageId, allowedEmojis);
  }

  async updateConfigEmbed(interaction, config) {
    const channel = config.channelId ? `<#${config.channelId}>` : "*Not selected*";
    const message = config.messageContent ? 
      (config.messageContent.length > 100 ? config.messageContent.substring(0, 100) + "..." : config.messageContent) 
      : "*Not set*";
    const mode = config.isSingleRole ? "Single role" : "Multiple roles";
    const reactions = config.reactions.length > 0 ? 
      config.reactions.map(r => `${r.emoji} → ${r.roleName}`).join('\n') : 
      "*None configured*";

    const embed = new EmbedBuilder()
      .setColor("#5865f2")
      .setTitle("🎭 Reaction Roles Setup")
      .setDescription("Configure a reaction role message for your server.")
      .addFields(
        { name: "📍 Channel", value: channel, inline: true },
        { name: "📝 Message", value: message, inline: true },
        { name: "⚙️ Mode", value: mode, inline: true },
        { name: "🎯 Reactions", value: reactions, inline: false }
      )
      .setFooter({ text: "Use the buttons below to configure your reaction roles" });

    try {
      const originalResponse = await interaction.client.rest.get(
        `/webhooks/${interaction.client.user.id}/${config.interactionToken}/messages/@original`
      );
      
      await interaction.client.rest.patch(
        `/webhooks/${interaction.client.user.id}/${config.interactionToken}/messages/@original`,
        { body: { embeds: [embed.toJSON()] } }
      );
    } catch (error) {
      console.error("Failed to update embed:", error);
    }
  }

  // Handle select menu and modal submissions
  async handleSelectMenu(interaction) {
    if (interaction.customId === 'rr_channel_select') {
      const configId = this.findConfigByUser(interaction.client, interaction.user.id);
      if (!configId) return true;

      const config = interaction.client.reactionRoleConfigs.get(configId);
      config.channelId = interaction.values[0];

      await this.updateConfigEmbed(interaction, config);
      
      const channel = interaction.guild.channels.cache.get(config.channelId);
      await interaction.reply({
        content: `✅ Channel set to ${channel}`,
        flags: 64
      });

      return true;
    }

    return false;
  }

  async handleModal(interaction) {
    const configId = this.findConfigByUser(interaction.client, interaction.user.id);
    if (!configId) {
      await interaction.reply({
        content: "❌ Configuration session expired.",
        flags: 64
      });
      return true;
    }

    const config = interaction.client.reactionRoleConfigs.get(configId);

    if (interaction.customId === 'rr_message_modal') {
      config.messageContent = interaction.fields.getTextInputValue('message_content');
      await this.updateConfigEmbed(interaction, config);
      
      await interaction.reply({
        content: "✅ Message content updated!",
        flags: 64
      });
    } else if (interaction.customId === 'rr_add_reaction_modal') {
      const emojiInput = interaction.fields.getTextInputValue('emoji');
      const roleName = interaction.fields.getTextInputValue('role_name');
      const nicknamePrefix = interaction.fields.getTextInputValue('nickname_prefix');

      // Find role by name (case insensitive, partial matching)
      const roles = interaction.guild.roles.cache;
      let role = roles.find(r => r.name.toLowerCase() === roleName.toLowerCase());
      
      if (!role) {
        // Try partial matching
        const partialMatches = roles.filter(r => 
          r.name.toLowerCase().includes(roleName.toLowerCase()) &&
          !r.managed && 
          r.id !== interaction.guild.id
        );
        
        if (partialMatches.size === 1) {
          role = partialMatches.first();
        } else if (partialMatches.size > 1) {
          const matches = partialMatches.map(r => r.name).join(', ');
          await interaction.reply({
            content: `❌ Multiple roles found matching "${roleName}": ${matches}\nPlease be more specific.`,
            flags: 64
          });
          return true;
        }
      }

      if (!role) {
        await interaction.reply({
          content: `❌ Role "${roleName}" not found. Please check the role name and try again.`,
          flags: 64
        });
        return true;
      }

      // Check if bot can manage this role
      const botHighestRole = interaction.guild.members.me.roles.highest;
      if (role.position >= botHighestRole.position && !interaction.guild.members.me.permissions.has('Administrator')) {
        await interaction.reply({
          content: `❌ I cannot manage the role "${role.name}" because it's above my highest role.`,
          flags: 64
        });
        return true;
      }

      // Parse emoji (handle unicode, custom emojis, and emoji IDs)
      let emojiName = emojiInput;
      let emojiId = null;
      let displayEmoji = emojiInput;

      // Check if it's a custom emoji <:name:id> or <a:name:id>
      const customEmojiMatch = emojiInput.match(/<a?:(\w+):(\d+)>/);
      if (customEmojiMatch) {
        emojiName = customEmojiMatch[1];
        emojiId = customEmojiMatch[2];
        displayEmoji = emojiInput;
      }
      // Check if it's just :name: format
      else if (emojiInput.match(/^:\w+:$/)) {
        const name = emojiInput.slice(1, -1);
        const customEmoji = interaction.guild.emojis.cache.find(e => e.name === name);
        if (customEmoji) {
          emojiName = customEmoji.name;
          emojiId = customEmoji.id;
          displayEmoji = `<${customEmoji.animated ? 'a' : ''}:${customEmoji.name}:${customEmoji.id}>`;
        } else {
          await interaction.reply({
            content: `❌ Custom emoji "${emojiInput}" not found in this server.`,
            flags: 64
          });
          return true;
        }
      }
      // Unicode emoji - use as is
      else {
        displayEmoji = emojiInput;
        emojiName = emojiInput;
      }

      // Check for duplicate emojis
      const existingReaction = config.reactions.find(r => r.emoji === displayEmoji);
      if (existingReaction) {
        await interaction.reply({
          content: `❌ Emoji ${displayEmoji} is already configured for role @${existingReaction.roleName}.`,
          flags: 64
        });
        return true;
      }

      // Add to config
      config.reactions.push({
        emoji: displayEmoji,
        emojiName: emojiName,
        emojiId: emojiId,
        roleName: role.name,
        roleId: role.id,
        nicknamePrefix: nicknamePrefix || null
      });

      await this.updateConfigEmbed(interaction, config);
      
      await interaction.reply({
        content: `✅ Added reaction: ${displayEmoji} → @${role.name}${nicknamePrefix ? ` (prefix: [${nicknamePrefix}])` : ''}`,
        flags: 64
      });
    }

    return true;
  }
}

module.exports = ReactionRoleButtons;
