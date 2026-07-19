# Faz 5 — 3 Dakikalık Video Senaryosu + Deck İçeriği

## Video senaryosu (3:00)

**Hazırlık (kayıttan önce):**
- `npm run status` → kasa dolu (≥10 USDC), breaker açık, günlük pencerede ≥6 USDC yer.
- Dashboard açık (SSH tüneli), yanında ikinci sekmede kasanın arcscan sayfası.
- Ekran kaydı + mikrofon testi. Bir kez kuru prova koş — rogue anı zamanlamasını hisset.

### 0:00–0:30 — Problem (yüz/slayt ya da sadece ses + başlık slaytı)
> "AI ajanları artık cüzdan tutup otonom ödeme yapıyor. Asıl zor soru şu:
> bir yazılıma gerçek parayı nasıl güvenle emanet edersiniz? Kimse bir ajana
> ham özel anahtar vermek istemez — tek bir hata ya da prompt injection,
> kasanın tamamı demek. Aegis, ajan ekonomisi için bir harcama güvenlik
> duvarı: Ramp ve Brex'in kurumsal kartlara yaptığını, biz otonom ajanlara
> yapıyoruz."

### 0:30–1:00 — Çözüm mimarisi (mimari slaytı)
> "Para ajanda değil, Arc Network üzerinde bir policy vault'ta durur. Kasa
> dört sert kuralı zincir üstünde uygular: işlem-başı limit, kayan 24 saatlik
> günlük limit, izinli adres listesi ve bir devre kesici. Bunlar aşılamaz —
> ajan çıldırsa da, anahtarı çalınsa da. İkinci katman: zincir dışı bir risk
> beyni davranışı izler; anomali görürse devre kesiciyi çeker. Alarm herkesin,
> geri açmak sadece insanın."

### 1:00–2:20 — CANLI DEMO (ekran: dashboard)
- **1:00** Dashboard'u göster: "Kasa zincir üstünde, işte bakiyesi ve limitleri."
  Beyni başlat, normal ajanı başlat.
- **1:15** 2-3 normal harcama akarken: "Ajan işini yapıyor — küçük ödemeler,
  risk skoru sıfır. Her satır gerçek bir Arc işlemi; tx linkine tıklayıp
  zincirden doğrulayabilirsiniz." (Bir tx linkini açıp arcscan'i 2 sn göster.)
- **1:30** **RED TEAM'e bas:** "Şimdi ajanı ele geçirilmiş gibi çıldırtıyorum."
- **1:35–2:00** Sahne kendini oynar: büyük harcama → beynin ANOMALİ satırı →
  kırmızı DEVRE KESİCİ ÇEKİLDİ → kart ⛔'ya döner → ajanın denemesi BLOKLANDI.
  > "İlk anormal işlem geçti — 4 dolar. Sistem saniyeler içinde yakaladı ve
  > kesti. Bu bilinçli bir tasarım: kredi kartı fraud sistemleri gibi. Zarar
  > matematiksel olarak sınırlı — işlem başına en fazla 5, günde en fazla 20
  > dolar, beyin tamamen çökse bile. Firewall'suz aynı ajan cüzdanın tamamını
  > boşaltırdı."
- **2:10** Unpause'a bas: "Geri açma yetkisi sadece insanda."

### 2:20–3:00 — Neden Arc + yol haritası (kapanış slaytı)
> "Aegis, Arc Network üzerine kurulu çünkü ajan ekonomisinin para birimi
> USDC'nin ta kendisi burada native: gas da USDC, ödeme de — ve sub-second
> kesinlik makine hızındaki ödemelere yetişiyor. Kontrat deploy edilmiş
> durumda, repo public, demo canlı. Sırada: politikaları doğal dille tanımlama
> — 'günde en fazla 50 dolar, sadece şu üç adres' — ve çoklu ajan desteği.
> Ajanlara para emanet edilecekse, Aegis o güvenin altyapısı. Teşekkürler."

**Kurallar:** 3:00'ı geçme (jüri kesip atar) · marka: "Aegis, built on Arc
Network" — Arc logosu kendi logondan büyük olmasın · her iddianın ekranda
kanıtı olsun (tx linki, revert mesajı).

---

## Deck içeriği (8 slayt)

1. **Kapak** — Aegis logosu/adı, "Spend-control firewall for AI agents",
   altta küçük: "Built on Arc Network".
2. **Problem** — Ajanlar ödeme yapmaya başladı; ham anahtar = sınırsız risk.
   Tek cümlelik çarpıcı senaryo: "Prompt injection yiyen bir ajan, cüzdanı
   30 saniyede boşaltır."
3. **Çözüm** — Akış diyagramı (README'deki). İki katman: zincir üstü sert
   limitler + zincir dışı risk beyni. "Beyin ölse de limitler ayakta."
4. **Canlı kanıt** — Demo ekran görüntüsü + breaker tx hash'i. "Rogue ajan,
   27.8× sıçrama, saniyeler içinde kesildi. Zincirden doğrulanabilir."
5. **Neden Arc** — USDC native gas, sub-second finality, Circle'ın
   uyum-öncelikli yaklaşımı = kurumsal güven hikayesiyle aynı hizada.
6. **Pazar / benzetme** — Ramp & Brex kurumsal harcama kontrolünü ~milyar
   dolarlık şirketlere çevirdi; ajan ekonomisi aynı kontrol katmanını
   sıfırdan istiyor. Aegis o katman.
7. **Yol haritası** — Doğal dilde politika → çoklu ajan/çoklu kasa →
   privacy → mainnet + denetim.
8. **Kapanış** — Repo linki, kontrat adresi, demo linki, iletişim.

**Deck üretimi:** İçerik hazır; istediğinde bu içerikten HTML tabanlı,
marka uyumlu bir sunum sayfası üretebilirim (Claude'a "deck'i üret" de).
