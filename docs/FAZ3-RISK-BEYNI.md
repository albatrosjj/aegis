# Faz 3 — Ajan + Risk Beyni: Ne Yaptık, Neden Yaptık

Bu faz Aegis'in hikayesini tamamlıyor: **harcayan bir AI ajanı** ve onu izleyip
anomalide zincir üstü acil durdurmayı çeken **zincir dışı risk beyni**.

## Özet — canlıda kanıtlanan senaryo

1. Ajan normal modda küçük ödemeler yaptı (0.11 / 0.16 / 0.19 USDC) → risk skoru 0.
2. Ajan "çıldırdı" (`--rogue`): 4.22 USDC harcadı — ortalamanın **27.8 katı**.
3. Risk beyni sıçramayı yakaladı (skor 120 ≥ 100) → `pause()` çekti.
   Breaker tx: `0xa0c25f9342bb8ec4f10e1d84a611ce556b248c96c25a9c7a8fb66c1d7ef04d8f`
4. Ajanın bir sonraki harcaması zincir üstünde `VaultPaused` ile **bloklandı**; ajan durdu.
5. Kasayı sadece owner (insan) geri açabildi (`unpause`).

Bu, final demodaki "red team düğmesi" anının ta kendisi.

## Roller ve anahtarlar

| Kim | Anahtar | Yetkisi |
|---|---|---|
| Owner (insan) | `.env → PRIVATE_KEY` | limitler, allowlist, unpause, para çekme |
| Ajan (AI) | `.env → AGENT_PRIVATE_KEY` (yeni cüzdan `0x5BeAE...30A6`) | sadece `spend()` + `pause()` |
| Risk beyni | owner anahtarı kullanıyor | izler + `pause()` çeker |

Ajan cüzdanına gas için 2 USDC gönderildi (Arc'ta gas = USDC). Kasa `setAgent`
ile yeni ajanı tanıdı — ajan artık deployer değil, **parasız ayrı bir kimlik**:
çalınsa bile saldırgan en fazla limitler dahilinde, allowlist'e harcayabilir.

## agent.js
- Sonsuz döngü: rastgele tutarlı ödeme → `vault.spend(to, amount)`.
- Normal mod: 0.1–0.3 USDC / ~8 sn. `--rogue`: 3–5 USDC / ~2 sn.
- Revert'leri yakalar, `paused` görünce durur.
- Arc dersleri: `staticNetwork` + `pollingInterval: 8000` + `unhandledRejection`
  yakalama — RPC "request limit reached" hıçkırıkları ajanı düşürmez (ilk canlı
  testte düşürmüştü, bu yüzden eklendi).

## riskbrain.js
- 10 saniyede bir yeni blokları yoklar, kasanın `Spent` olaylarını okur
  (`queryFilter` — event subscription her RPC'de yok, polling en sağlamı).
- İki sinyal skorlanır:
  - **Hız:** son 60 sn'de `MAX_TX_PER_MIN`'den (10) fazla işlem → +60
  - **Sıçrama:** tutar, geçmiş ortalamanın `SPIKE_FACTOR` (5) katından büyük → +120
    (tek başına tetikler; büyük sıçrama en net tehlike işareti)
- Skor ≥ 100 → `pause()` çekilir, breaker tx hash'i loglanır.

## Neden bu mimari ikna edici
- **Savunma iki katmanlı:** sert limitler zincir üstünde (aşılamaz), davranışsal
  zeka zincir dışında (esnek). Risk beyni çökse bile limitler ayakta.
- **Asimetrik yetki:** alarm herkesin (agent da pause çekebilir), geri açmak
  sadece insanın. Yanlış alarmın maliyeti düşük, kaçan anomalinin maliyeti yüksek.

## Çalıştırma
```bash
node riskbrain.js          # 1. terminal: beyin izlemede
node agent.js              # 2. terminal: normal ajan
node agent.js --rogue      # çıldırt → breaker'ın çekilişini izle
cast send $VAULT_ADDRESS "unpause()" ...   # insan onayıyla geri aç
```

## Sıradaki (Faz 4)
- Canlı dashboard: harcama akışı, limit dolulukları, breaker durumu.
- "Red team" düğmesi: rogue modu dashboard'dan tetikle.
