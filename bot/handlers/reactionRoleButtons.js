// handlers/reactionRoleButtons.js (Fixed: reaction change detection + expired token handling)
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
      case 'rr_remove_reaction':
        await this.handleRemoveReaction(interaction, config, configId);
        break;
      case 'rr_preview':
        await this.handlePreview(interaction, config);
        break;
      case 'rr_create':
        await this.handleCreate(interaction, config, configId);
        break;
      case 'rr_update':
        await this.handleUpdate(interaction, config, configId);
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

  // Load existing config for editing
  async loadEditingInterface(interaction, dbConfig) {
    try {
      if (!interaction.client.reactionRoleConfigs) {
        interaction.client.reactionRoleConfigs = new Map();
      }

      const configId = `edit_${interaction.user.id}_${Date.now()}`;

      const reactions = dbConfig.mappings.map(mapping => ({
        emoji: mapping.emoji_id ? `<:${mapping.emoji_name}:${mapping.emoji_id}>` : mapping.emoji_name,
        emojiName: mapping.emoji_name,
        emojiId: mapping.emoji_id,
        roleName: interaction.guild.roles.cache.get(mapping.role_id)?.name || 'Unknown Role',
        roleId: mapping.role_id,
        nicknamePrefix: mapping.nickname_prefix
      }));

      interaction.client.reactionRoleConfigs.set(configId, {
        guildId: dbConfig.guild_id,
        channelId: dbConfig.channel_id,
        messageContent: dbConfig.message_content,
        isSingleRole: dbConfig.is_single_role === 1,
        reactions: reactions,
        createdBy: interaction.user.id,
        embedMessageId: null,
        isEditing: true,
        originalConfigId: dbConfig.id,
        originalMessageId: dbConfig.message_id
      });

      const embed = this.createConfigEmbed(interaction.client.reactionRoleConfigs.get(configId), interaction.guild, true);

      const row1 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId("rr_set_message")
            .setLabel("Edit Message")
            .setEmoji("📝")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("rr_toggle_mode")
            .setLabel("Toggle Mode")
            .setEmoji("⚙️")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("rr_add_reaction")
            .setLabel("Add Reaction")
            .setEmoji("➕")
            .setStyle(ButtonStyle.Success)
        );

      const row2 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId("rr_remove_reaction")
            .setLabel("Remove Reaction")
            .setEmoji("➖")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("rr_preview")
            .setLabel("Preview")
            .setEmoji("👁️")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("rr_update")
            .setLabel("Save Changes")
            .setEmoji("💾")
            .setStyle(ButtonStyle.Success)
        );

      const response = await interaction.reply({
        embeds: [embed],
        components: [row1, row2],
        flags: 64
      });

      const config = interaction.client.reactionRoleConfigs.get(configId);
      config.embedMessageId = response.id;
      config.interactionToken = interaction.token;

    } catch (error) {
      console.error("Error loading editing interface:", error);
      await interaction.reply({
        content: "❌ Failed to load editing interface.",
        flags: 64
      });
    }
  }

  async handleSetChannel(interaction, config, configId) {
    if (config.isEditing) {
      await interaction.reply({
        content: "❌ You cannot change the channel when editing. The message will stay in its current location.",
        flags: 64
      });
      return;
    }

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
      .setTitle(config.isEditing ? 'Edit Message Content' : 'Set Reaction Role Message');

    const messageInput = new TextInputBuilder()
      .setCustomId('message_content')
      .setLabel('Message Content')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Enter the message that will be posted with the reactions...')
      .setRequired(true)
      .setMaxLength(2000);

    if (config.isEditing && config.messageContent) {
      messageInput.setValue(config.messageContent);
    }

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

  async handleRemoveReaction(interaction, config, configId) {
    if (config.reactions.length === 0) {
      await interaction.reply({
        content: "❌ No reactions to remove.",
        flags: 64
      });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('rr_remove_reaction_select')
      .setPlaceholder('Choose a reaction to remove')
      .addOptions(
        config.reactions.map((reaction, index) => ({
          label: `${reaction.emoji} → ${reaction.roleName}`,
          value: index.toString(),
          description: reaction.nicknamePrefix ? `Prefix: [${reaction.nicknamePrefix}]` : 'No prefix'
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: "Select the reaction to remove:",
      components: [row],
      flags: 64
    });
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
    if (!config.channelId || !config.messageContent || config.reactions.length === 0) {
      await interaction.reply({
        content: "❌ Please configure all required fields before creating.",
        flags: 64
      });
      return;
    }

    const channel = interaction.guild.channels.cache.get(config.channelId);
    const botPermissions = channel.permissionsFor(interaction.guild.members.me);

    if (!botPermissions.has(['SendMessages', 'AddReactions', 'ManageMessages'])) {
      await interaction.reply({
        content: "❌ I need 'Send Messages', 'Add Reactions', and 'Manage Messages' permissions in the target channel.",
        flags: 64
      });
      return;
    }

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

      const dbConfigId = this.storageService.reactionRoles.createConfig(
        config.guildId,
        config.channelId,
        config.messageContent,
        config.isSingleRole,
        config.createdBy
      );

      for (const reaction of config.reactions) {
        this.storageService.reactionRoles.addRoleMapping(
          dbConfigId,
          reaction.emojiName,
          reaction.emojiId,
          reaction.roleId,
          reaction.nicknamePrefix || null
        );
      }

      const message = await channel.send({ content: config.messageContent });

      this.storageService.reactionRoles.updateConfigMessageId(dbConfigId, message.id);

      for (const reaction of config.reactions) {
        try {
          await message.react(reaction.emoji);
        } catch (error) {
          console.error(`Failed to add reaction ${reaction.emoji}:`, error);
        }
      }

      this.setupReactionMonitoring(interaction.client, message.id, config.reactions);

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

  async handleUpdate(interaction, config, configId) {
    if (!config.channelId || !config.messageContent || config.reactions.length === 0) {
      await interaction.reply({
        content: "❌ Please configure all required fields before saving.",
        flags: 64
      });
      return;
    }

    try {
      await interaction.deferReply({ flags: 64 });

      // ============================================================
      // FIX: Fetch original config and compare BEFORE writing to DB
      // ============================================================
      const originalConfig = this.storageService.reactionRoles.getConfigById(config.originalConfigId);
      const originalReactions = originalConfig.mappings.map(m => ({
        emoji: m.emoji_id ? `<:${m.emoji_name}:${m.emoji_id}>` : m.emoji_name,
        emojiName: m.emoji_name,
        emojiId: m.emoji_id
      }));
      const reactionsChanged = this.hasReactionsChanged(originalReactions, config.reactions);

      // NOW update the database
      this.storageService.reactionRoles.updateConfigContent(
        config.originalConfigId,
        config.messageContent,
        config.isSingleRole
      );

      this.storageService.reactionRoles.clearRoleMappings(config.originalConfigId);

      for (const reaction of config.reactions) {
        this.storageService.reactionRoles.addRoleMapping(
          config.originalConfigId,
          reaction.emojiName,
          reaction.emojiId,
          reaction.roleId,
          reaction.nicknamePrefix || null
        );
      }

      // Update the Discord message
      const channel = interaction.guild.channels.cache.get(config.channelId);
      let message;
      try {
        message = await channel.messages.fetch(config.originalMessageId);
      } catch (fetchError) {
        await interaction.editReply({
          content: "❌ Could not find the original message to update. It may have been deleted."
        });
        return;
      }

      // Update message content
      try {
        await message.edit({ content: config.messageContent });
      } catch (editError) {
        if (editError.code === 50027 || editError.message?.includes('Expected token')) {
          console.warn('Edit session expired — message.edit failed, but this uses bot token so checking further...');
        }
        throw editError;
      }

      // Only update reactions if they actually changed
      if (reactionsChanged) {
        console.log("Reactions changed - updating Discord message reactions...");

        const currentBotReactions = message.reactions.cache.filter(reaction => reaction.me);
        const newReactionEmojis = config.reactions.map(r => r.emoji);

        // Remove bot reactions that are no longer configured
        for (const [emojiKey, reaction] of currentBotReactions) {
          const stillConfigured = newReactionEmojis.find(newEmoji => {
            if (reaction.emoji.id) {
              return newEmoji.includes(reaction.emoji.id);
            } else {
              return newEmoji === reaction.emoji.name;
            }
          });

          if (!stillConfigured) {
            try {
              await reaction.users.remove(interaction.client.user.id);
              console.log(`Removed bot reaction: ${reaction.emoji.name}`);
            } catch (error) {
              console.error(`Failed to remove bot reaction ${reaction.emoji.name}:`, error);
            }
          }
        }

        // Add new reactions that aren't already present
        for (const reaction of config.reactions) {
          const existingReaction = message.reactions.cache.find(r => {
            if (reaction.emojiId) {
              return r.emoji.id === reaction.emojiId;
            } else {
              return r.emoji.name === reaction.emojiName;
            }
          });

          if (!existingReaction || !existingReaction.me) {
            try {
              await message.react(reaction.emoji);
              console.log(`Added bot reaction: ${reaction.emoji}`);
            } catch (error) {
              console.error(`Failed to add reaction ${reaction.emoji}:`, error);
            }
          }
        }
      } else {
        console.log("Reactions unchanged - skipping Discord reaction updates");
      }

      // Update reaction protection
      this.updateReactionMonitoring(interaction.client, message.id, config.reactions);

      // Clean up temp config
      interaction.client.reactionRoleConfigs.delete(configId);

      const statusMessage = reactionsChanged ?
        "✅ Reaction role message and reactions updated successfully!" :
        "✅ Reaction role message updated successfully! (Reactions unchanged)";

      await interaction.editReply({
        content: `${statusMessage}\n🔗 [Jump to message](${message.url})\n🛡️ **Protection updated**: Unauthorized reactions will be automatically removed.\n📌 **Note**: User reactions and roles were preserved during the update.`
      });

    } catch (error) {
      // Handle expired tokens gracefully
      if (error.code === 50027 || error.message?.includes('Expected token')) {
        console.warn('Edit session or token expired during update');
        try {
          await interaction.editReply({
            content: "❌ Session expired. Please re-run `/translate edit-reaction-roles` to make changes."
          });
        } catch {
          // editReply also failed, nothing we can do
          console.warn('Could not notify user of expired session');
        }
        return;
      }
      console.error("Error updating reaction role message:", error);
      try {
        await interaction.editReply({
          content: "❌ Failed to update reaction role message."
        });
      } catch {
        // Interaction expired
      }
    }
  }

  hasReactionsChanged(oldReactions, newReactions) {
    if (oldReactions.length !== newReactions.length) {
      return true;
    }

    const oldSet = new Set(oldReactions.map(r => r.emoji));
    const newSet = new Set(newReactions.map(r => r.emoji));

    for (const oldEmoji of oldSet) {
      if (!newSet.has(oldEmoji)) {
        return true;
      }
    }

    for (const newEmoji of newSet) {
      if (!oldSet.has(newEmoji)) {
        return true;
      }
    }

    return false;
  }

  setupReactionMonitoring(client, messageId, allowedReactions) {
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

  updateReactionMonitoring(client, messageId, allowedReactions) {
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

  createConfigEmbed(config, guild, isEditing = false) {
    const channel = config.channelId ? `<#${config.channelId}>` : "*Not selected*";
    const message = config.messageContent ?
      (config.messageContent.length > 100 ? config.messageContent.substring(0, 100) + "..." : config.messageContent)
      : "*Not set*";
    const mode = config.isSingleRole ? "Single role" : "Multiple roles";
    const reactions = config.reactions.length > 0 ?
      config.reactions.map(r => `${r.emoji} → ${r.roleName}`).join('\n') :
      "*None configured*";

    return new EmbedBuilder()
      .setColor("#5865f2")
      .setTitle(isEditing ? "✏️ Edit Reaction Roles" : "🎭 Reaction Roles Setup")
      .setDescription(isEditing ? "Edit your reaction role message configuration." : "Configure a reaction role message for your server.")
      .addFields(
        { name: "📍 Channel", value: channel, inline: true },
        { name: "📝 Message", value: message, inline: true },
        { name: "⚙️ Mode", value: mode, inline: true },
        { name: "🎯 Reactions", value: reactions, inline: false }
      )
      .setFooter({ text: isEditing ? "Use the buttons below to edit your reaction roles" : "Use the buttons below to configure your reaction roles" });
  }

  async updateConfigEmbed(interaction, config) {
    const embed = this.createConfigEmbed(config, interaction.guild, config.isEditing);

    try {
      await interaction.client.rest.patch(
        `/webhooks/${interaction.client.user.id}/${config.interactionToken}/messages/@original`,
        { body: { embeds: [embed.toJSON()] } }
      );
    } catch (error) {
      if (error.code === 50027 || error.message?.includes('Expected token')) {
        console.warn("Config embed update failed — interaction token expired (this is normal after 15 minutes)");
      } else {
        console.error("Failed to update embed:", error);
      }
    }
  }

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

    if (interaction.customId === 'rr_remove_reaction_select') {
      const configId = this.findConfigByUser(interaction.client, interaction.user.id);
      if (!configId) return true;

      const config = interaction.client.reactionRoleConfigs.get(configId);
      const reactionIndex = parseInt(interaction.values[0]);

      if (reactionIndex >= 0 && reactionIndex < config.reactions.length) {
        const removedReaction = config.reactions[reactionIndex];

        if (config.isEditing && config.originalMessageId) {
          await this.cleanupRemovedReaction(interaction, config, removedReaction);
        }

        config.reactions.splice(reactionIndex, 1);
        await this.updateConfigEmbed(interaction, config);

        await interaction.reply({
          content: `✅ Removed reaction: ${removedReaction.emoji} → @${removedReaction.roleName}`,
          flags: 64
        });
      }

      return true;
    }

    return false;
  }

  async cleanupRemovedReaction(interaction, config, removedReaction) {
    try {
      const channel = interaction.guild.channels.cache.get(config.channelId);
      if (!channel) return;

      const message = await channel.messages.fetch(config.originalMessageId).catch(() => null);
      if (!message) return;

      const targetReaction = message.reactions.cache.find(reaction => {
        if (removedReaction.emojiId) {
          return reaction.emoji.id === removedReaction.emojiId;
        } else {
          return reaction.emoji.name === removedReaction.emojiName;
        }
      });

      if (!targetReaction) {
        console.log(`No reaction found on message for ${removedReaction.emoji}`);
        return;
      }

      const users = await targetReaction.users.fetch();
      const nonBotUsers = users.filter(user => !user.bot);

      console.log(`🧹 Cleaning up ${nonBotUsers.size} user reactions for removed role: ${removedReaction.roleName}`);

      const role = interaction.guild.roles.cache.get(removedReaction.roleId);

      if (role) {
        for (const [userId, user] of nonBotUsers) {
          try {
            await targetReaction.users.remove(userId);
            console.log(`🗑️ Removed reaction ${removedReaction.emoji} from ${user.username}`);

            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            if (member && member.roles.cache.has(role.id)) {
              await member.roles.remove(role);
              console.log(`🗑️ Removed role ${role.name} from ${user.username}`);

              if (removedReaction.nicknamePrefix && interaction.guild.members.me.permissions.has('ManageNicknames')) {
                try {
                  const currentNick = member.nickname || member.user.username;
                  const prefixPattern = new RegExp(`^\\[${removedReaction.nicknamePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\s*`);

                  if (prefixPattern.test(currentNick)) {
                    const newNick = currentNick.replace(prefixPattern, '');
                    await member.setNickname(newNick || null);
                    console.log(`🏷️ Removed nickname prefix [${removedReaction.nicknamePrefix}] from ${user.username}`);
                  }
                } catch (nickError) {
                  console.error('Failed to remove nickname prefix:', nickError.message);
                }
              }
            }

            if (this.storageService && config.originalConfigId) {
              this.storageService.reactionRoles.removeUserAssignment(
                config.originalConfigId,
                userId,
                removedReaction.roleId
              );
            }

          } catch (error) {
            console.error(`Failed to clean up reaction/role for ${user.username}:`, error.message);
          }
        }
      }

      if (targetReaction.me) {
        try {
          await targetReaction.users.remove(interaction.client.user.id);
          console.log(`🤖 Removed bot reaction: ${removedReaction.emoji}`);
        } catch (error) {
          console.error(`Failed to remove bot reaction ${removedReaction.emoji}:`, error.message);
        }
      }

      console.log(`✅ Cleanup complete for removed reaction: ${removedReaction.emoji} → ${removedReaction.roleName}`);

    } catch (error) {
      console.error('Error during reaction cleanup:', error);
    }
  }

  async handleModal(interaction) {
    const configId = this.findConfigByUser(interaction.client, interaction.user.id);
    if (!configId) {
      try {
        await interaction.reply({
          content: "⚠️ Configuration session expired.",
          flags: 64
        });
      } catch (replyError) {
        if (replyError.code === 10062) {
          console.warn("Modal interaction expired — user likely dismissed or bot restarted");
        } else {
          console.error("Failed to reply to expired config modal:", replyError);
        }
      }
      return true;
    }

    const config = interaction.client.reactionRoleConfigs.get(configId);

    try {
      if (interaction.customId === 'rr_message_modal') {
        config.messageContent = interaction.fields.getTextInputValue('message_content');
        await this.updateConfigEmbed(interaction, config);

        await interaction.reply({
          content: "✅ Message content updated!",
          flags: 64
        });
      } else if (interaction.customId === 'rr_add_reaction_modal') {
        const emojiInput = interaction.fields.getTextInputValue('emoji');
        const roleNameInput = interaction.fields.getTextInputValue('role_name');
        const nicknamePrefix = interaction.fields.getTextInputValue('nickname_prefix');

        const role = interaction.guild.roles.cache.find(r =>
          r.name.toLowerCase() === roleNameInput.toLowerCase()
        );

        if (!role) {
          await interaction.reply({
            content: `⚠️ Role "${roleNameInput}" not found. Please check the spelling and try again.`,
            flags: 64
          });
          return true;
        }

        const botMember = interaction.guild.members.me;
        if (role.position >= botMember.roles.highest.position) {
          await interaction.reply({
            content: `⚠️ I cannot manage the role "${role.name}" because it's above my highest role.`,
            flags: 64
          });
          return true;
        }

        let emojiName = emojiInput;
        let emojiId = null;
        let displayEmoji = emojiInput;

        const customEmojiMatch = emojiInput.match(/<a?:(\w+):(\d+)>/);
        if (customEmojiMatch) {
          emojiName = customEmojiMatch[1];
          emojiId = customEmojiMatch[2];
          displayEmoji = emojiInput;
        } else if (emojiInput.match(/^:\w+:$/)) {
          const name = emojiInput.slice(1, -1);
          const customEmoji = interaction.guild.emojis.cache.find(e => e.name === name);
          if (customEmoji) {
            emojiName = customEmoji.name;
            emojiId = customEmoji.id;
            displayEmoji = `<${customEmoji.animated ? 'a' : ''}:${customEmoji.name}:${customEmoji.id}>`;
          } else {
            await interaction.reply({
              content: `⚠️ Custom emoji "${emojiInput}" not found in this server.`,
              flags: 64
            });
            return true;
          }
        } else {
          displayEmoji = emojiInput;
          emojiName = emojiInput;
        }

        const existingReaction = config.reactions.find(r => r.emoji === displayEmoji);
        if (existingReaction) {
          await interaction.reply({
            content: `⚠️ Emoji ${displayEmoji} is already configured for role @${existingReaction.roleName}.`,
            flags: 64
          });
          return true;
        }

        const existingRoleReaction = config.reactions.find(r => r.roleId === role.id);
        if (existingRoleReaction) {
          await interaction.reply({
            content: `⚠️ Role @${role.name} is already configured with emoji ${existingRoleReaction.emoji}.`,
            flags: 64
          });
          return true;
        }

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
    } catch (error) {
      if (error.code === 10062) {
        console.warn("Modal interaction expired — user likely dismissed or bot restarted");
      } else {
        console.error("Modal handling error:", error);
        try {
          await interaction.reply({
            content: "❌ Something went wrong processing your input.",
            flags: 64
          });
        } catch {
          // Interaction already expired
        }
      }
    }

    return true;
  }
}

module.exports = ReactionRoleButtons;