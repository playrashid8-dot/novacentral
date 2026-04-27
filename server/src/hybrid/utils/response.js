export const sendSuccess = (res, msg, data = null, status = 200) =>
  res.status(status).json({
    success: true,
    msg,
    data,
  });

export const sendError = (res, status, msg, data = null) =>
  res.status(status).json({
    success: false,
    msg,
    data,
  });
