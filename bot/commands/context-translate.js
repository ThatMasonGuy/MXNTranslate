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

  async execute(interaction) {
    const targetMessage = interaction.targetMessage;

    if (!targetMessage.content || targetMessage.content.trim().length === 0) {
      return interaction.reply({
        content: "That message has no text content to translate.",
        flags: 64,
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`ctx_translate:${targetMessage.id}`)
        .setPlaceholder("Select a language to translate to...")
        .addOptions(LANGUAGE_OPTIONS)
    );

    await interaction.reply({
      content: "Select a language to translate this message into:",
      components: [row],
      flags: 64,
    });
  },
};
