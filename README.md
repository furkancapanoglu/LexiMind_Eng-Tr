# 🧠 LexiMind — Akıllı İngilizce Kelime Defteri & Öğrenme Stüdyosu

![Python](https://img.shields.io/badge/Python-3.8%2B-3776AB?logo=python&logoColor=white)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero%20(Stdlib%20Only)-10b981)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-6366f1)
![License](https://img.shields.io/badge/License-MIT-f59e0b)

**LexiMind**, İngilizce kelime öğrenimini kalıcı hale getirmek için **Ebbinghaus Unutma Eğrisi (SM-2 Aralıklı Tekrar Algoritması)**, **Quizlet tarzı interaktif oyun modları**, **Gün Gün İzole Kelime Defteri sistemi** ve **Çok Katmanlı Canlı İngilizce ⇄ Türkçe Sözlük** motorunu tek bir masaüstü uygulamasında birleştiren açık kaynaklı bir kelime öğrenme stüdyosudur.

---

## ✨ Öne Çıkan Özellikler

### 1. 📅 Gün Gün İzole Kelime Defteri & Çoklu Paket Sistemi
- **📅 Günlük İzole Defterler**: Her gün için ayrı bir günlük kelime defteri açılır (örn. *22 Ekim 2026 — Günlük Defter*). Günlük defter seçiliyken kartlar, testler ve yazma modlarında **diğer defterlerdeki kelimeler araya karışmaz**; sadece o gün yazdığınız kelimelere odaklanırsınız.
- **🌍 Genel Kelime Paketi**: Tüm günlük ve özel defterlerinizdeki kelimelerin birleşik ana havuzu.
- **📂 Özel Kelime Defterleri**: Konu veya hedef bazlı (*YDS / IELTS*, *İş İngilizcesi*, *Dizi & Film Kelimeleri*, *Phrasal Verbs*) sınırsız sayıda bağımsız defter oluşturup tek tıkla aralarında geçiş yapabilirsiniz.
- **⚡ Hızlı Satır İçi Kelime Yazma Çubuğu**: Modal açmaya gerek kalmadan İngilizce kelimeyi yazıp `Enter` tuşuna basarak Türkçe anlamını ve örnek cümlesini otomatik çekebilir, saniyeler içinde defterinize kaydedebilirsiniz.

### 2. 🔍 4 Katmanlı Güvenilir İngilizce ⇄ Türkçe Canlı Sözlük
- **Katman 1 (Google Oxford/GTX Yapılandırılmış Sözlük)**: Birincil çeviri, kelime türüne göre (`noun`, `verb`, `adjective`, `adverb`) Türkçe alternatif anlamlar, fonetik okunuş, gerçek İngilizce sözlük tanımları (gloss), örnek cümleler ve eş anlamlılar.
- **Katman 2 (Datamuse Lexical API)**: Zıt anlamlılar (`antonyms`), ek sözlük tanımları ve Oxford Amerikan İngilizcesi stüdyo ses kayıtları.
- **Katman 3 (MyMemory API)**: Yedek çeviri motoru.
- **Katman 4 (Yerleşik Çevrimdışı Sözlük)**: İnternet bağlantısı olmasa bile anında çalışan, hafıza çivisi (*mnemonic*) ipuçlu yerleşik sözlük veritabanı.
- **🔊 Çift Aksan Telaffuz**: Amerikan (`en-US`) ve İngiliz (`en-GB`) sesli okuma desteği.

### 3. 🎯 5 Farklı Bilimsel & İnteraktif Öğrenme Modu
| Mod | Açıklama | Kısayollar |
| :--- | :--- | :--- |
| **🎯 Akıllı Tekrar (SM-2)** | Unutma eğrisine göre kelimeleri *Hatırlamadım (<10 dk)*, *Zorlandım*, *İyi Hatırladım* ve *Çok Kolay* olarak planlar. | `Space`: Çevir, `1-4`: Puanla |
| **🃏 3B Kelime Kartları** | Klasik Quizlet 3 boyutlu kart çevirme, karıştırma, ön yüz dili seçimi (İng/Tr) ve otomatik seslendirme. | `Space`: Çevir, `←/→`: Geçiş, `S`: Ses |
| **🧩 Cümle Tamamlama (Cloze)** | Kelimeyi kuru ezber yerine gerçek İngilizce örnek cümle içindeki boşluğu (`_______`) doldurarak öğretir. | `1-4`: Şık Seçimi |
| **✍️ Yazarak & Dinleyerek (Dikte)** | Türkçe anlamından veya sadece İngilizce sesini dinleyerek (Dictation) kelimeyi harf harf yazma pratiği + Harf İpucu. | `Enter`: Kontrol Et |
| **📝 Test & ⚡ Eşleştirme Oyunu** | 4 şıklı çoktan seçmeli test ve kronometreli/rekor takipli Quizlet kart eşleştirme oyunu (Match). | `1-4`: Şık Seçimi |

### 4. 📊 İstatistikler, Günlük Seri (Streak) & Veri Yedekleme
- **🔥 Günlük Seri & Hedef Takibi**: Son 7 günlük çalışma grafiği, defter bazlı ilerleme tablosu ve **En Çok Zorlandığın Kelimeler** analizi.
- **💾 Çift Katmanlı Otomatik Kayıt**: Verileriniz hem tarayıcı hafızasında (`LocalStorage`) hem de yerel diskte (`data/kelime_defteri_yedek.json`) otomatik yedeklenir.
- **📥 JSON / CSV Dışa & İçe Aktarma**: Tek tıkla `.json` veya Excel uyumlu `.csv` çıktısı alma ve Quizlet formatında toplu kelime listesi yapıştırma.

---

## 🚀 Kurulum ve Çalıştırma

Uygulama **hiçbir harici kütüphane (`pip install`) gerektirmez**; tamamen Python 3 standart kütüphanesi ile çalışır.

### Windows'ta Çalıştırma
1. **Tek Tıkla Masaüstü Modu (Önerilen)**:
   - Klasördeki **`Sessiz_Masaustu_Baslat.vbs`** veya **`Baslat.bat`** dosyasına çift tıklayın.
   - Masaüstünüze özel simgeli kısayol eklemek için **`Masaustu_Kisayolu_Olustur.vbs`** dosyasına çift tıklayabilirsiniz.
2. **Terminal ile Çalıştırma**:
   ```bash
   python app.py
   # veya
   py app.py
   ```

### macOS / Linux'ta Çalıştırma
```bash
chmod +x start.sh
./start.sh
# veya doğrudan:
python3 app.py
```

### Kurulumsuz Tarayıcı Modu
Python kullanmadan doğrudan **`index.html`** dosyasına çift tıklayarak da uygulamayı herhangi bir modern tarayıcıda çalıştırabilirsiniz.

---

## 📁 Proje Klasör Yapısı

```text
LexiMind/
├── app.py                        # Python masaüstü sunucusu, 4 katmanlı sözlük API'si ve simge üreticisi
├── index.html                    # Uygulama arayüzü (Koyu/Açık tema destekli)
├── styles.css                    # Modern tasarım sistemi ve 3B kart animasyonları
├── app.js                        # SM-2 algoritması, 5 öğrenme modu ve defter yönetim motoru
├── dictionary_db.js              # Yerleşik çevrimdışı sözlük ve başlangıç kelime paketleri
├── assets/
│   ├── icon.ico                  # Çoklu çözünürlüklü Windows uygulama simgesi
│   ├── icon.png                  # 256x256 uygulama logosu
│   └── icon.svg                  # Vektörel uygulama logosu
├── Baslat.bat                    # Windows başlatıcısı
├── Sessiz_Masaustu_Baslat.vbs    # Konsolsuz doğrudan masaüstü penceresi başlatıcısı
├── Masaustu_Kisayolu_Olustur.vbs # Masaüstüne simgeli kısayol ekleyici
├── start.sh                      # macOS / Linux başlatıcısı
└── LICENSE                       # MIT Lisansı
```

---

## 📄 Lisans
Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır.
