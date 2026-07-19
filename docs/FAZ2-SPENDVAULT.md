# Faz 2 — SpendVault: Ne Yaptık, Neden Yaptık

Bu doküman, Aegis'in kalbi olan on-chain harcama kasasının (SpendVault) nasıl
kurulduğunu adım adım, sade bir dille anlatır.

## Özet

- **Kontrat adresi (Arc Testnet):** `0x5FB636AbB12A0E2d8F3ec5251dfaEbD4Faa87BfF`
- **Deploy tx:** `0x129c8092e76123d7317503accfdbcb36e22ab494a610fbd9f72e0498a0bd3896`
- **Explorer:** https://testnet.arcscan.app/address/0x5FB636AbB12A0E2d8F3ec5251dfaEbD4Faa87BfF
- **Başlangıç limitleri:** işlem-başı 5 USDC, günlük 20 USDC
- **Kasa fonu:** 10 USDC (canlı testte 1 USDC harcandı → 9 USDC kaldı)
- Birim testler: **8/8 geçti** · Canlı testler: normal harcama geçti, limit aşımı revert etti ✅

## Adım adım ne yaptık

### 1. Git deposu (`git init`)
Kodun sürüm geçmişini tutmak ve Checkpoint 2 için GitHub'a koyabilmek adına
depo başlattık. `.gitignore` sayesinde `.env` (özel anahtar!) ve `node_modules`
asla commit'e girmez. İlk commit Faz 1'in gönderici scriptini içeriyor.

### 2. Foundry kurulumu
Foundry, Solidity dünyasının standart araç seti:
- `forge` → derleme, test, deploy
- `cast` → zincirle komut satırından konuşma (fonksiyon çağırma, bakiye okuma)

Kurulum: `curl -L https://foundry.paradigm.xyz | bash` → `foundryup`.
Kontrat projesi `contracts/` klasöründe (`forge init`).

### 3. `SpendVault.sol` — kuralların yaşadığı yer
Fikir basit: **ajan parayı tutmaz, kasa tutar.** Ajan sadece `spend(to, amount)`
çağırabilir ve kasa şu dört kuralı zincir üstünde uygular — yani hiçbir yazılım
hatası ya da "çıldıran ajan" bunları aşamaz:

| Kural | Kontratta | Ne yapar |
|---|---|---|
| İşlem-başı limit | `maxPerTx` | Tek seferde 5 USDC'den fazlası revert |
| Günlük limit | `dailyLimit` + `spentLast24h()` | Kayan 24 saatlik pencerede toplam 20 USDC üstü revert |
| İzinli adresler | `allowlist` | Listede olmayan alıcıya tek kuruş çıkmaz |
| Acil durdurma | `paused` | Açıkken her harcama bloklanır (circuit-breaker) |

Tasarım kararları:
- **İki rol:** `owner` (insan — kuralları koyar, parayı geri çekebilir) ve
  `agent` (AI — sadece harcayabilir). Risk beyni ajan anahtarıyla `pause()`
  çekebilir, ama `unpause()` sadece owner'da: alarm herkesin, geri açmak insanın.
- **Kayan 24s pencere:** her harcama `(zaman, tutar)` olarak kaydedilir;
  `spentLast24h()` son 24 saatin toplamını hesaplar. Sabit "gece yarısı sıfırlanan"
  limit yerine gerçek kayan pencere — limiti gece yarısında ikiye katlama hilesi yok.
- **Custom error'lar** (`ExceedsPerTxLimit(6e6, 5e6)` gibi): revert nedeni tutarlarla
  birlikte döner → dashboard'da "neden bloklandı"yı gösterebileceğiz.

### 4. Testler (`forge test`)
8 test: normal harcama geçer; yabancı çağıran, izinsiz alıcı, işlem-başı aşımı,
günlük aşım revert; 24 saat geçince pencere boşalır; pause her şeyi bloklar ve
sadece owner açar; owner parayı geri çekebilir.

**Testlerin yakaladığı gerçek bug:** `block.timestamp - 24 hours` zincirin/test
ortamının ilk 24 saatinde underflow yapıyordu → `_cutoff()` ile 0'a sabitledik.
Test yazmanın değeri tam olarak bu.

### 5. Deploy (Arc Testnet)
```
forge create src/SpendVault.sol:SpendVault \
  --rpc-url https://rpc.testnet.arc.network \
  --broadcast --gas-price 20gwei --priority-gas-price 20gwei \
  --constructor-args <USDC> <ajan-adresi> 5000000 20000000
```
- USDC adresi: `0x3600000000000000000000000000000000000000` (ERC-20 yüzü, 6 decimal
  → 5 USDC = `5000000`).
- Gas 20 Gwei: docs önerisi, altı beklemede kalabiliyor.
- Ajan adresi şimdilik deployer cüzdanı; Faz 3'te ayrı ajan cüzdanı olacak.

### 6. Fonlama + canlı test (`cast`)
1. Kasaya 10 USDC gönderdik (normal ERC-20 transfer).
2. Alıcıyı allowlist'e ekledik (`setAllowlist`).
3. `spend(alıcı, 1 USDC)` → **geçti** (tx: `0x0d2a6c15...aeff0b5d`).
4. `spend(alıcı, 6 USDC)` → **`ExceedsPerTxLimit(6000000, 5000000)` ile revert.**
   Firewall zincir üstünde canlı çalışıyor. 🎉

## Sıradaki (Faz 3)
- Ayrı bir ajan cüzdanı + `setAgent` ile devri.
- Node ajanı: görev yapar, kasadan tekrarlı küçük ödemeler.
- Risk beyni: harcama akışını izler, anomali görünce `pause()` çağırır.
