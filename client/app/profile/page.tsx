"use client";

import { getUser, logout } from "../../lib/auth";

export default function Profile() {
  const user = getUser();

  return (
    <div className="min-h-screen text-white p-5">
      <h1 className="text-xl font-bold mb-5">Profile</h1>

      <div className="card">
        <p>Username: {user?.username}</p>
        <p>Email: {user?.email}</p>
      </div>

      <button onClick={logout} className="btn mt-5">
        Logout
      </button>
    </div>
  );
}