// handlers/reactionHandler.js
class ReactionHandler {
  constructor(storageService, translationService, config) {
    this.storageService = storageService;
    this.translationService = translationService;
    this.config = config;
  }

  async handleAdd(reaction, user) {
    if (user.bot) return;

    try {
      // Fetch partial data
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();

      // Get guild member info
      let guildMember = null;
      if (reaction.message.guild) {
        try {
          guildMember = await reaction.message.guild.members.fetch(user.id);
        } catch (e) {
          guildMember = null;
        }
      }

      // Storage (independent of translation)
      await this.storageService.storeReaction(reaction, user, guildMember);

      // Translation (independent of storage)
      await this.handleTranslation(reaction, user);

    } catch (err) {
      console.error("Error in reaction handler:", err);
    }
  }

  async handleRemove(reaction, user) {
    if (user.bot) return;

    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();

      await this.storageService.removeReaction(reaction, user);
    } catch (err) {
      console.error("Error removing reaction:", err);
    }
  }

  async handleTranslation(reaction, user) {
    const flag = reaction.emoji.name;
    
    // Check if this is a translation request
    if (!this.translationService.isTranslationRequest(flag)) return;

    // Don't translate bot messages
    if (reaction.message.author?.bot) return;

    const targetLang = this.translationService.getTargetLanguage(flag);
    const original = reaction.message.content;

    if (!original || original.trim().length === 0) return;

    try {
      // Check for existing translation - if exists, silently ignore
      const existing = this.storageService.translations.getExistingTranslation(
        reaction.message.id, 
        targetLang
      );

      if (existing) {
        // Translation already exists - silently ignore this reaction
        console.log(`Ignoring duplicate translation request from ${user.username} for message ${reaction.message.id} -> ${targetLang} (already exists)`);
        return;
      }

      // No existing translation - make new API call and post publicly
      const translatedText = await this.translationService.translateMessage(
        original, 
        targetLang, 
        {
          discordUserId: user.id,
          userName: user.username,
          guildId: reaction.message.guild?.id,
          channelId: reaction.message.channel?.id,
          guildName: reaction.message.guild?.name,
          channelName: reaction.message.channel?.name,
        }
      );

      if (!translatedText) {
        console.log(`Skipping translation: Nothing returned for ${reaction.message.id}`);
        return;
      }

      // Store the new translation
      this.storageService.translations.storeTranslation(
        reaction.message.id,
        targetLang,
        translatedText,
        user.id
      );

      // Create embed for public reply
      const embed = this.translationService.createTranslationEmbed(
        translatedText, 
        targetLang, 
        flag, 
        user,
        false // not from cache
      );

      // Reply to the original message publicly (creates threaded response)
      await reaction.message.reply({ embeds: [embed] });

    } catch (err) {
      console.error("Translation failed:", err);
      
      // Only show error to the user who requested it
      try {
        await reaction.message.reply({ 
          content: `${user}, translation to ${targetLang.toUpperCase()} failed. Please try again later.`,
          allowedMentions: { repliedUser: false }
        });
      } catch (replyErr) {
        console.error("Failed to send error reply:", replyErr);
      }
    }
  }
}

module.exports = ReactionHandler;
