const URL_REGEX = /\bhttps?:\/\/[^\s]+/gi;
const MENTION_REGEX = /<@!?\d+>/g;
const CHANNEL_REGEX = /<#\d+>/g;
const ROLE_REGEX = /<@&\d+>/g;
const CODEBLOCK_REGEX = /(```[\s\S]*?```|`[^`]+`)/g;
const EMOJI_REGEX = /<a?:\w+:\d+>|[\u{1F600}-\u{1F6FF}]/gu;

const START = '\uE000';
const END = '\uE001';
const PLACEHOLDER_WRAP = (id) => `[PH${id}]`;

module.exports = function sanitizeMessage(message) {
  let index = 0;
  const placeholders = {};

  const safeReplace = (regex) => {
    return (text) =>
      text.replace(regex, (match) => {
        const id = index++;
        placeholders[id] = match;
        return PLACEHOLDER_WRAP(id);
      });
  };

  let sanitized = message;
  sanitized = safeReplace(URL_REGEX)(sanitized);
  sanitized = safeReplace(MENTION_REGEX)(sanitized);
  sanitized = safeReplace(CHANNEL_REGEX)(sanitized);
  sanitized = safeReplace(ROLE_REGEX)(sanitized);
  sanitized = safeReplace(CODEBLOCK_REGEX)(sanitized);
  sanitized = safeReplace(EMOJI_REGEX)(sanitized);

  console.log("Sanitized message:", sanitized);
  console.log("Placeholders:", placeholders);

  return { sanitized, placeholders };
};
