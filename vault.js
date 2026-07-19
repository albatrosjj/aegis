// vault.js — kasa için owner (insan) kumandası.
// Kullanım: node vault.js status | pause | unpause
require("dotenv").config();
const { ethers } = require("ethers");

const RPC = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;
const USDC = "0x3600000000000000000000000000000000000000";

const VAULT_ABI = [
  "function paused() view returns (bool)",
  "function maxPerTx() view returns (uint256)",
  "function dailyLimit() view returns (uint256)",
  "function spentLast24h() view returns (uint256)",
  "function agent() view returns (address)",
  "function pause()",
  "function unpause()",
];
const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

const usdcFmt = (v) => (Number(v) / 1e6).toFixed(2) + " USDC";
const gas = {
  maxFeePerGas: ethers.parseUnits("20", "gwei"),
  maxPriorityFeePerGas: ethers.parseUnits("20", "gwei"),
};

async function main() {
  const cmd = process.argv[2] || "status";
  const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true, pollingInterval: 8000, batchMaxCount: 1 });
  const owner = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const vault = new ethers.Contract(process.env.VAULT_ADDRESS, VAULT_ABI, owner);
  const usdc = new ethers.Contract(USDC, ERC20_ABI, provider);

  if (cmd === "status") {
    const [paused, maxPerTx, dailyLimit, spent, agent, balance] = await Promise.all([
      vault.paused(), vault.maxPerTx(), vault.dailyLimit(),
      vault.spentLast24h(), vault.agent(), usdc.balanceOf(process.env.VAULT_ADDRESS),
    ]);
    console.log(`🏦 Kasa: ${process.env.VAULT_ADDRESS}`);
    console.log(`   Durum:        ${paused ? "🔴 DURDURULMUŞ (paused)" : "🟢 açık"}`);
    console.log(`   Bakiye:       ${usdcFmt(balance)}`);
    console.log(`   İşlem limiti: ${usdcFmt(maxPerTx)}`);
    console.log(`   Günlük limit: ${usdcFmt(spent)} / ${usdcFmt(dailyLimit)} (kayan 24s)`);
    console.log(`   Ajan:         ${agent}`);
  } else if (cmd === "unpause") {
    const tx = await vault.unpause(gas);
    await tx.wait();
    console.log(`🟢 Kasa yeniden açıldı. tx: ${tx.hash}`);
  } else if (cmd === "pause") {
    const tx = await vault.pause(gas);
    await tx.wait();
    console.log(`🔴 Kasa durduruldu. tx: ${tx.hash}`);
  } else {
    console.log("Kullanım: node vault.js status | pause | unpause");
  }
}

main().catch((e) => console.error(e.shortMessage || e.message));
