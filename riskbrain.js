// riskbrain.js — Zincir dışı risk beyni.
// Kasanın Spent olaylarını izler, davranışı skorlar; anomali görünce
// zincir üstündeki acil durdurmayı (pause) tetikler.
// Sinyaller:
//  - HIZ: son 60 saniyedeki işlem sayısı
//  - SIÇRAMA: tutar, önceki harcamaların hareketli ortalamasının kaç katı
require("dotenv").config();
const { ethers } = require("ethers");

const RPC = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;

const VAULT_ABI = [
  "event Spent(address indexed to, uint256 amount)",
  "function pause()",
  "function paused() view returns (bool)",
];

// Eşikler (demo için agresif ayarlı)
const MAX_TX_PER_MIN = 10;   // dakikada 10+ işlem → anomali
const SPIKE_FACTOR = 5;      // ortalamanın 5 katı tutar → anomali
const SCORE_LIMIT = 100;     // skor bunu aşınca breaker çekilir

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true, pollingInterval: 8000 });
  // pause() hem owner hem agent anahtarıyla çağrılabilir; beyin owner anahtarını kullanıyor
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const vault = new ethers.Contract(process.env.VAULT_ADDRESS, VAULT_ABI, wallet);

  console.log(`🧠 Risk beyni izlemede — kasa: ${process.env.VAULT_ADDRESS}`);

  const history = []; // { time, amount(USDC float) }
  let tripped = false;

  async function tripBreaker(reason) {
    if (tripped) return;
    tripped = true;
    console.log(`\n🚨🚨 ANOMALİ: ${reason}`);
    console.log("🔌 Acil durdurma çekiliyor (pause)...");
    const tx = await vault.pause({
      maxFeePerGas: ethers.parseUnits("20", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("20", "gwei"),
    });
    await tx.wait();
    console.log(`✅ Kasa durduruldu. tx: ${tx.hash}`);
    process.exit(0);
  }

  // Filtre RPC'leri her node'da olmayabilir → blokları poll edip queryFilter kullan
  let lastBlock = await provider.getBlockNumber();
  setInterval(async () => {
    try {
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
          reasons.push(`hız: ${recent.length + 1} işlem/dk`);
        }
        if (history.length >= 2 && amount > avg * SPIKE_FACTOR) {
          score += 120; // tek başına breaker'ı tetikler — büyük sıçrama en net tehlike işareti
          reasons.push(`sıçrama: ${amount.toFixed(2)} USDC (ortalama ${avg.toFixed(2)}'nin ${(amount / avg).toFixed(1)} katı)`);
        }

        history.push({ time: t, amount });
        console.log(`👁  ${amount.toFixed(2)} USDC → ${ev.args.to.slice(0, 10)}… | risk skoru: ${score}`);
        if (score >= SCORE_LIMIT) await tripBreaker(reasons.join(" + "));
      }
    } catch (err) {
      console.log(`(izleme hatası, devam: ${(err.shortMessage || err.message).slice(0, 80)})`);
    }
  }, 10000); // 10 sn'de bir yokla — RPC rate limitine takılma
}

main().catch(console.error);
