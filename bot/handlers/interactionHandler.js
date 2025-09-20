// handlers/interactionHandler.js (Updated to handle editing)
const ReactionRoleButtons = require('./reactionRoleButtons');

class InteractionHandler {
  constructor(storageService) {
    this.storageService = storageService;
    this.reactionRoleButtons = new ReactionRoleButtons(storageService);
  }

  async handleInteraction(interaction) {
    try {
      if (interaction.isButton()) {
        return await this.reactionRoleButtons.handleButtonInteraction(interaction);
      }

      if (interaction.isStringSelectMenu()) {
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