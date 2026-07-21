const { relinkCouple } = require('../../lib/couples');

// Recovery path: if a phone is reinstalled/site-data-cleared, the localStorage
// memberId is gone. This lets you re-establish your slot by pasting back in
// the couple code + the raw memberId you saved from Settings beforehand.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { code, memberId } = req.body || {};
  if (!code || !memberId) return res.status(400).json({ error: 'code and memberId are required' });
  try {
    const result = await relinkCouple(String(code).toUpperCase().trim(), String(memberId));
    res.status(200).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
