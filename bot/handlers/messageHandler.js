// handlers/messageHandler.js
class MessageHandler {
  constructor(storageService, config) {
    this.storageService = storageService;
    this.config = config;
  }

  async handleCreate(msg) {
    if (msg.author.bot) return;
    
    try {
      await this.storageService.storeMessage(msg);
    } catch (err) {
      console.error("Failed to log message:", err);
    }
  }

  async handleUpdate(oldMsg, newMsg) {
    try {
      await this.storageService.updateMessage(oldMsg, newMsg);
    } catch (err) {
      console.error("Failed to log message edit:", err);
    }
  }

  async handleDelete(msg) {
    try {
      await this.storageService.markMessageDeleted(msg);
    } catch (err) {
      console.error("Failed to log message deletion:", err);
    }
  }
}

module.exports = MessageHandler;
