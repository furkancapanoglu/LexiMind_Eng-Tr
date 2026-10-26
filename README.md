# 🧠 LexiMind — Akıllı İngilizce Kelime Defteri & Öğrenme Stüdyosu

![Python](https://img.shields.io/badge/Python-3.8%2B-3776AB?logo=python&logoColor=white)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero%20(Stdlib%20Only)-10b981)
![PDF Export](https://img.shields.io/badge/Export-Vector%20PDF%20%7C%20CSV%20%7C%20JSON-ec4899)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-6366f1)
![License](https://img.shields.io/badge/License-MIT-f59e0b)

**LexiMind**, İngilizce kelime öğrenimini kalıcı hale getirmek için **Ebbinghaus Unutma Eğrisi (SM-2 Aralıklı Tekrar Algoritması)**, **Quizlet Learn Pro (3 Aşamalı Adaptif Öğrenme Döngüsü)**, **Gün Gün İzole Kelime Defteri & Takvim Arşivi**, **4 Katmanlı Canlı İngilizce ⇄ Türkçe Sözlük** ve **Vektörel A4 PDF Kelime Kitapçığı Üreticisini** tek bir masaüstü uygulamasında birleştiren açık kaynaklı bir kelime öğrenme stüdyosudur.

---

## ✨ Öne Çıkan Özellikler

### 1. 📅 Gün Gün İzole Kelime Defteri, Takvim Arşivi & Çoklu Paket Sistemi
- **📅 Günlük İzole Defterler**: Her gün için ayrı bir günlük kelime defteri açılır (örn. *27 Ekim 2026 — Günlük Defter*). Günlük defter seçiliyken kartlar, testler ve yazma modlarında **diğer defterlerdeki kelimeler araya karışmaz**; sadece o gün yazdığınız kelimelere odaklanırsınız.
- **📆 Günlük Takvim & Arşiv Merkezi**: Yüzlerce günlük defteriniz olsa bile interaktif takvim görünümünden istediğiniz güne tek tıkla atlayabilir, **Son 7 Gün** veya **Son 30 Gün** birleşik çalışma modlarıyla haftalık/aylık tekrar yapabilirsiniz.
- **🔎 Hızlı Defter & Gün Arama Paleti (`Ctrl+P`)**: Tarih, gün adı, özel defter adı veya defter içinde geçen bir kelimeyi yazarak yüzlerce defter arasında saniyeler içinde geçiş yapabilirsiniz.
- **🌍 Genel Kelime Paketi & 📂 Özel Defterler**: Tüm kelimelerin birleşik ana havuzu veya konu/hedef bazlı (*YDS / IELTS*, *İş İngilizcesi*, *Dizi & Film Kelimeleri*, *Phrasal Verbs*) sınırsız sayıda bağımsız defter oluşturma, düzenleme ve silme imkanı.
- **⚡ Hızlı Satır İçi Kelime Yazma & Mükerrer Kontrolü**: Modal açmaya gerek kalmadan İngilizce kelimeyi yazıp `Enter` tuşuna basarak Türkçe anlamını ve örnek cümlesini otomatik çekebilir; kelime daha önce başka bir deftere eklendiyse anında canlı uyarı alabilirsiniz.
- **✨ Eksikleri Tek Tıkla Tamamla**: Mevcut bir defterdeki kelimelerin eksik fonetik okunuşlarını, örnek cümlelerini ve akademik eş anlamlılarını arka planda otomatik zenginleştirir.

### 2. 🔍 4 Katmanlı Güvenilir İngilizce ⇄ Türkçe Canlı Sözlük
- **Katman 1 (Google Oxford/GTX Yapılandırılmış Sözlük)**: Birincil çeviri, kelime türüne göre (`noun`, `verb`, `adjective`, `adverb`) Türkçe alternatif anlamlar, IPA fonetik okunuş, gerçek İngilizce sözlük tanımları (gloss), örnek cümleler ve eş anlamlılar.
- **Katman 2 (Datamuse Lexical API & WordNet)**: Akademik eş anlamlılar (`synonyms`), zıt anlamlılar (`antonyms`), ek sözlük tanımları ve Oxford Amerikan İngilizcesi stüdyo ses kayıtları.
- **Katman 3 (MyMemory API)**: Yedek çeviri motoru.
- **Katman 4 (Yerleşik Çevrimdışı Sözlük)**: İnternet bağlantısı olmasa bile anında çalışan, hafıza çivisi (*mnemonic*) ipuçlu yerleşik sözlük veritabanı.
- **🧹 Akademik Eş Anlamlı Filtresi & Edatlı Kök Çözümleyici**: Argo/sokak ağzı kelimeleri otomatik filtreler; `susceptible to`, `indifferent to` gibi edatlı ifadelerin kök kelimesini otomatik çözümleyerek eksiksiz sözlük verisi getirir.
- **🔊 Çift Aksan Telaffuz**: Amerikan (`en-US`) ve İngiliz (`en-GB`) sesli okuma desteği.

### 3. 🎯 6 Farklı Bilimsel & İnteraktif Öğrenme Modu
| Mod | Açıklama | Kısayollar & Özellikler |
| :--- | :--- | :--- |
| **🎯 Akıllı Tekrar (SM-2)** | Unutma eğrisine göre kelimeleri *Hatırlamadım (<10 dk)*, *Zorlandım*, *İyi Hatırladım* ve *Çok Kolay* olarak planlar. | `Space`: Çevir, `1-4`: Puanla • *Tüm Günler / Seçili Defter* kapsam seçimi |
| **🎓 Karma Öğren (Learn Pro)** | Kelimeleri tek oturumda **3 aşamalı adaptif ustalık döngüsünden** (*1. Şıklı Tanıma ➔ 2. Bağlam/Eş Anlam ➔ 3. Yazarak Üretim*) geçirerek mezun eder. | `1-4`: Şık Seçimi, `Enter`: Yazılı Kontrol |
| **🃏 3B Kelime Kartları** | Klasik Quizlet 3 boyutlu kart çevirme, karıştırma, ön yüz dili seçimi (İng/Tr) ve otomatik seslendirme. | `Space`: Çevir, `←/→`: Geçiş, `1/2`: Bilinirlik, `S`: Ses |
| **🧩 Cümle Tamamlama (Cloze)** | Kelimeyi kuru ezber yerine gerçek İngilizce örnek cümle içindeki boşluğu (`_______`) doldurarak öğretir. | `1-4`: Şık Seçimi, `Enter`: Sonraki Soru |
| **✍️ Yazarak & Dinleyerek (Dikte)** | Türkçe anlamından veya sadece İngilizce sesini dinleyerek (Dictation) kelimeyi harf harf yazma pratiği + Harf İpucu. | Çift yönlü soru (`Tr➔İng` / `İng➔Tr`) ve `Enter` kontrolü |
| **📝 Test & ⚡ Eşleştirme Oyunu** | Çift yönlü 4 şıklı çoktan seçmeli test ve kronometreli/rekor takipli kart eşleştirme oyunu (*İng ⇄ Tr* veya *İng ⇄ Eş Anlamlılar*). | `1-4`: Şık Seçimi |

### 4. 📄 Profesyonel A4 Vektörel PDF Kitapçık Üretici & Otomatik Yedekleme
- **📑 3 Farklı Tasarımda Vektörel PDF Çıktısı**: Seçili defteri veya tüm kelimeleri tam Türkçe ve IPA fonetik karakter destekli A4 PDF olarak indirebilir veya yazdırabilirsiniz:
  1. **✨ Modern Kelime Kartları (2 Sütun Kitapçık)**
  2. **📋 Detaylı Sözlük Tablosu (Tam Genişlik Liste)**
  3. **✍️ Kendini Sına Çalışma Kağıdı (Anlamları Boş Bırakılmış Pratik Kağıdı)**
- **🛡️ Çift Katmanlı Kayıt & 15 Günlük Otomatik Yedek Rotasyonu**: Verileriniz her değişiklikte hem tarayıcı hafızasına (`LocalStorage`), hem `data/kelime_defteri_yedek.json` dosyasına hem de günlük olarak `data/backups/` klasörüne (son 15 gün) otomatik yedeklenir.
- **📥 JSON / CSV Dışa & İçe Aktarma**: Tek tıkla `.json` tam yedek veya Excel uyumlu `.csv` çıktısı alma ve Quizlet formatında toplu kelime listesi yapıştırma.
- **📊 İstatistikler & Akıllı Çalışma Koçu**: Günlük seri (streak), son 7 günlük aktivite grafiği, defter bazlı ilerleme tablosu ve **En Çok Zorlandığın Kelimeler** analizi.

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
├── app.py                        # Python masaüstü sunucusu, 4 katmanlı sözlük API'si, PDF motoru ve yedekleyici
├── index.html                    # Uygulama arayüzü (Koyu/Açık tema destekli)
├── styles.css                    # Modern tasarım sistemi, 3B kart ve takvim stilleri
├── app.js                        # SM-2 algoritması, 6 öğrenme modu, takvim arşivi ve PDF şablon motoru
├── dictionary_db.js              # Yerleşik çevrimdışı sözlük ve başlangıç kelime paketleri
├── assets/
│   ├── icon.ico                  # Çoklu çözünürlüklü Windows uygulama simgesi
│   ├── icon.png                  # 256x256 uygulama logosu
│   └── icon.svg                  # Vektörel uygulama logosu
├── data/                         # Otomatik oluşturulan yerel veri ve 15 günlük yedek klasörü
├── Baslat.bat                    # Windows başlatıcısı
├── Sessiz_Masaustu_Baslat.vbs    # Konsolsuz doğrudan masaüstü penceresi başlatıcısı
├── Masaustu_Kisayolu_Olustur.vbs # Masaüstüne simgeli kısayol ekleyici
├── start.sh                      # macOS / Linux başlatıcısı
└── LICENSE                       # MIT Lisansı
```

---

## 📄 Lisans
Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır.
