# Faz 4 — Canlı Dashboard + Red Team Düğmesi

Demo'nun sahnesi: tek ekranda kasanın durumu, canlı harcama akışı ve ajanı
çıldırtan kırmızı düğme.

## Çalıştırma

```bash
npm run dashboard     # → http://localhost:3000
```

Tarayıcıda sırayla: **🧠 Risk beynini başlat** → **🤖 Normal ajan** (2-3 harcama
izle) → **🔴 RED TEAM** → beyin anomaliyi yakalar, devre kesici çekilir, olay
akışına kırmızı "DEVRE KESİCİ ÇEKİLDİ" satırı düşer → **🟢 Kasayı geri aç**.

## Mimari — neden böyle

```
tarayıcı (index.html)  ←2.5sn→  server.js  ←8sn→  Arc RPC
                                   │ spawn
                                   ├── agent.js (normal | --rogue)
                                   └── riskbrain.js
```

- **Zinciri sadece server yoklar** (8 sn'de bir, `batchMaxCount: 1`). Tarayıcı
  RPC'ye hiç dokunmaz, server'ın belleğindeki durumu okur → Arc'ın rate limitine
  takılmayız. (Bu proje boyunca üç kez öğrendiğimiz ders: Arc RPC'yi nazikçe yokla.)
- **Ajan ve beyin ayrı süreçler** olarak kalır (spawn) — mimari hikaye bozulmaz:
  dashboard sadece bir *pencere*, koruma zincir üstünde + beyinde.
- Süreçlerin stdout'u yakalanıp log paneline akıtılır; zincir olayları
  (`Spent` / `Paused` / `Unpaused`) event akışı tablosuna düşer, her satırda
  explorer tx linki var — "güvenme, zincirden doğrula".

## Arayüz kararları (dataviz rehberinden)

- 4 stat kartı: devre kesici durumu, bakiye, işlem-başı limit, günlük limit
  (dolum çubuğuyla — kayan 24s penceresi).
- Durum renkleri palet standardından: good `#0ca30c`, critical `#d03b3b`;
  renk asla tek başına anlam taşımaz (ikon + metin hep yanında).
- Açık/koyu tema `prefers-color-scheme` ile; metinler mürekkep tonlarında,
  tutar sütunları `tabular-nums`.

## API (server.js)

| Uç | Ne yapar |
|---|---|
| `GET /api/state` | kasa durumu + olaylar + loglar + süreç durumları |
| `POST /api/brain/start` | riskbrain.js'i başlat |
| `POST /api/agent/normal` / `rogue` / `stop` | ajanı yönet (rogue, normali öldürüp yeniden başlatır) |
| `POST /api/unpause` | owner anahtarıyla kasayı geri aç |

## Uçtan uca doğrulandı
Düğmeden başlatılan ajanın harcamaları zincire gitti, server olayları yakaladı,
beyin skorladı, akış ve loglar dashboard'a düştü. Ayrıca ajan artık gerçek
firewall bloğu (revert) ile geçici RPC hatasını logda ayırt ediyor.

## Demo notu
Kasa bakiyesi düşükse faucet'ten USDC alıp kasaya aktar; günlük limit doluysa
(kayan 24s) rogue harcamalar `ExceedsDailyLimit` ile de bloklanabilir — bu da
firewall'un kanıtı ama "beyin breaker çekiyor" sahnesi için limitlerde yer
olduğundan emin ol (`npm run status`).
