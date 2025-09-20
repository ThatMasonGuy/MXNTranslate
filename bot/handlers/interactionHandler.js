// handlers/interactionHandler.js (New file to handle all button/modal/select interactions)
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
}

module.exports = InteractionHandler;
