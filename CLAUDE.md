# CLAUDE.md — Aegis Projesi Bağlam & Yol Haritası

> Bu dosya projenin kökünde durur ve Claude Code tarafından otomatik okunur.
> Amaç: terminaldeki Claude'un projeyi, hackathon'u ve şu ana kadar verilen kararları
> sıfırdan öğrenmeden tam bağlamla devam edebilmesi.

---

## 1. Proje: Aegis

**Tek cümle:** Aegis, Arc Network üzerine kurulu, AI ajanları için bir *harcama güvenlik duvarı* (spend-control firewall) — programlanabilir bütçeler, işlem/gün limitleri, izinli adres listesi ve anomali durumunda devreye giren bir "acil durdurma" (circuit-breaker), hepsi USDC cinsinden.

**Problem:** AI ajanları cüzdan tutup otonom ödeme yapmaya başladıkça asıl zorluk "harcamak" değil, onlara gerçek parayı **güvenle emanet etmek**. Kimse bir ajana ham cüzdan anahtarını vermek istemez.

**Çözüm mimarisi:**
- Ajan ham anahtarı **asla** tutmaz.
- Para, Arc üzerinde bir **on-chain policy vault** (kasa kontratı) içinde durur.
- Kasa, aşılamaz **sert limitleri zincir üstünde** uygular: işlem-başı limit, günlük limit (kayan 24s pencere), izinli adres listesi, acil durdurma (pause) bayrağı.
- Yanında **zincir dışı bir "risk beyni"** harcama davranışını gerçek zamanlı skorlar; anormallik görürse kasadaki acil durdurmayı tetikler.

**Benzetme:** Ramp/Brex kurumsal kartlarına + fraud kontrollerine ne yapıyorsa, Aegis onu **ajan ekonomisi** için yapıyor.

**Akış:**
```
AI ajanı → Harcama firewall (politika kontrolü) → Policy Vault (Arc, USDC + sert limitler) → Servis/diğer ajan
                    ↑
        Risk beyni (zincir dışı, anomali skoru → acil durdurmayı tetikler)
```

