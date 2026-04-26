const baseUrl = "http://localhost:5000";

const getCookie = (headers) => {
  const raw = headers.getSetCookie?.().join(";") || headers.get("set-cookie") || "";
  return raw.match(/token=[^;]+/)?.[0] || null;
};

const request = async (method, path, { cookie, body } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { success: false, msg: text || "Non-JSON response", data: null };
  }

  return {
    status: response.status,
    ok: response.ok,
    json,
    cookie: getCookie(response.headers),
  };
};

const assertOk = (label, result) => {
  if (!result.ok || result.json?.success === false) {
    throw new Error(`${label} failed: ${JSON.stringify(result)}`);
  }
};

const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const user = {
  username: `flow${suffix}`.slice(0, 20),
  email: `flow${suffix}@nova.test`,
  password: "Flow@Test#2026",
  number: `03${suffix}`.slice(0, 11),
};

const register = await request("POST", "/api/auth/register", { body: user });
assertOk("Register user", register);
const userCookie = register.cookie;

const deposit = await request("POST", "/api/deposit", {
  cookie: userCookie,
  body: {
    amount: 25,
    txHash: `admin-flow-${suffix}`,
  },
});
assertOk("Create deposit", deposit);
const depositId = deposit.json?.data?.deposit?._id;

const adminLogin = await request("POST", "/api/auth/login", {
  body: {
    identifier: "admin",
    password: "Nova@Admin#2026!",
  },
});
assertOk("Admin login", adminLogin);
const adminCookie = adminLogin.cookie;

const approveDeposit = await request("POST", `/api/admin/approve-deposit/${depositId}`, {
  cookie: adminCookie,
});
assertOk("Approve deposit", approveDeposit);

const afterDepositStats = await request("GET", "/api/user/stats", { cookie: userCookie });
assertOk("Fetch post-deposit stats", afterDepositStats);

const withdrawal = await request("POST", "/api/withdrawal", {
  cookie: userCookie,
  body: {
    amount: 5,
    walletAddress: "0x1111111111111111111111111111111111111111",
  },
});
assertOk("Create withdrawal", withdrawal);
const withdrawalId = withdrawal.json?.data?.withdrawal?._id;

const approveWithdrawal = await request("POST", `/api/admin/approve-withdrawal/${withdrawalId}`, {
  cookie: adminCookie,
});
assertOk("Approve withdrawal", approveWithdrawal);

const finalStats = await request("GET", "/api/user/stats", { cookie: userCookie });
assertOk("Fetch final stats", finalStats);

console.log(JSON.stringify({
  success: true,
  msg: "Admin flow test completed",
  data: {
    adminLogin: adminLogin.json?.success === true,
    adminCookieGenerated: Boolean(adminCookie),
    deposit: {
      created: deposit.json?.success === true,
      approved: approveDeposit.json?.success === true,
      balanceAfterApproval: afterDepositStats.json?.stats?.balance,
    },
    withdrawal: {
      created: withdrawal.json?.success === true,
      approved: approveWithdrawal.json?.success === true,
      finalBalance: finalStats.json?.stats?.balance,
    },
  },
}, null, 2));
