"use client";

import API from "./api";
import { updateUser } from "./auth";

export const fetchCurrentUser = async () => {
  const res = await API.get("/user/me");
  const user = res.data?.user || null;
  if (user) {
    updateUser(user);
  }
  return user;
};
