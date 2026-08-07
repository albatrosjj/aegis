# Aegis

A spend-control firewall for AI agents. Built on Arc for the Build on Arc hackathon, Agentic Economy track.

AI agents are starting to hold wallets and pay on their own. The hard part isn't spending, it's trusting an agent with real money. Hand an AI a raw private key and one bad decision can drain the whole treasury, with no way to reverse it. Aegis closes that gap.

The agent never holds the keys. Its funds sit in a policy vault that enforces spending rules onchain, and an offchain risk process watches every spend and freezes the vault the moment something looks abnormal.

## Live demo

Dashboard: https://missed-translator-larry-resorts.trycloudflare.com
Demo video: https://www.youtube.com/watch?v=BOU3xwBdrCw
Vault on ArcScan: https://testnet.arcscan.app/address/0x4Ed99ba89fAd4061484bAA53093bA2782ec07664

The dashboard is interactive. Action buttons are password-protected so the demo stays stable. Password: aegis2026

To run the red-team demo: click "Start risk brain", then "RED TEAM: send agent rogue". The agent makes normal spends, then spikes. The risk process catches it and trips the circuit-breaker onchain. Every spend after that is blocked.

## How it works

The agent cannot sign transfers directly. It requests a spend, and the vault decides.

Layer 1, onchain policy vault. Enforces four rules that cannot be bypassed: a per-transaction cap, a rolling 24-hour daily limit, an allowlist of approved recipients, and a circuit-breaker that freezes all spending. The owner sets policy and is the only address that can reopen a paused vault. The agent can request a spend and can trigger the pause, but only a human can lift it.

Layer 2, offchain risk process. Reads every spend event, learns the agent's normal pattern, and trips the onchain circuit-breaker when a payment is many times larger than the recent average, or when velocity spikes.

The two layers cover each other. The onchain limits set a hard ceiling. The risk process catches abnormal behavior under those limits.

## Proof it works

A rogue agent, caught live on Arc testnet: it starts with small spends (average near 0.28 USDC), then tries to spend 3.41 USDC, roughly ten times its average. The risk process catches it and pulls the circuit-breaker onchain in seconds. Every spend after that reverts with VaultPaused, and the agent stops.

Real pause transaction: https://testnet.arcscan.app/tx/0x6fbc0e537f470836f6c64e74330189a00435bb0cacf56422936ddd4afca6b1cd

Contract tests pass 8/8.

## Run it locally

Requires Node.js 20+.

git clone https://github.com/albatrosjj/aegis.git
cd aegis
npm install

Create a .env file with PRIVATE_KEY, AGENT_PRIVATE_KEY, AGENT_ADDRESS, RECIPIENT_ADDRESS, and VAULT_ADDRESS. Then run: npm run status, npm run brain, npm run rogue, npm run dashboard.

## Built on Arc

USDC is the native gas token, so spend and fees are dollar-denominated and predictable, which matters when the payer is a machine. Sub-second finality lets a spend be checked and settled fast enough for the breaker to matter.

Network: Arc Testnet, Chain ID 5042002, explorer https://testnet.arcscan.app
Deployed vault: 0x4Ed99ba89fAd4061484bAA53093bA2782ec07664

## Stack

Solidity (Foundry), Node.js, ethers.js, Express, Arc testnet
