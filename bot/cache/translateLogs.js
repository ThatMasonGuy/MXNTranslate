const logs = [];

function logTranslation(messageId, lang, status, reason = "") {
  logs.unshift({
    time: new Date().toISOString(),
    messageId,
    lang,
    status, // success, denied, error
    reason,
  });
  if (logs.length > 10) logs.pop();
}

function getLogs() {
  return logs;
}

module.exports = {
  logTranslation,
  getLogs,
};
