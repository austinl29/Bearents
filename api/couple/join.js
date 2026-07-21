const { joinCouple } = require('../../lib/couples');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { code, displayName } = req.body || {};
  if (!code) return res.status(400).json({ error: 'code is required' });
  try {
    const result = await joinCouple(String(code).toUpperCase().trim(), displayName);
    res.status(200).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
