# 🛡 Aegis — Spend-Control Firewall for AI Agents

**Built on Arc Network** · USDC-native · [Live vault on Arc Testnet](https://testnet.arcscan.app/address/0x5FB636AbB12A0E2d8F3ec5251dfaEbD4Faa87BfF)

AI agents are starting to hold wallets and pay autonomously. The hard problem
isn't spending — it's **trusting an agent with real money**. Nobody wants to
hand an AI a raw private key.

Aegis is what Ramp/Brex corporate cards + fraud controls are for employees,
**for the agent economy**: programmable budgets, hard on-chain limits, an
allowlist, and a circuit breaker that trips the moment behavior turns anomalous.

```
AI agent → spend() → Policy Vault (Arc, USDC + hard limits) → service / other agent
                          ↑
              Risk brain (off-chain, scores behavior → trips the breaker)
```

## How it works — two layers of defense

**Layer 1 — hard limits, enforced on-chain (`contracts/src/SpendVault.sol`):**
the agent never holds funds or a treasury key. Money sits in a vault that
reverts anything outside policy:

| Rule | What it enforces |
|---|---|
| `maxPerTx` | absolute cap per transaction |
| `dailyLimit` | sliding 24-hour window cap |
| `allowlist` | funds can only ever flow to approved addresses |
| `paused` | circuit breaker — blocks everything until a human reopens |

Two roles: the **owner** (human) sets policy, withdraws, and is the only one
who can unpause. The **agent** can only call `spend()` — and `pause()`, because
raising the alarm should be cheap; silencing it should require a human.

**Layer 2 — the risk brain (`riskbrain.js`):** watches `Spent` events in real
time and scores behavior (velocity, amount spikes vs. the agent's own moving
average). Anomaly → it trips the on-chain breaker. Even if the brain dies,
Layer 1 stands: worst-case loss is mathematically bounded by the limits.

**Proven live on Arc Testnet:** a rogue agent's 4.22 USDC spend (27.8× its
average) was detected and the breaker tripped within seconds —
[breaker tx](https://testnet.arcscan.app/tx/0xa0c25f9342bb8ec4f10e1d84a611ce556b248c96c25a9c7a8fb66c1d7ef04d8f).
Every subsequent spend reverted with `VaultPaused`.

## Quick start

```bash
npm install
cp .env.example .env   # fill in keys (testnet only!)

npm run dashboard      # live dashboard at http://localhost:3000
```

From the dashboard: start the risk brain → start the normal agent → hit
**RED TEAM** to send the agent rogue → watch the breaker trip on-chain.

CLI equivalents: `npm run brain` / `agent` / `rogue` / `status` / `pause` / `unpause`.

Contract tests (8/8 passing, incl. the sliding-window edge case):

```bash
cd contracts && forge test
```

## Deployed (Arc Testnet, chain ID 5042002)

| | |
|---|---|
| SpendVault | [`0x5FB636AbB12A0E2d8F3ec5251dfaEbD4Faa87BfF`](https://testnet.arcscan.app/address/0x5FB636AbB12A0E2d8F3ec5251dfaEbD4Faa87BfF) |
| USDC (ERC-20 face, 6 decimals) | `0x3600000000000000000000000000000000000000` |
| Agent wallet | `0x5BeAE5cc14d9b1612F3c89c58248Ece9A28E30A6` |

## Repo map

```
contracts/src/SpendVault.sol   the policy vault (the heart)
contracts/test/                Foundry tests
agent.js                       spending agent (--rogue to go rogue)
riskbrain.js                   anomaly scorer → trips the breaker
server.js + public/            live demo dashboard
docs/                          build log, phase by phase (Turkish)
```

## Why Arc Network

USDC as the native gas token means the agent economy's unit of account *is*
the settlement asset — no token juggling, sub-second finality for
machine-speed payments, and Circle's compliance-first stack matches what
enterprises will demand before wiring real treasuries to autonomous agents.

---

*Built for the Build on Arc hackathon (Circle × Encode Club), Agentic Economy track. Testnet only — do not use these keys or this unaudited contract with real funds.*
