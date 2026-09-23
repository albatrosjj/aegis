// riskbrain.js — Zincir dışı risk beyni.
// Kasanın Spent olaylarını izler, davranışı skorlar; anomali görünce
// zincir üstündeki acil durdurmayı (pause) tetikler.
// Sinyaller:
//  - HIZ: son 60 saniyedeki işlem sayısı
//  - SIÇRAMA: tutar, önceki harcamaların hareketli ortalamasının kaç katı
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");

const MAX_REJECTS_PER_MIN = 4;
const REJECT_LOG = process.env.REJECT_LOG || ".rejections.jsonl";

// Reddedilen denemeler zincire olay yazmaz (revert eden islem log birakmaz),
// bu yuzden ajan onlari dosyaya yazar, beyin buradan okur.
function sonDakikadakiRedler() {
  try {
    const t = Date.now();
    return fs.readFileSync(REJECT_LOG, "utf8").trim().split("\n")
      .filter(Boolean)
      .map((satir) => { try { return JSON.parse(satir); } catch { return null; } })
      .filter((r) => r && t - r.t < 60_000);
  } catch { return []; }
}


const RPC = process.env.RPC_URL || "https://rpc.testnet.arc.network";
const CHAIN_ID = Number(process.env.CHAIN_ID || 5042002);

const VAULT_ABI = [
  "event Spent(address indexed to, uint256 amount)",
  "function pause()",
  "function paused() view returns (bool)",
];

// Eşikler (demo için agresif ayarlı)
const MAX_TX_PER_MIN = 5;   // dakikada 10+ işlem → anomali
const SPIKE_FACTOR = 3;      // ortalamanın 5 katı tutar → anomali
const SCORE_LIMIT = 80;     // skor bunu aşınca breaker çekilir

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true, pollingInterval: 8000 });
  // pause() hem owner hem agent anahtarıyla çağrılabilir; beyin owner anahtarını kullanıyor
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const vault = new ethers.Contract(process.env.VAULT_ADDRESS, VAULT_ABI, wallet);

  console.log(`🧠 Risk brain watching — vault: ${process.env.VAULT_ADDRESS}`);

  const history = []; // { time, amount(USDC float) }
  let tripped = false;

  async function tripBreaker(reason) {
    if (tripped) return;
    tripped = true;
    console.log(`\n🚨🚨 ANOMALY: ${reason}`);
    console.log("🔌 Pulling the circuit-breaker (pause)...");

    let tx;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        tx = await vault.pause({
          maxFeePerGas: ethers.parseUnits("20", "gwei"),
          maxPriorityFeePerGas: ethers.parseUnits("20", "gwei"),
        });
        break;
      } catch (err) {
        const reason = err.shortMessage || err.message || "";
        if (attempt < 3 && reason.includes("could not coalesce")) {
          console.log(`(rpc error sending pause, retrying ${attempt}/3: ${reason.slice(0, 80)})`);
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        throw err;
      }
    }

    try {
      await tx.wait();
      console.log(`✅ Vault paused. tx: ${tx.hash}`);
    } catch (err) {
      const reason = err.shortMessage || err.message || "";
      console.log(`(rpc error waiting for pause confirmation: ${reason.slice(0, 80)})`);
      if (await vault.paused()) console.log(`✅ Vault paused (confirmed on-chain). tx: ${tx.hash}`);
    }
    process.exit(0);
  }

  // Filtre RPC'leri her node'da olmayabilir → blokları poll edip queryFilter kullan
  let lastBlock = await provider.getBlockNumber();
  setInterval(async () => {
    try {
      const redler = sonDakikadakiRedler();
      if (redler.length >= MAX_REJECTS_PER_MIN) {
        const toplam = redler.reduce((s, r) => s + r.amount, 0).toFixed(2);
        console.log(`👁  ${redler.length} rejected attempt(s) in the last minute (${toplam} USDC requested)`);
        await tripBreaker(`${redler.length} rejected spend attempts in 60s, totalling ${toplam} USDC`);
        return;
      }

      const now = await provider.getBlockNumber();
      if (now <= lastBlock) return;
      const events = await vault.queryFilter(vault.filters.Spent(), lastBlock + 1, now);
      lastBlock = now;

      for (const ev of events) {
        const amount = Number(ev.args.amount) / 1e6;
        const t = Date.now();

        const recent = history.filter((h) => t - h.time < 60_000);
        const avg = history.length
          ? history.reduce((s, h) => s + h.amount, 0) / history.length
          : amount;

        let score = 0;
        const reasons = [];
        if (recent.length + 1 > MAX_TX_PER_MIN) {
          score += 60;
          reasons.push(`velocity: ${recent.length + 1} tx/min`);
        }
        if (history.length >= 2 && amount > avg * SPIKE_FACTOR) {
          score += 120; // tek başına breaker'ı tetikler — büyük sıçrama en net tehlike işareti
          reasons.push(`spike: ${amount.toFixed(2)} USDC (${(amount / avg).toFixed(1)}x the ${avg.toFixed(2)} average)`);
        }

        history.push({ time: t, amount });
        console.log(`👁  ${amount.toFixed(2)} USDC → ${ev.args.to.slice(0, 10)}… | risk score: ${score}`);
        if (score >= SCORE_LIMIT) await tripBreaker(reasons.join(" + "));
      }
    } catch (err) {
      console.log(`(monitoring error, continuing: ${(err.shortMessage || err.message).slice(0, 80)})`);
    }
  }, 5000); // 5 sn'de bir yokla — RPC rate limitine takılma
}

main().catch(console.error);
