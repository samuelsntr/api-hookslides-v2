export function successResponse(res, status, message, data) {
  return res.status(status).json({ success: true, message, data });
}

export function errorResponse(res, status, message, code, details) {
  return res.status(status).json({ success: false, message, error: { code, ...(details ? { details } : {}) } });
}
