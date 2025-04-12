const URL_REGEX = /\bhttps?:\/\/[^\s]+/gi;
const MENTION_REGEX = /<@!?\d+>/g;
const CHANNEL_REGEX = /<#\d+>/g;
const ROLE_REGEX = /<@&\d+>/g;
const CODEBLOCK_REGEX = /(```[\s\S]*?```|`[^`]+`)/g;
const EMOJI_REGEX = /<a?:\w+:\d+>|[\u{1F600}-\u{1F6FF}]/gu;

module.exports = function sanitizeMessage(message) {
  let index = 0;
  const placeholders = {};

  const safeReplace = (regex) => {
    return (text) =>
      text.replace(regex, (match) => {
        const id = index++;
        placeholders[id] = match;
        return `<<${id}>>`;
      });
  };

  let sanitized = message;
  sanitized = safeReplace(/\bhttps?:\/\/[^\s]+/gi)(sanitized); // URLs
  sanitized = safeReplace(/<@!?\d+>/g)(sanitized); // Mentions
  sanitized = safeReplace(/<#\d+>/g)(sanitized); // Channels
  sanitized = safeReplace(/<@&\d+>/g)(sanitized); // Roles
  sanitized = safeReplace(/(```[\s\S]*?```|`[^`]+`)/g)(sanitized); // Code blocks
  sanitized = safeReplace(/<a?:\w+:\d+>|[\u{1F600}-\u{1F6FF}]/gu)(sanitized); // Emojis

  return { sanitized, placeholders };
};
