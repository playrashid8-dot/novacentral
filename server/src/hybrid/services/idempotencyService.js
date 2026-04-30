import Idempotency from "../models/Idempotency.js";

const normalizeKey = (key) => String(key || "").trim().toLowerCase();

const conflictError = (message) => {
  const err = new Error(message);
  err.statusCode = 409;
  return err;
};

export async function beginIdempotentAction(type, key) {
  const normalized = normalizeKey(key);
  if (!normalized) {
    return { key: null, existing: null, shouldProcess: true };
  }

  const existing = await Idempotency.findOne({ type, key: normalized }).lean();
  if (existing) {
    if (existing.status === "completed" || existing.status === "failed") {
      return { key: normalized, existing, shouldProcess: false };
    }

    throw conflictError("Request is already being processed");
  }

  try {
    await Idempotency.create({
      type,
      key: normalized,
      status: "processing",
    });
  } catch (err) {
    if (err?.code !== 11000) {
      throw err;
    }

    const raced = await Idempotency.findOne({ type, key: normalized }).lean();
    if (raced?.status === "completed" || raced?.status === "failed") {
      return { key: normalized, existing: raced, shouldProcess: false };
    }

    throw conflictError("Request is already being processed");
  }

  return { key: normalized, existing: null, shouldProcess: true };
}

export async function completeIdempotentAction(type, key, response, session = null) {
  const normalized = normalizeKey(key);
  if (!normalized) {
    return null;
  }

  return Idempotency.findOneAndUpdate(
    { type, key: normalized },
    {
      $set: {
        status: "completed",
        response,
        lastError: "",
      },
    },
    { new: true, ...(session ? { session } : {}) }
  );
}

export async function failIdempotentAction(type, key, error, session = null) {
  const normalized = normalizeKey(key);
  if (!normalized) {
    return null;
  }

  return Idempotency.findOneAndUpdate(
    { type, key: normalized },
    {
      $set: {
        status: "failed",
        response: {
          success: false,
          msg: error?.message || String(error || "Financial action failed"),
          data: null,
        },
        lastError: String(error?.message || error || "Financial action failed").slice(0, 500),
      },
    },
    { new: true, ...(session ? { session } : {}) }
  );
}

export async function releaseIdempotentAction(type, key) {
  const normalized = normalizeKey(key);
  if (!normalized) {
    return null;
  }

  return Idempotency.deleteOne({
    type,
    key: normalized,
    status: "processing",
  });
}

export async function getCompletedIdempotency(type, key) {
  const normalized = normalizeKey(key);
  if (!normalized) {
    return null;
  }

  const row = await Idempotency.findOne({
    type,
    key: normalized,
    status: "completed",
  }).lean();

  return row?.response || null;
}

export async function markIdempotencyProcessing(type, key, session = null) {
  const normalized = normalizeKey(key);
  if (!normalized) {
    return null;
  }

  return Idempotency.findOneAndUpdate(
    { type, key: normalized },
    {
      $set: {
        status: "processing",
        lastError: "",
      },
      $setOnInsert: {
        response: null,
      },
    },
    { upsert: true, new: true, ...(session ? { session } : {}) }
  );
}

export async function completeIdempotency(type, key, response, session = null) {
  return completeIdempotentAction(type, key, response, session);
}

export async function failIdempotency(type, key, error, session = null) {
  return failIdempotentAction(type, key, error, session);
}
