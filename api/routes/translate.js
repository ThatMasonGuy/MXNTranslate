// api/routes/translate.js
const express = require("express");
const router = express.Router();

router.post("/", async (req, res) => {
  const { text, langFrom = "auto", langTo, placeholders } = req.body;

  // Dumb mock translation logic for now
  const fakeTranslated = text.split("").reverse().join("") + ` (→${langTo})`;

  // Re-insert placeholders (basic, positional replacement)
  let finalText = fakeTranslated;
  for (const [key, value] of Object.entries(placeholders || {})) {
    finalText = finalText.replace(key, value);
  }

  res.json({ translated: finalText });
});

module.exports = router;
