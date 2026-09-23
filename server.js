// server.js — Aegis demo dashboard (şifre korumalı aksiyonlar)
require("dotenv").config();
const express = require("express");
const { spawn } = require("child_process");
const { ethers } = require("ethers");
const RPC = process.env.RPC_URL || "https://rpc.testnet.arc.network";
const CHAIN_ID = Number(process.env.CHAIN_ID || 5042002);
const USDC = "0x3600000000000000000000000000000000000000";
const PORT = process.env.PORT || 3000;
const ACTION_KEY = process.env.ACTION_KEY || "aegis2026";  // düğme şifresi
const VAULT_ABI = [
  "event Spent(address indexed to, uint256 amount)",
  "event Paused(address indexed by)",
  "event Unpaused()",
  "function paused() view returns (bool)",
  "function maxPerTx() view returns (uint256)",
  "function dailyLimit() view returns (uint256)",
  "function spentLast24h() view returns (uint256)",
  "function agent() view returns (address)",
  "function unpause()",
];
const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, {
  staticNetwork: true, pollingInterval: 8000, batchMaxCount: 1,
});
const owner = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const vault = new ethers.Contract(process.env.VAULT_ADDRESS, VAULT_ABI, owner);
const usdc = new ethers.Contract(USDC, ["function balanceOf(address) view returns (uint256)"], provider);
const state = {
  paused: null, balance: 0, maxPerTx: 0, dailyLimit: 0, spent24h: 0,
  agent: null, vault: process.env.VAULT_ADDRESS,
  events: [], logs: [], procs: { agent: null, brain: null }, lastError: null,
};
function log(source, line) {
  state.logs.push({ time: Date.now(), source, line: line.trim() });
  if (state.logs.length > 200) state.logs.shift();
}
let lastBlock = 0;
async function poll() {
  try {
    state.paused = await vault.paused();
    state.balance = Number(await usdc.balanceOf(state.vault)) / 1e6;
    state.maxPerTx = Number(await vault.maxPerTx()) / 1e6;
    state.dailyLimit = Number(await vault.dailyLimit()) / 1e6;
    state.spent24h = Number(await vault.spentLast24h()) / 1e6;
    state.agent = await vault.agent();
    const now = await provider.getBlockNumber();
    if (now > lastBlock) {
      const evs = await vault.queryFilter("*", lastBlock + 1, now);
      lastBlock = now;
      for (const ev of evs) {
        if (!ev.fragment) continue;
        const base = { time: Date.now(), tx: ev.transactionHash };
        if (ev.fragment.name === "Spent")
          state.events.unshift({ ...base, type: "spent", amount: Number(ev.args.amount) / 1e6, to: ev.args.to });
        if (ev.fragment.name === "Paused") state.events.unshift({ ...base, type: "paused" });
        if (ev.fragment.name === "Unpaused") state.events.unshift({ ...base, type: "unpaused" });
      }
      if (state.events.length > 100) state.events.length = 100;
    }
    state.lastError = null;
  } catch (err) {
    state.lastError = (err.shortMessage || err.message).slice(0, 100);
  }
}
function startProc(name, args) {
  if (state.procs[name]) return;
  const child = spawn("node", args, { cwd: __dirname });
  state.procs[name] = child;
  const onData = (buf) =>
    buf.toString().split("\n").filter((l) => l.trim() && !l.includes("injected env"))
      .forEach((l) => log(name, l));
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  child.on("exit", () => { state.procs[name] = null; log(name, "(process exited)"); });
}
// --- şifre kontrolü (body.key veya ?key) ---
function auth(req, res, next) {
  const key = (req.body && req.body.key) || req.query.key;
  if (key !== ACTION_KEY) return res.status(401).json({ error: "wrong password" });
  next();
}
const app = express();
app.use(express.json());
app.use(express.static(__dirname + "/public"));
app.get("/api/state", (req, res) => {
  res.json({
    ...state,
    procs: { agent: !!state.procs.agent, brain: !!state.procs.brain },
    logs: state.logs.slice(-60),
  });
});
app.post("/api/agent/normal", auth, (req, res) => { startProc("agent", ["agent.js"]); res.json({ ok: true }); });
app.post("/api/agent/rogue", auth, (req, res) => {
  if (state.procs.agent) { state.procs.agent.kill(); state.procs.agent = null; }
  setTimeout(() => startProc("agent", ["agent.js", "--rogue"]), 300);
  res.json({ ok: true });
});
app.post("/api/agent/stop", auth, (req, res) => { state.procs.agent?.kill(); res.json({ ok: true }); });
app.post("/api/brain/start", auth, (req, res) => { startProc("brain", ["riskbrain.js"]); res.json({ ok: true }); });
app.post("/api/unpause", auth, async (req, res) => {
  try {
    const tx = await vault.unpause({
      maxFeePerGas: ethers.parseUnits("20", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("20", "gwei"),
    });
    await tx.wait();
    log("brain", `Owner reopened the vault: ${tx.hash}`);
    res.json({ ok: true, tx: tx.hash });
  } catch (err) {
    res.status(500).json({ error: (err.shortMessage || err.message).slice(0, 120) });
  }
});
async function startServer() {
  lastBlock = await provider.getBlockNumber();
  setInterval(poll, 8000);
  poll();
  app.listen(PORT, () => console.log(`Aegis dashboard on port ${PORT} (action key set)`));
}
startServer().catch((err) => { console.error(err); process.exit(1); });
