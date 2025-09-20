// commands/translate/reaction-roles.js
const { SlashCommandSubcommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, StringSelectMenuBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("reaction-roles")
    .setDescription("Create and manage reaction role messages"),

  async execute(interaction) {
    try {
      // Check permissions
      if (!interaction.member.permissions.has('ManageRoles')) {
        return await interaction.reply({
          content: "❌ You need the 'Manage Roles' permission to use this command.",
          flags: 64
        });
      }

      const embed = new EmbedBuilder()
        .setColor("#5865f2")
        .setTitle("🎭 Reaction Roles Setup")
        .setDescription("Configure a reaction role message for your server.")
        .addFields(
          { name: "📍 Channel", value: "*Not selected*", inline: true },
          { name: "📝 Message", value: "*Not set*", inline: true },
          { name: "⚙️ Mode", value: "Multiple roles", inline: true },
          { name: "🎯 Reactions", value: "*None configured*", inline: false }
        )
        .setFooter({ text: "Use the buttons below to configure your reaction roles" });

      const row1 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId("rr_set_channel")
            .setLabel("Set Channel")
            .setEmoji("📍")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("rr_set_message")
            .setLabel("Set Message")
            .setEmoji("📝")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("rr_toggle_mode")
            .setLabel("Toggle Mode")
            .setEmoji("⚙️")
            .setStyle(ButtonStyle.Secondary)
        );

      const row2 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId("rr_add_reaction")
            .setLabel("Add Reaction")
            .setEmoji("➕")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("rr_preview")
            .setLabel("Preview")
            .setEmoji("👁️")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("rr_create")
            .setLabel("Create")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success)
        );

      // Store initial config data
      if (!interaction.client.reactionRoleConfigs) {
        interaction.client.reactionRoleConfigs = new Map();
      }

      const configId = `${interaction.user.id}_${Date.now()}`;
      interaction.client.reactionRoleConfigs.set(configId, {
        guildId: interaction.guild.id,
        channelId: null,
        messageContent: null,
        isSingleRole: false,
        reactions: [],
        createdBy: interaction.user.id,
        embedMessageId: null
      });

      const response = await interaction.reply({
        embeds: [embed],
        components: [row1, row2],
        flags: 64
      });

      // Store the embed message ID for updates
      const config = interaction.client.reactionRoleConfigs.get(configId);
      config.embedMessageId = response.id;
      config.interactionToken = interaction.token;

    } catch (error) {
      console.error("Reaction roles command error:", error);
      await interaction.reply({
        content: "❌ Failed to create reaction roles setup menu.",
        flags: 64
      });
    }
  },
};
