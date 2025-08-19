// Simplified version to reduce file dependencies
export default function handler(req, res) {
  res.status(503).json({ error: 'Vehicle assignment service temporarily unavailable' });
}