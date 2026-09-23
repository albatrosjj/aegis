// agent.js — Kasadan harcayan AI ajanı simülasyonu.
// Normal mod: birkaç saniyede bir küçük ödeme (nanopayment tarzı).
// --rogue: ajan "çıldırır" → hızlı ve büyük harcamaya çalışır.
// Önemli: ajan kasanın parasını tutmaz; sadece spend() çağırabilir.
// Sert limitler zincir üstünde, risk beyni de dışarıdan izliyor.
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const REJECT_LOG = process.env.REJECT_LOG || ".rejections.jsonl";
function kaydetRed(amount) {
  try { fs.appendFileSync(REJECT_LOG, JSON.stringify({ t: Date.now(), amount }) + "\n"); }
  catch (e) {}
}

const RPC = process.env.RPC_URL || "https://rpc.testnet.arc.network";
const CHAIN_ID = Number(process.env.CHAIN_ID || 5042002);

const VAULT_ABI = [
  "function spend(address to, uint256 amount)",
  "function spentLast24h() view returns (uint256)",
  "function paused() view returns (bool)",
  "function maxPerTx() view returns (uint256)",
  "error NotOwner()",
  "error NotAgent()",
  "error VaultPaused()",
  "error NotAllowlisted(address to)",
  "error ExceedsPerTxLimit(uint256 amount, uint256 maxPerTx)",
  "error ExceedsDailyLimit(uint256 attempted, uint256 dailyLimit)",
];

const ROGUE = process.argv.includes("--rogue");

// Custom error selector'ını okunur mesaja çevirir; çözemezse ham veriyi döner.
function decodeRevert(err, iface) {
  const data = err.data ?? err.info?.error?.data ?? err.error?.data;
  if (!data) return err.shortMessage || err.message;
  try {
    const parsed = iface.parseError(data);
    if (!parsed) return err.shortMessage || err.message;
    const args = parsed.args
      .filter((_, i) => Number.isNaN(Number(i)) === false && i < parsed.fragment.inputs.length)
      .map((a) => (typeof a === "bigint" ? (Number(a) / 1e6).toFixed(2) + " USDC" : a))
      .join(", ");
    return args ? `${parsed.name}(${args})` : `${parsed.name}()`;
  } catch {
    return err.shortMessage || err.message;
  }
}

async function main() {
  // pollingInterval yüksek: Arc RPC "request limit reached" vermesin
  const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true, pollingInterval: 8000 });
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);
  const vault = new ethers.Contract(process.env.VAULT_ADDRESS, VAULT_ABI, wallet);
  const to = process.env.RECIPIENT_ADDRESS;

  console.log(`🤖 Agent: ${wallet.address}`);
  console.log(`   Vault: ${process.env.VAULT_ADDRESS}`);
  console.log(`   Mode: ${ROGUE ? "🔴 ROGUE (gone rogue)" : "🟢 normal"}`);

  // normal mod: 0.1–0.3 USDC / ~8sn
  // rogue mod: önce 4-5 küçük (0.2-0.4 USDC) harcama yapıp bir "ortalama" oluşturur,
  // sonra TEK bir sıçrama harcaması dener — ortalamanın 5 katından fazla ama
  // maxPerTx (5 USDC) altında (~3-4 USDC) — böylece işlem GEÇER, Spent yayınlanır
  // ve risk beyni sıçramayı görüp breaker'ı çeker. Sonrasında ajan eski davranışına
  // (büyük/hızlı harcama denemeleri) döner; bunlar artık VaultPaused ile revert eder.
  const intervalMs = ROGUE ? 2000 : 8000;
  const ROGUE_WARMUP_TX = 5;
  let rogueStep = 0;
  // Her calistirmada temiz baslasin, eski redler yeni turu tetiklemesin.
  try { fs.writeFileSync(REJECT_LOG, ""); } catch (e) {}
  // Tutarlar zincirdeki maxPerTx'e gore olceklenir; limit degisince senaryo bozulmaz.
  const cap = Number(await vault.maxPerTx());
  const araliktaRastgele = (alt, ust) => BigInt(Math.floor(alt + Math.random() * (ust - alt)));
  const randAmount = () => {
    if (!ROGUE) return araliktaRastgele(cap * 0.10, cap * 0.35);
    rogueStep++;
    if (rogueStep <= ROGUE_WARMUP_TX) return araliktaRastgele(cap * 0.10, cap * 0.20);
    if (rogueStep === ROGUE_WARMUP_TX + 1) return araliktaRastgele(cap * 0.80, cap * 0.95);
    return araliktaRastgele(cap * 1.5, cap * 3.0);
  };

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
      console.log(`✅ ${pretty} USDC spent | last 24h: ${(Number(spent) / 1e6).toFixed(2)} USDC | ${tx.hash}`);
    } catch (err) {
      const reason = err.shortMessage || err.message;
      // Gerçek firewall bloğu (revert) ile geçici RPC hatasını ayır
      if (err.code === "CALL_EXCEPTION" || reason.includes("revert"))
        { console.log(`⛔ ${pretty} USDC BLOCKED → ${decodeRevert(err, vault.interface)}`); kaydetRed(Number(amount) / 1e6); }
      else console.log(`(rpc error, will retry: ${reason.slice(0, 80)})`);
      if (await vault.paused()) {
        console.log("🚨 Vault in circuit-breaker (paused). Agent stopping.");
        break;
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// RPC hıçkırıkları (rate limit vb.) ajanı düşürmesin
process.on("unhandledRejection", (e) => console.log(`(rpc error, continuing: ${(e.shortMessage || e.message || e).toString().slice(0, 80)})`));

main().catch(console.error);
