// commands/translate/set-language.js
const { SlashCommandSubcommandBuilder } = require('discord.js');

const LANGUAGE_CHOICES = [
  { name: '🇺🇸 English', value: 'en' },
  { name: '🇪🇸 Spanish', value: 'es' },
  { name: '🇫🇷 French', value: 'fr' },
  { name: '🇩🇪 German', value: 'de' },
  { name: '🇮🇹 Italian', value: 'it' },
  { name: '🇵🇹 Portuguese', value: 'pt' },
  { name: '🇯🇵 Japanese', value: 'ja' },
  { name: '🇰🇷 Korean', value: 'ko' },
  { name: '🇨🇳 Chinese', value: 'zh' },
  { name: '🇷🇺 Russian', value: 'ru' },
  { name: '🇸🇦 Arabic', value: 'ar' },
  { name: '🇮🇳 Hindi', value: 'hi' },
  { name: '🇹🇷 Turkish', value: 'tr' },
  { name: '🇳🇱 Dutch', value: 'nl' },
  { name: '🇸🇪 Swedish', value: 'sv' },
  { name: '🇳🇴 Norwegian', value: 'no' },
  { name: '🇩🇰 Danish', value: 'da' },
  { name: '🇫🇮 Finnish', value: 'fi' },
  { name: '🇵🇱 Polish', value: 'pl' },
  { name: '🇨🇿 Czech', value: 'cs' },
  { name: '🇭🇺 Hungarian', value: 'hu' },
  { name: '🇬🇷 Greek', value: 'el' },
  { name: '🇹🇭 Thai', value: 'th' },
  { name: '🇻🇳 Vietnamese', value: 'vi' },
  { name: '🇮🇩 Indonesian', value: 'id' },
];

const LANG_NAMES = Object.fromEntries(
  LANGUAGE_CHOICES.map(c => [c.value, c.name])
);

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('set-language')
    .setDescription('Set your preferred translation language')
    .addStringOption(option =>
      option
        .setName('language')
        .setDescription('Your preferred language (leave empty to clear)')
        .setRequired(false)
        .addChoices(...LANGUAGE_CHOICES)
    ),

  async execute(interaction) {
    const { storageService } = require('../../index');
    const language = interaction.options.getString('language');

    if (!language) {
      const current = storageService.userPreferences.getPreferredLanguage(interaction.user.id);
      if (current) {
        storageService.userPreferences.clearPreferredLanguage(interaction.user.id);
        await interaction.reply({
          content: `✅ Your preferred language has been cleared. You'll be asked to pick a language each time you translate.`,
          flags: 64,
        });
      } else {
        await interaction.reply({
          content: `You don't have a preferred language set. Use \`/translate set-language language:<lang>\` to set one.`,
          flags: 64,
        });
      }
      return;
    }

    const result = storageService.userPreferences.setPreferredLanguage(interaction.user.id, language);

    if (result.success) {
      const langName = LANG_NAMES[language] || language.toUpperCase();
      await interaction.reply({
        content: `✅ Your preferred translation language has been set to **${langName}**.\n\nWhen you use the **Translate** context menu, messages will automatically translate to this language. You can still pick a different language from the dropdown if needed.`,
        flags: 64,
      });
    } else {
      await interaction.reply({
        content: '❌ Failed to save your language preference. Please try again.',
        flags: 64,
      });
    }
  },
};
