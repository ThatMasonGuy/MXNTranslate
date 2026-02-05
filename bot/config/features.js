// config/features.js
module.exports = {
    storage: {
        enabled: true,
        logMessages: true,
        logReactions: true,
        logEdits: true,
        logDeletes: true,
        logUserEvents: true,  // Member joins/leaves, updates, voice, moderation
        logServerEvents: true, // Roles, channels, emojis, guild updates, invites, webhooks
        backfillOnStartup: true
    },
    translation: {
        enabled: true,
        requireReaction: true,
        supportedLanguages: [
            // Core
            'en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ru', 'ar', 'hi', 'tr',

            // Europe
            'nl', 'sv', 'no', 'da', 'fi', 'pl', 'cs', 'hu', 'el', 'he', 'ro', 'uk', 'bg',
            'sr', 'hr', 'sk', 'sl',

            // Asia-Pacific
            'th', 'vi', 'id', 'ms', 'tl', 'bn', 'si',

            // Middle East & South Asia
            'fa', 'ur',

            // Africa
            'sw', 'am', 'zu', 'xh', 'st',
        ]

    },
    reactionRoles: {
        enabled: true,
        maxConfigsPerGuild: 10,
        maxReactionsPerConfig: 20
    }
};