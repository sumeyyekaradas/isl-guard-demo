# ISL Guard — Digital Prototype

ISL madenciliği için sentetik veri tabanlı risk izleme ve karar destek prototipi.

Orijinal Streamlit prototipinden React + TypeScript + Tailwind CSS mimarisine yeniden yazılmıştır.

## Özellikler

1. **Canlı Görünüm (Live View):**
   - Son sentetik kuyu ve sınır sensör verileri (Enjeksiyon debisi, Ekstraksiyon debisi, Sınır pH, Sınır Sülfat konsantrasyonu).
   - Birleşik uyarı saatleri, AI Isolation Forest anomali tespiti ve gösterim amaçlı risk puanı.
   - Karar destek öneri paneli (optimizasyon hedef debisi ve uzman inceleme tavsiyesi).
   - Geri sayımlı operatör yanıtı ve sanal durdurma kontrolü (otomatik/manuel acil durum emülasyonu).
   - Zaman serisi akış ve sınır pH grafik gösterimleri.
   - ISL 5-spot kuyu sahası ve izleme çemberi 2D interaktif haritası.

2. **Tracer Testi (Breakthrough Curve):**
   - Sentetik izleyici madde konsantrasyonu ve kırılma eğrisi simülasyonu.
   - Ayarlanabilir test süresi, tepe zamanı ve Gauss eğri yayılımı.
   - Tepe zamanı, tepe konsantrasyonu, trapezoidal AUC (eğri altındaki alan) ve ilk algılanma zamanı metrikleri.
   - Tracer verisini CSV olarak dışa aktarma.

3. **Senaryo Analizi:**
   - Senaryo performans göstergeleri (Kural uyarısı, AI anomali işareti, Birleşik uyarı saatleri).
   - Gradyan göstergesi, sınır sülfat ve risk puanı analiz grafikleri.

4. **Veri ve Model:**
   - Sentetik veri kaynağı, Isolation Forest anomali modeli, kural katmanı ve sınır koşulları açıklaması.
   - Son 20 kayıt tablo görünümü ve tüm veri setini CSV indirme imkânı.

5. **Müdahale Simülasyonu ve Optimizasyon:**
   - Debi kısıtlamasının (allowed imbalance) sentetik verideki etkisi (önce/sonra eşik üstü saatler ve toplam hacimsel fark).
   - Müdahale karşılaştırma grafiği ve son 20 kayıt karşılaştırma tablosu.
   - Sanal sistem kontrolleri, müdahale önerisini olay günlüğüne ekleme ve olay günlüğü yönetimi.

## Çalıştırma

```bash
npm install
npm run dev
```

Uygulama port `3000` üzerinden `0.0.0.0` adresinde yayınlanır.
