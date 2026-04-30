import Idempotency from "../models/Idempotency.js";

const normalizeKey = (key) => String(key || "").trim().toLowerCase();

export async function getCompletedIdempotency(type, key, session = null) {
  const normalized = normalizeKey(key);
  if (!normalized) {
    return null;
  }

  const query = Idempotency.findOne({
    type,
    key: normalized,
    status: "completed",
  }).select("response");

  if (session) {
    query.session(session);
  }

  const existing = await query.lean();
  return existing?.response ?? null;
}

export async function markIdempotencyProcessing(type, key, session = null) {
  const normalized = normalizeKey(key);
  if (!normalized) {
    return null;
  }

  return Idempotency.findOneAndUpdate(
    { type, key: normalized },
    {
      $setOnInsert: {
        type,
        key: normalized,
        status: "processing",
      },
    },
    {
      upsert: true,
      new: true,
      ...(session ? { session } : {}),
    }
  );
}

export async function completeIdempotency(type, key, response, session = null) {
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
    {
      upsert: true,
      new: true,
      ...(session ? { session } : {}),
    }
  );
}

export async function failIdempotency(type, key, error, session = null) {
  const normalized = normalizeKey(key);
  if (!normalized) {
    return null;
  }

  return Idempotency.findOneAndUpdate(
    { type, key: normalized },
    {
      $set: {
        status: "failed",
        lastError: String(error?.message || error || "Financial action failed").slice(0, 500),
      },
    },
    {
      upsert: true,
      new: true,
      ...(session ? { session } : {}),
    }
  );
}
