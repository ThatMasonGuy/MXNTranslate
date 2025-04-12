// utils/reconstructMessage.js
module.exports = function reconstructMessage(
  translatedText,
  placeholders = {}
) {
  return translatedText.replace(
    /<<(\d+)>>/g,
    (_, index) => placeholders[index] || `<<${index}>>`
  );
};
