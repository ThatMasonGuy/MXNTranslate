// api/index.js
const express = require("express");
const cors = require("cors");
const translateRoute = require("./routes/translate");

const app = express();
const PORT = 3600;

app.use(cors());
app.use(express.json());
app.use("/translate", translateRoute);

app.listen(PORT, () => {
  console.log(`🛰️  Translation API running on http://localhost:${PORT}`);
});