**Track:** Agentic Economy (opsiyonel olarak DeFi'ye de girilebilir — ödeme/altyapı yönü uyar).

---

## 2. Hackathon: Build on Arc (Circle, Encode Club üzerinden)

Arc = Circle'ın stablecoin-native L1 zinciri. USDC gas token'ı, sub-second kesinlik, Circle geliştirici platformu gömülü. 4 haftalık online hackathon.

**Jüri neyi ödüllendiriyor:** Karmaşıklıktan çok **yürütme kalitesi**; gerçek kullanım + üretime giden yol. Circle regüle bir fintech → **kontrol / uyum / güven** hikayesi güçlü rezonans yapar. Aegis tam bu çizgide.

### Önemli tarihler (deadline'lar "Anywhere on Earth" / UTC-12)
- **Launch:** 13 Temmuz
- **Checkpoint 1 — 19 Temmuz:** proje oluştur + ekip ekle + fikir paylaş (placeholder yeterli). → *Yapıldı (proje + fikir girildi).*
- **Checkpoint 2 — 26 Temmuz:** repo linki + ilerleme özeti (work-in-progress kabul).
- **Kayıt kapanışı:** 8 Ağustos
- **Checkpoint 3 / FINAL — 9 Ağustos:** Arc'a deploy edilmiş çalışan MVP + public kod reposu (private ise jüriyi ekle) + 3 dakikalık video pitch & demo + deck. **Bu teslim eksiksiz olmalı; her link public ve çalışır.**
- **Demo Day:** 20 Ağustos

**Ödül:** İlk 8 takım → 8 haftalık akselerator programı.

---

## 3. Arc teknik bilgi kartı (deneyle doğrulandı, KORU)

- **Ağ:** Arc Testnet
- **RPC:** `https://rpc.testnet.arc.network`
- **Chain ID:** `5042002`
- **Native token:** USDC. **İki yüzü var:** native gas token olarak **18 decimal**; `0x3600000000000000000000000000000000000000` adresindeki **ERC-20 arayüzü olarak 6 decimal** (ikisi aynı bakiye). **Transferler için dokümantasyon ERC-20 arayüzünü öneriyor → 6 decimal kullan.**
- **Gas:** USDC ile ödenir. `maxFeePerGas` = **20 Gwei** (docs önerisi; altındaki işlemler beklemede kalabiliyor). Foundry'de: `--gas-price 20gwei --priority-gas-price 20gwei`.
- **Explorer:** `https://testnet.arcscan.app` (işlem: `/tx/0x...`)
- **Faucet:** `https://faucet.circle.com` → "Arc Testnet" seç → adres başına her 2 saatte 20 USDC.
- **Docs:** `docs.arc.network` (ayrıca `docs.arc.io`)
- **ethers.js ipucu:** Arc RPC, ethers'ın JSON-RPC batch isteklerini sevmiyor ("missing revert data") → provider'da `batchMaxCount: 1` ver. Ayrıca `staticNetwork` kullan → her istekte chain ID sormaz → "request limit reached" rate-limit hatasını azaltır. (Bu ders send.js'te öğrenildi.)

---

## 4. Şu anki durum

**Klasör:** `/home/albatros/arc-usdc-sender`

**Faz 1 — TAMAM ✅ (boru hattı kanıtlandı):** Çalışan USDC gönderici script (`send.js`).
- Başarılı gönderim: 1 USDC. Örnek tx: `0x6aae31302144476f37c3cd9dc748f553140edf004e38859a57933736f6bb7bd0`

**Faz 2 — TAMAM ✅ (19 Temmuz): Policy Vault deploy edildi ve canlı doğrulandı.**
- **SpendVault adresi (Arc Testnet):** `0x5FB636AbB12A0E2d8F3ec5251dfaEbD4Faa87BfF`
- Deploy tx: `0x129c8092e76123d7317503accfdbcb36e22ab494a610fbd9f72e0498a0bd3896`
- Owner = agent = deployer cüzdanı `0x202c92049E844Ce94e649541e462B720c09f4296` (Faz 3'te ayrı ajan cüzdanı).
- Limitler: `maxPerTx` 5 USDC, `dailyLimit` 20 USDC (kayan 24s). Kasada ~9 USDC.
- Birim testler 8/8 ✅. Canlı: 1 USDC `spend` geçti; 6 USDC `ExceedsPerTxLimit` ile revert etti ✅.
- Ayrıntılı anlatım: `docs/FAZ2-SPENDVAULT.md`.

**Faz 3 — TAMAM ✅ (19 Temmuz): Ajan + risk beyni canlıda kanıtlandı.**
- Ayrı ajan cüzdanı: `0x5BeAE5cc14d9b1612F3c89c58248Ece9A28E30A6` (`setAgent` yapıldı, 2 USDC gas fonu).
- `agent.js`: kasadan tekrarlı ödemeler; `--rogue` bayrağı ajanı çıldırtır.
- `riskbrain.js`: Spent olaylarını izler; hız + sıçrama skorlar; skor ≥ 100 → `pause()`.
- **Canlı senaryo:** normal harcamalar (skor 0) → rogue 4.22 USDC (ortalamanın 27.8 katı, skor 120) → beyin breaker'ı çekti (tx `0xa0c25f93...ef04d8f`) → sonraki harcama `VaultPaused` revert → owner `unpause` etti.
- Arc dersi: agent/riskbrain'de `pollingInterval: 8000` + hata yakalama, yoksa RPC "request limit reached" scriptleri düşürüyor.
- Ayrıntı: `docs/FAZ3-RISK-BEYNI.md`.

**Faz 4 — TAMAM ✅ (19 Temmuz): Dashboard + red-team düğmesi.**
- `npm run dashboard` → `server.js` (express, port 3000) + `public/index.html`.
- Zinciri sadece server yoklar (8sn, `batchMaxCount:1`); ajan/beyin düğmeden spawn edilir; loglar + zincir olayları canlı akar; RED TEAM düğmesi rogue ajanı başlatır; unpause düğmesi owner anahtarıyla.
- Uçtan uca doğrulandı. Ayrıntı: `docs/FAZ4-DASHBOARD.md`.
- Kalan (stretch): opt-in privacy, doğal dilde politika.

**Faz 5 — BAŞLADI (19 Temmuz): teslim materyalleri.**
- İngilizce jüri-README ✅, `.env.example` ✅, video senaryosu + 8 slaytlık deck içeriği ✅ (`docs/FAZ5-VIDEO-VE-DECK.md`).
- Kalan: video kaydı (kullanıcı), deck'in görsel üretimi, hackathon paneline teslim.

**Mevcut yapı:**
- `send.js`, `package.json`, `.env` (GİZLİ), `.gitignore` — Faz 1.
- `contracts/` — Foundry projesi: `src/SpendVault.sol`, `test/SpendVault.t.sol`.
- `docs/FAZ2-SPENDVAULT.md` — Faz 2'nin adım adım açıklaması.
- Git deposu başlatıldı (branch `main`). **GitHub remote henüz yok** → Checkpoint 2 için push gerekli.

---

## 5. Marka kuralları (public materyaller için — ZORUNLU)

Kod için geçerli değil; sadece deck, video, sosyal medya, UI metni gibi dışa yayınlanan şeyler için.
- **Senin markan önde, Arc altyapı.** Kullan: "built on Arc", "available on Arc", "supports Arc".
- **Kaçın:** "Arc by [şirket]", "The Arc App", "Arc Payments", onay/endorsement ima eden dil.
- İlk anımda **"Arc Network"**, sonra **"Arc"**.
- Logo: sadece resmî Circle Brand Kit dosyaları; değiştirme/renklendirme/bozma yok; kendi Aegis logondan büyük gösterme.

---

## 6. YOL HARİTASI

### Faz 1 — USDC gönderici ✅ TAMAM
### Faz 2 — Policy Vault kontratı ✅ TAMAM (bkz. §4)

### Faz 3 — Risk beyni + ajan ✅ TAMAM (bkz. §4)
- (Nice-to-have, açık) Doğal dilde politika: "günde max $50, sadece şu 3 adres" → on-chain config'e çevir.

### Faz 4 — Demo dashboard + cila ✅ TAMAM (bkz. §4)
- (Stretch, açık) Hassas tutarlar için opt-in privacy.

### Faz 5 — Teslim materyalleri (9 Ağustos'a kadar)
- Arc'a deploy edilmiş çalışan MVP ✓
- Public GitHub reposu (private ise jüriyi ekle)
- 3 dakikalık video: pitch + canlı demo (red-team blok anını göster)
- Deck (marka uyumlu: kendi logon önde, "Built on Arc Network")

### Checkpoint eşlemesi
- **Checkpoint 2 (26 Tem):** repo linki + ilerleme → kasa çalışıyor ✅; kalan: repo'yu GitHub'a push et.
- **Final (9 Ağu):** Faz 3–5 tamam.

---

## 7. Çalışma tarzı notları
- Küçük parçalar hâlinde ilerle; her parçayı çalıştırıp doğrula, sonra devam et.
- Güvenlik: `.env` asla commit edilmez; özel anahtar tek kullanımlık test cüzdanınındır, yerelde kalır.
- Testnet'te sahte parayla çalışıyoruz — deneme serbest, risk yok.
- Her adımda ne yapıldığını ve nedenini basit dille açıkla (kullanıcı vibe-coding ile öğreniyor); iş sonunda `docs/` altına doküman bırak.
