// services/translation/index.js
const Translator = require('./translator');
const flagMap = require('./flagMap');

class TranslationService {
  constructor(config) {
    this.config = config;
    this.translator = new Translator();
    this.flagMap = flagMap;
  }

  isTranslationRequest(emoji) {
    if (!this.config.translation.enabled) return false;
    return this.flagMap.hasOwnProperty(emoji);
  }

  getTargetLanguage(emoji) {
    return this.flagMap[emoji];
  }

  async translateMessage(content, targetLang, metadata = {}) {
    if (!this.config.translation.enabled) {
      throw new Error('Translation service is disabled');
    }

    if (!this.config.translation.supportedLanguages.includes(targetLang)) {
      throw new Error(`Language ${targetLang} is not supported`);
    }

    return await this.translator.translate(content, 'detect', targetLang, metadata);
  }

  createTranslationEmbed(translatedText, targetLang, flag, user, isFromCache = false) {
    const { EmbedBuilder } = require("discord.js");
    
    const embed = new EmbedBuilder()
      .setColor("#50fa7b")
      .setAuthor({ name: `Translated to ${targetLang.toUpperCase()} ${flag}` })
      .setDescription(translatedText)
      .setFooter({ 
        text: `Requested by ${user.username}${isFromCache ? ' • From cache' : ''}`, 
        iconURL: user.displayAvatarURL({ extension: "png" }) 
      });

    return embed;
  }
}

module.exports = TranslationService;
