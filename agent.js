// agent.js — Kasadan harcayan AI ajanı simülasyonu.
// Normal mod: birkaç saniyede bir küçük ödeme (nanopayment tarzı).
// --rogue: ajan "çıldırır" → hızlı ve büyük harcamaya çalışır.
// Önemli: ajan kasanın parasını tutmaz; sadece spend() çağırabilir.
// Sert limitler zincir üstünde, risk beyni de dışarıdan izliyor.
require("dotenv").config();
const { ethers } = require("ethers");

const RPC = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;

const VAULT_ABI = [
  "function spend(address to, uint256 amount)",
  "function spentLast24h() view returns (uint256)",
  "function paused() view returns (bool)",
];

const ROGUE = process.argv.includes("--rogue");

async function main() {
  // pollingInterval yüksek: Arc RPC "request limit reached" vermesin
  const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true, pollingInterval: 8000 });
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);
  const vault = new ethers.Contract(process.env.VAULT_ADDRESS, VAULT_ABI, wallet);
  const to = process.env.RECIPIENT_ADDRESS;

  console.log(`🤖 Ajan: ${wallet.address}`);
  console.log(`   Kasa: ${process.env.VAULT_ADDRESS}`);
  console.log(`   Mod: ${ROGUE ? "🔴 ROGUE (çıldırmış)" : "🟢 normal"}`);

  // normal: 0.1–0.3 USDC / ~8sn — rogue: 3–5 USDC / ~2sn
  const intervalMs = ROGUE ? 2000 : 8000;
  const randAmount = () =>
    ROGUE
      ? BigInt(3_000_000 + Math.floor(Math.random() * 2_000_000))
      : BigInt(100_000 + Math.floor(Math.random() * 200_000));

  while (true) {
    const amount = randAmount();
    const pretty = (Number(amount) / 1e6).toFixed(2);
    try {
      const tx = await vault.spend(to, amount, {
        maxFeePerGas: ethers.parseUnits("20", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("20", "gwei"),
      });
      await tx.wait();
      const spent = await vault.spentLast24h();
      console.log(`✅ ${pretty} USDC harcandı | son 24s: ${(Number(spent) / 1e6).toFixed(2)} USDC | ${tx.hash}`);
    } catch (err) {
      const reason = err.shortMessage || err.message;
      // Gerçek firewall bloğu (revert) ile geçici RPC hatasını ayır
      if (err.code === "CALL_EXCEPTION" || reason.includes("revert"))
        console.log(`⛔ ${pretty} USDC BLOKLANDI → ${reason.slice(0, 120)}`);
      else console.log(`(rpc hatası, tekrar denenecek: ${reason.slice(0, 80)})`);
      if (await vault.paused()) {
        console.log("🚨 Kasa acil durdurmada (circuit-breaker açık). Ajan duruyor.");
        break;
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// RPC hıçkırıkları (rate limit vb.) ajanı düşürmesin
process.on("unhandledRejection", (e) => console.log(`(rpc hatası, devam: ${(e.shortMessage || e.message || e).toString().slice(0, 80)})`));

main().catch(console.error);
