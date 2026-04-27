"use client";

import API from "./api";

export const fetchCurrentUser = async () => {
  const res = await API.get("/user/me");
  return res.data?.data ?? res.data?.user ?? null;
};
