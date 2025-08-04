const START = '\uE000';
const END = '\uE001';

const PLACEHOLDER_REGEX = /\[PH(\d+)\]/g;

module.exports = function reconstructMessage(translatedText, placeholders = {}) {
  return translatedText.replace(
    PLACEHOLDER_REGEX,
    (_, index) => placeholders[index] || `[PH${index}]`
  );
};
