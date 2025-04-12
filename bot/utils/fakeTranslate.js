module.exports = async function fakeTranslate(text, langTo = "en") {
  return (
    text
      .split(" ")
      .map((word) => {
        if (/<<\d+>>/.test(word)) return word; // skip protected tokens
        return word
          .split("")
          .sort(() => 0.5 - Math.random())
          .join("");
      })
      .join(" ") + ` (→${langTo})`
  );
};
