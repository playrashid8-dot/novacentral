export const sendSuccess = (res, msg, data = {}) =>
  res.json({ success: true, msg, data });

export const sendError = (res, code, msg) =>
  res.status(code).json({ success: false, msg, data: {} });
