// commands/translate/edit-reaction-roles.js
const { SlashCommandSubcommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("edit-reaction-roles")
        .setDescription("Edit existing reaction role messages"),

    async execute(interaction) {
        try {
            // Check permissions
            if (!interaction.member.permissions.has('ManageRoles')) {
                return await interaction.reply({
                    content: "⚠️ You need the 'Manage Roles' permission to use this command.",
                    flags: 64
                });
            }

            // Get storage service from the main bot file
            const { storageService } = require('../../index');

            // Get user's existing reaction role configs
            const userConfigs = storageService.reactionRoles.getUserConfigs(
                interaction.guild.id,
                interaction.user.id
            );

            if (userConfigs.length === 0) {
                return await interaction.reply({
                    content: "❌ You haven't created any reaction role messages yet. Use `/translate reaction-roles` to create one first.",
                    flags: 64
                });
            }

            // Create embed showing available messages to edit
            const embed = new EmbedBuilder()
                .setColor("#5865f2")
                .setTitle("✏️ Edit Reaction Roles")
                .setDescription("Select a reaction role message to edit:")
                .setFooter({ text: "Choose from the dropdown below" });

            // Create select menu with user's reaction role messages
            const selectOptions = userConfigs.slice(0, 25).map(config => {
                const channel = interaction.guild.channels.cache.get(config.channel_id);
                const channelName = channel ? `#${channel.name}` : "Unknown Channel";

                // Calculate available space for preview (100 char limit - channel name - separator)
                const separator = " - ";
                const availableLength = 100 - channelName.length - separator.length - 3; // 3 for "..."

                // Truncate message content to fit within Discord's 100 character limit
                let preview = config.message_content.replace(/\n/g, ' '); // Replace newlines with spaces
                if (preview.length > availableLength) {
                    preview = preview.substring(0, Math.max(10, availableLength)) + "...";
                }

                return {
                    label: `${channelName}${separator}${preview}`,
                    value: config.id.toString(),
                    description: `Created: ${new Date(config.created_at).toLocaleDateString()}`,
                };
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('edit_rr_select')
                .setPlaceholder('Choose a reaction role message to edit')
                .addOptions(selectOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.reply({
                embeds: [embed],
                components: [row],
                flags: 64
            });

        } catch (error) {
            console.error("Edit reaction roles command error:", error);
            await interaction.reply({
                content: "❌ Failed to load reaction role messages for editing.",
                flags: 64
            });
        }
    },
};