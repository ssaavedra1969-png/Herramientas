function devReadOnly(req, res, next) {
  if (process.env.DEV_READ_ONLY !== 'true') return next();

  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  if (req.originalUrl.startsWith('/api/auth/')) {
    return next();
  }

  console.log(`[DEV READ-ONLY] Bloqueado: ${req.method} ${req.originalUrl}`);
  return res.status(403).json({
    error: 'Modo desarrollo read-only — no se permiten cambios',
    method: req.method,
    path: req.originalUrl
  });
}

module.exports = { devReadOnly };
