const { ethers } = require("ethers");

const RPC = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;
const USDC = "0x3600000000000000000000000000000000000000";
const VAULT_ADDRESS = "0x5FB636AbB12A0E2d8F3ec5251dfaEbD4Faa87BfF";

const VAULT_ABI = [
  "function paused() view returns (bool)",
  "function maxPerTx() view returns (uint256)",
  "function dailyLimit() view returns (uint256)",
  "function spentLast24h() view returns (uint256)",
  "function agent() view returns (address)",
  "function owner() view returns (address)",
  "function allowlist(address) view returns (bool)",
];
const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

const usdcFmt = (v) => (Number(v) / 1e6).toFixed(2) + " USDC";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });

  const code = await provider.getCode(VAULT_ADDRESS);
  console.log(`Vault address: ${VAULT_ADDRESS}`);
  console.log(`Bytecode present: ${code !== "0x"} (length ${code.length})`);
  if (code === "0x") {
    console.log("NO CONTRACT DEPLOYED AT THIS ADDRESS ON THIS RPC/CHAIN.");
    return;
  }

  const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);
  const usdc = new ethers.Contract(USDC, ERC20_ABI, provider);

  const results = {};
  for (const [key, fn] of Object.entries({
    paused: () => vault.paused(),
    maxPerTx: () => vault.maxPerTx(),
    dailyLimit: () => vault.dailyLimit(),
    spentLast24h: () => vault.spentLast24h(),
    agent: () => vault.agent(),
    owner: () => vault.owner(),
    balance: () => usdc.balanceOf(VAULT_ADDRESS),
  })) {
    try {
      results[key] = await fn();
    } catch (e) {
      results[key] = `ERR: ${e.shortMessage || e.message}`;
    }
  }

  console.log(`Paused: ${results.paused}`);
  console.log(`maxPerTx: ${typeof results.maxPerTx === "bigint" ? usdcFmt(results.maxPerTx) : results.maxPerTx}`);
  console.log(`dailyLimit: ${typeof results.dailyLimit === "bigint" ? usdcFmt(results.dailyLimit) : results.dailyLimit}`);
  console.log(`spentLast24h: ${typeof results.spentLast24h === "bigint" ? usdcFmt(results.spentLast24h) : results.spentLast24h}`);
  console.log(`agent: ${results.agent}`);
  console.log(`owner: ${results.owner}`);
  console.log(`Vault USDC balance: ${typeof results.balance === "bigint" ? usdcFmt(results.balance) : results.balance}`);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
