// commands/context-translate.js - Context menu "Translate" message command
const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ApplicationIntegrationType,
  InteractionContextType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
} = require("discord.js");

// Language choices for the select menu
const LANGUAGE_OPTIONS = [
  { label: "English", value: "en", emoji: "🇺🇸" },
  { label: "Spanish", value: "es", emoji: "🇪🇸" },
  { label: "French", value: "fr", emoji: "🇫🇷" },
  { label: "German", value: "de", emoji: "🇩🇪" },
  { label: "Italian", value: "it", emoji: "🇮🇹" },
  { label: "Portuguese", value: "pt", emoji: "🇵🇹" },
  { label: "Japanese", value: "ja", emoji: "🇯🇵" },
  { label: "Korean", value: "ko", emoji: "🇰🇷" },
  { label: "Chinese", value: "zh", emoji: "🇨🇳" },
  { label: "Russian", value: "ru", emoji: "🇷🇺" },
  { label: "Arabic", value: "ar", emoji: "🇸🇦" },
  { label: "Hindi", value: "hi", emoji: "🇮🇳" },
  { label: "Turkish", value: "tr", emoji: "🇹🇷" },
  { label: "Dutch", value: "nl", emoji: "🇳🇱" },
  { label: "Swedish", value: "sv", emoji: "🇸🇪" },
  { label: "Norwegian", value: "no", emoji: "🇳🇴" },
  { label: "Danish", value: "da", emoji: "🇩🇰" },
  { label: "Finnish", value: "fi", emoji: "🇫🇮" },
  { label: "Polish", value: "pl", emoji: "🇵🇱" },
  { label: "Czech", value: "cs", emoji: "🇨🇿" },
  { label: "Hungarian", value: "hu", emoji: "🇭🇺" },
  { label: "Greek", value: "el", emoji: "🇬🇷" },
  { label: "Thai", value: "th", emoji: "🇹🇭" },
  { label: "Vietnamese", value: "vi", emoji: "🇻🇳" },
  { label: "Indonesian", value: "id", emoji: "🇮🇩" },
];

const LANG_NAMES = Object.fromEntries(
  LANGUAGE_OPTIONS.map(opt => [opt.value, opt.label])
);

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("Translate")
    .setType(ApplicationCommandType.Message)
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    ])
    .setContexts([
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ]),

  LANGUAGE_OPTIONS,
  LANG_NAMES,

  async execute(interaction, storageService, translationService) {
    const targetMessage = interaction.targetMessage;

    if (!targetMessage.content || targetMessage.content.trim().length === 0) {
      return interaction.reply({
        content: "That message has no text content to translate.",
        flags: 64,
      });
    }

    // Check if user has a saved language preference
    const preferredLang = storageService?.userPreferences?.getPreferredLanguage(interaction.user.id);

    if (preferredLang) {
      // Translate directly using saved preference
      await interaction.deferReply({ flags: 64 });

      try {
        const metadata = {
          discordUserId: interaction.user.id,
          userName: interaction.user.username,
          ...(interaction.guildId && { guildId: interaction.guildId }),
          ...(interaction.channelId && { channelId: interaction.channelId }),
          ...(interaction.guild?.name && { guildName: interaction.guild.name }),
          ...(interaction.channel?.name && { channelName: interaction.channel.name }),
        };

        const translatedText = await translationService.translateMessage(
          targetMessage.content,
          preferredLang,
          metadata
        );

        if (!translatedText) {
          await interaction.editReply({
            content: 'Translation returned no result. The message may already be in the target language.',
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor('#50fa7b')
          .setAuthor({ name: `Translated to ${LANG_NAMES[preferredLang] || preferredLang.toUpperCase()}` })
          .setDescription(translatedText)
          .setFooter({
            text: `Requested by ${interaction.user.username} • /translate set-language to change`,
            iconURL: interaction.user.displayAvatarURL({ extension: 'png' }),
          });

        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Context menu translation failed:', err);
        await interaction.editReply({
          content: `Translation failed: ${err.message}`,
        });
      }
      return;
    }

    // No saved preference — show language picker dropdown
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`ctx_translate:${targetMessage.id}`)
        .setPlaceholder("Select a language to translate to...")
        .addOptions(LANGUAGE_OPTIONS)
    );

    await interaction.reply({
      content: "Select a language to translate this message into:\n-# Tip: Use `/translate set-language` to set a default and skip this step.",
      components: [row],
      flags: 64,
    });
  },
};
