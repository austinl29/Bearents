const { createCouple } = require('../../lib/couples');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { displayName } = req.body || {};
  try {
    const result = await createCouple(displayName);
    res.status(200).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
