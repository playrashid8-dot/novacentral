/**
 * PM2: API replicas (distinct ports behind nginx upstream), hybrid singleton, BullMQ workers.
 * From repo: cd server && pm2 start ecosystem.config.cjs
 *
 * Scaling: nginx round-robins 5000–5002 for NOVA_SERVICE=api forks.
 * Optional: pm2-runtime -i max is single-port cluster — use nginx multi-port fork mode instead per deploy/nginx/.
 */
const path = require("path");

const cwd = __dirname;

const interpreterArgs = "--expose-gc --max-old-space-size=2048";

const commonEnv = {
  NODE_ENV: process.env.NODE_ENV || "production",
};

module.exports = {
  apps: [
    {
      name: "nova-api-5000",
      cwd,
      script: "./src/server.js",
      instances: 1,
      exec_mode: "fork",
      interpreter_args: interpreterArgs,
      env: {
        ...commonEnv,
        NOVA_SERVICE: "api",
        PORT: 5000,
      },
    },
    {
      name: "nova-api-5001",
      cwd,
      script: "./src/server.js",
      instances: 1,
      exec_mode: "fork",
      interpreter_args: interpreterArgs,
      env: {
        ...commonEnv,
        NOVA_SERVICE: "api",
        PORT: 5001,
      },
    },
    {
      name: "nova-api-5002",
      cwd,
      script: "./src/server.js",
      instances: 1,
      exec_mode: "fork",
      interpreter_args: interpreterArgs,
      env: {
        ...commonEnv,
        NOVA_SERVICE: "api",
        PORT: 5002,
      },
    },
    {
      name: "nova-hybrid",
      cwd,
      script: "./src/hybridService.js",
      instances: 1,
      exec_mode: "fork",
      interpreter_args: interpreterArgs,
      env: {
        ...commonEnv,
        PORT: 5050,
      },
    },
    {
      name: "nova-worker-deposit",
      cwd,
      script: "./src/workers/depositWorker.js",
      instances: 2,
      exec_mode: "fork",
      interpreter_args: interpreterArgs,
      env: commonEnv,
    },
  ],
};
