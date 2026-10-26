// LexiMind - Ana Uygulama Motoru
// Gün Gün (Tarihli) İzole Kelime Defterleri, Genel Kelime Paketi, Özel Defterler,
// SM-2 Aralıklı Tekrar, Canlı Sözlük ve 5 Öğrenme Modu

const STORAGE_KEY = "leximind_state_v1";

const App = {
  state: {
    decks: [],
    words: [],
    selectedDeckId: "all",
    notebookFilter: "all",
    theme: "dark",
    streak: 1,
    lastStudyDate: "",
    dailyProgress: 0,
    dailyGoal: 15,
    bestMatchTime: null,
    studyHistory: {},
    updatedAt: 0
  },

  // Hızlı ekleme geçici verisi
  quickEntryMeta: null,

  // Aktif mod durumları
  dictDirection: "en-tr",
  lastDictResult: null,

  srsQueue: [],
  srsIndex: 0,
  srsFlipped: false,
  srsScope: "global", // "global" (tüm günlerden tekrarı gelenler) veya "deck" (sadece seçili defter)

  // Karma Öğren (Quizlet Learn Pro) durumu
  learnPool: [],
  learnStageMap: {},
  learnCurrent: null,
  learnStepType: "mc-en-tr",
  learnAnswered: false,

  fcList: [],
  fcIndex: 0,
  fcFlipped: false,
  fcFrontLang: "en",
  fcAutoSpeak: true,

  clozeList: [],
  clozeIndex: 0,
  clozeScore: 0,
  clozeAnswered: false,

  writeList: [],
  writeIndex: 0,
  writeHintLen: 0,
  writeDictationOnly: false,
  writePromptLang: "tr", // "tr" (Türkçe göster İngilizce yaz) veya "en" (İngilizce göster Türkçe yaz)
  writeAnswered: false,
  writeRoundWrong: [],

  quizList: [],
  quizIndex: 0,
  quizScore: 0,
  quizWrongWords: [],
  quizDir: "en-tr", // "en-tr" | "tr-en" | "en-syn"
  quizAnswered: false,

  matchTiles: [],
  matchSelected: null,
  matchMatchedCount: 0,
  matchStartTime: 0,
  matchTimerId: null,
  matchMode: "en-tr", // "en-tr" | "en-syn"

  async init() {
    await this.loadState();
    this.ensureDefaultAndDailyDecks();
    this.checkStreak();
    this.applyTheme();
    this.populateDeckSelectors();
    this.updateTopCounters();
    this.updateActiveNotebookBanner();
    this.renderDashboard();
    this.setupKeyboardShortcuts();
    this.quickDictWord("resilient", false);
  },

  async loadState() {
    let localData = null;
    let serverData = null;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) localData = JSON.parse(raw);
    } catch (e) {
      console.warn("LocalStorage okunamadı:", e);
    }

    try {
      const res = await fetch("/api/storage");
      if (res.ok) {
        const json = await res.json();
        if (json && json.ok && json.data && Array.isArray(json.data.words)) {
          serverData = json.data;
        }
      }
    } catch (_) {}

    let loaded = null;
    if (localData && serverData) {
      const localWords = Array.isArray(localData.words) ? localData.words.length : 0;
      const serverWords = Array.isArray(serverData.words) ? serverData.words.length : 0;
      const localTime = localData.updatedAt || 0;
      const serverTime = serverData.updatedAt || 0;

      // Kelime sayısı daha fazla olanı veya daha güncel (updatedAt) olanı seç
      if (serverTime > localTime || serverWords > localWords) {
        loaded = serverData;
      } else {
        loaded = localData;
      }
    } else {
      loaded = serverData || localData;
    }

    if (loaded && Array.isArray(loaded.decks)) {
      this.state = Object.assign({}, this.state, loaded);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (_) {}
    } else {
      this.state.decks = JSON.parse(JSON.stringify(window.STARTER_DECKS || []));
      this.state.words = JSON.parse(JSON.stringify(window.STARTER_WORDS || []));
      this.state.lastStudyDate = this.getTodayStr();
      this.saveState();
    }
  },

  formatTurkishDate(isoDate) {
    try {
      const parts = isoDate.split("-");
      const months = [
        "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
        "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
      ];
      const day = parseInt(parts[2], 10);
      const monthName = months[parseInt(parts[1], 10) - 1] || parts[1];
      return `${day} ${monthName} ${parts[0]}`;
    } catch (_) {
      return isoDate;
    }
  },

  getTodayDailyDeckId() {
    return `deck-daily-${this.getTodayStr()}`;
  },

  // ===== GÜNLÜK DEFTER YARDIMCILARI (Tarih, Aralık, Gezinme) =====
  TR_MONTHS: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
  TR_WEEKDAYS: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"],

  isoFromDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  },

  dateFromIso(iso) {
    const [y, m, d] = iso.split("-").map(n => parseInt(n, 10));
    return new Date(y, m - 1, d);
  },

  addDaysIso(iso, n) {
    const d = this.dateFromIso(iso);
    d.setDate(d.getDate() + n);
    return this.isoFromDate(d);
  },

  getWeekdayName(iso) {
    return this.TR_WEEKDAYS[this.dateFromIso(iso).getDay()];
  },

  formatMonthLabel(ym) {
    const [y, m] = ym.split("-");
    return `${this.TR_MONTHS[parseInt(m, 10) - 1]} ${y}`;
  },

  getDeckDate(deck) {
    if (!deck) return null;
    if (deck.date) return deck.date;
    const m = /^deck-daily-(\d{4}-\d{2}-\d{2})/.exec(deck.id || "");
    return m ? m[1] : null;
  },

  getDeckWordCount(deckId) {
    if (!this._wordCountCache || this._wordCountLen !== this.state.words.length) {
      this._wordCountCache = {};
      this._wordCountLen = this.state.words.length;
      this.state.words.forEach(w => {
        this._wordCountCache[w.deckId] = (this._wordCountCache[w.deckId] || 0) + 1;
      });
    }
    return this._wordCountCache[deckId] || 0;
  },

  invalidateCaches() {
    this._wordCountCache = null;
  },

  // Tarihe göre yeniden eskiye sıralı günlük defterler
  getDailyDecksSorted() {
    return this.state.decks
      .filter(d => d.type === "daily")
      .sort((a, b) => (this.getDeckDate(b) || "").localeCompare(this.getDeckDate(a) || ""));
  },

  getCustomDecks() {
    return this.state.decks.filter(d => d.type !== "daily");
  },

  getDecksForDate(iso) {
    return this.state.decks.filter(d => d.type === "daily" && this.getDeckDate(d) === iso);
  },

  // Günlük defterleri tarihe göre gruplar: { "2026-10-22": [deck, ...] }
  getDailyDateMap() {
    const map = {};
    this.state.decks.forEach(d => {
      if (d.type !== "daily") return;
      const iso = this.getDeckDate(d);
      if (!iso) return;
      (map[iso] = map[iso] || []).push(d);
    });
    return map;
  },

  getWordCountForDate(iso) {
    return this.getDecksForDate(iso).reduce((sum, d) => sum + this.getDeckWordCount(d.id), 0);
  },

  // Seçim türleri: "all" | gerçek defter id | "range:YYYY-MM-DD:YYYY-MM-DD" (birden çok günü birlikte çalışma)
  isRangeSelection(id = this.state.selectedDeckId) {
    return typeof id === "string" && id.startsWith("range:");
  },

  isVirtualSelection(id = this.state.selectedDeckId) {
    return id === "all" || this.isRangeSelection(id);
  },

  parseRange(id = this.state.selectedDeckId) {
    const parts = String(id).split(":");
    return { start: parts[1], end: parts[2] || parts[1] };
  },

  makeRangeId(start, end) {
    return start <= end ? `range:${start}:${end}` : `range:${end}:${start}`;
  },

  describeRange(start, end) {
    const today = this.getTodayStr();
    const s = this.dateFromIso(start);
    const e = this.dateFromIso(end);
    const lastOfMonth = new Date(e.getFullYear(), e.getMonth() + 1, 0).getDate();
    if (start === end) return `${this.formatTurkishDate(start)} (Tüm Defterler)`;
    if (end === today && start === this.addDaysIso(today, -6)) return "Son 7 Gün";
    if (end === today && start === this.addDaysIso(today, -29)) return "Son 30 Gün";
    if (s.getDate() === 1 && e.getDate() === lastOfMonth && s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
      return `${this.formatMonthLabel(start.slice(0, 7))} (Aylık Paket)`;
    }
    return `${this.formatTurkishDate(start)} – ${this.formatTurkishDate(end)}`;
  },

  selectDateRange(start, end, openView = "notebook") {
    const id = this.makeRangeId(start, end);
    const { start: s, end: e } = this.parseRange(id);
    const count = this.state.words.filter(w => {
      const deck = this.state.decks.find(d => d.id === w.deckId);
      const iso = deck && deck.type === "daily" ? this.getDeckDate(deck) : null;
      return iso && iso >= s && iso <= e;
    }).length;
    this.selectDeck(id, openView === "notebook");
    if (openView && openView !== "notebook") this.navigate(openView);
    this.toast(`🗓️ ${this.describeRange(s, e)} seçildi — ${count} kelime birlikte çalışılacak.`);
  },

  selectLastNDays(n, openView = "notebook") {
    const today = this.getTodayStr();
    this.selectDateRange(this.addDaysIso(today, -(n - 1)), today, openView);
  },

  selectMonth(ym, openView = "notebook") {
    const [y, m] = ym.split("-").map(v => parseInt(v, 10));
    const start = `${ym}-01`;
    const end = this.isoFromDate(new Date(y, m, 0));
    this.selectDateRange(start, end, openView);
  },

  // Bir tarihin günlük defterini aç (yoksa oluştur)
  createDailyDeckForDate(iso) {
    const autoId = `deck-daily-${iso}`;
    const id = this.state.decks.some(d => d.id === autoId) ? `deck-daily-${iso}-${Date.now().toString(36).slice(-4)}` : autoId;
    const deck = {
      id,
      name: `${this.formatTurkishDate(iso)} — Günlük Defter`,
      description: `${this.formatTurkishDate(iso)} (${this.getWeekdayName(iso)}) tarihinde eklenen kelimeler (diğer kelimeler karışmadan çalışılır).`,
      icon: "📅",
      color: "#10b981",
      type: "daily",
      date: iso,
      auto: true
    };
    this.state.decks.unshift(deck);
    return deck;
  },

  openDailyByDate(iso, createIfMissing = true) {
    if (!iso) return;
    const decks = this.getDecksForDate(iso);
    if (decks.length === 1) {
      this.selectDeck(decks[0].id, true);
    } else if (decks.length > 1) {
      // Aynı güne ait birden fazla defter varsa o günün tamamını birlikte aç
      this.selectDeck(this.makeRangeId(iso, iso), true);
    } else if (createIfMissing) {
      const deck = this.createDailyDeckForDate(iso);
      this.selectDeck(deck.id, true);
      this.toast(`📅 ${this.formatTurkishDate(iso)} için yeni günlük defter açıldı. Kelimelerinizi yazmaya başlayabilirsiniz.`);
    }
    setTimeout(() => document.getElementById("qe-term")?.focus(), 80);
  },

  // Seçili günün referans tarihi (önceki/sonraki gün gezinmesi için)
  getReferenceDate() {
    const id = this.state.selectedDeckId;
    if (this.isRangeSelection(id)) return this.parseRange(id).end;
    const deck = this.state.decks.find(d => d.id === id);
    if (deck && deck.type === "daily") return this.getDeckDate(deck);
    return this.getTodayStr();
  },

  // Kelime içeren bir önceki/sonraki günlük deftere atla (boş günleri atlar)
  navigateDailyDeck(direction) {
    const ref = this.getReferenceDate();
    const today = this.getTodayStr();
    const dates = Object.keys(this.getDailyDateMap())
      .filter(iso => this.getWordCountForDate(iso) > 0 || iso === today)
      .sort();
    let target = null;
    if (direction < 0) {
      for (let i = dates.length - 1; i >= 0; i--) {
        if (dates[i] < ref) { target = dates[i]; break; }
      }
    } else {
      for (let i = 0; i < dates.length; i++) {
        if (dates[i] > ref) { target = dates[i]; break; }
      }
    }
    if (!target) {
      this.toast(direction < 0 ? "⏮️ Daha eski bir günlük defter bulunmuyor." : "⏭️ Daha yeni bir günlük defter bulunmuyor.");
      return;
    }
    const activeView = document.querySelector(".view-section.active")?.id?.replace("view-", "") || "notebook";
    const decks = this.getDecksForDate(target);
    const id = decks.length === 1 ? decks[0].id : this.makeRangeId(target, target);
    const studyViews = ["srs", "flashcards", "cloze", "write", "quiz", "match", "stats", "notebook"];
    this.selectDeck(id, !studyViews.includes(activeView));
  },

  // Hızlı kelime yazma çubuğunun kaydedeceği gerçek defter
  getQuickEntryTargetDeckId() {
    const id = this.state.selectedDeckId;
    if (!this.isVirtualSelection(id) && this.state.decks.some(d => d.id === id)) return id;
    if (this.isRangeSelection(id)) {
      const { start, end } = this.parseRange(id);
      if (start === end) {
        const decks = this.getDecksForDate(start);
        if (decks.length) return decks[0].id;
      }
    }
    this.ensureDefaultAndDailyDecks();
    return this.getTodayDailyDeckId();
  },

  ensureDefaultAndDailyDecks() {
    let changed = false;
    const autoPattern = /^deck-daily-\d{4}-\d{2}-\d{2}$/;

    // Mevcut setlere tür (type) ve tarih etiketi ekle
    this.state.decks.forEach(d => {
      if (!d.type) {
        d.type = d.id.startsWith("deck-daily-") ? "daily" : "custom";
        changed = true;
      }
      if (d.type === "daily" && !d.date && this.getDeckDate(d)) {
        d.date = this.getDeckDate(d);
        changed = true;
      }
      if (d.type === "daily" && d.auto === undefined && autoPattern.test(d.id)) {
        d.auto = true;
        changed = true;
      }
    });

    // Otomatik açılmış ama hiç kelime yazılmamış geçmiş günlük defterleri temizle (liste şişmesin)
    const todayIso = this.getTodayStr();
    this.invalidateCaches();
    const before = this.state.decks.length;
    this.state.decks = this.state.decks.filter(d =>
      !(d.type === "daily" && d.auto && d.date && d.date < todayIso && this.getDeckWordCount(d.id) === 0)
    );
    if (this.state.decks.length !== before) changed = true;

    // Bugünün Günlük Defteri yoksa otomatik oluştur
    const todayDeckId = this.getTodayDailyDeckId();
    if (!this.state.decks.some(d => d.id === todayDeckId)) {
      this.state.decks.unshift({
        id: todayDeckId,
        name: `${this.formatTurkishDate(todayIso)} — Günlük Defter`,
        description: `${this.formatTurkishDate(todayIso)} (${this.getWeekdayName(todayIso)}) tarihinde eklediğiniz günlük kelimeler (diğer kelimeler karışmadan çalışılır).`,
        icon: "📅",
        color: "#10b981",
        type: "daily",
        date: todayIso,
        auto: true
      });
      changed = true;
    }

    // Silinmiş bir deftere işaret eden seçimi düzelt
    const sel = this.state.selectedDeckId;
    if (!this.isVirtualSelection(sel) && !this.state.decks.some(d => d.id === sel)) {
      this.state.selectedDeckId = "all";
      changed = true;
    }

    if (changed) this.saveState();
  },

  saveState() {
    this.invalidateCaches();
    this.state.updatedAt = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn("LocalStorage kayıt hatası:", e);
    }
    fetch("/api/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(this.state)
    }).catch(() => {});
    this.updateTopCounters();
    this.updateActiveNotebookBanner();
  },

  getTodayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  },

  // Aktif tüm çalışma günlerini (studyHistory + kelime eklenen günler) döndürür
  getActiveStudyDaysSet() {
    const activeDays = new Set();
    const hist = this.state.studyHistory || {};
    Object.keys(hist).forEach(iso => {
      if ((hist[iso] || 0) > 0) activeDays.add(iso);
    });
    // Kullanıcı o gün kelime yazdıysa da aktif çalışma günü kabul et
    this.state.words.forEach(w => {
      if (w.createdAt && /^\d{4}-\d{2}-\d{2}$/.test(w.createdAt)) {
        activeDays.add(w.createdAt);
      }
    });
    return activeDays;
  },

  // Gerçek zamanlı ardışık gün serisini (Streak) hesaplar
  recalculateStreak() {
    const today = this.getTodayStr();
    const yesterday = this.addDaysIso(today, -1);
    const activeDays = this.getActiveStudyDaysSet();

    // Bugünkü pratik sayısını studyHistory ile senkronize et
    const todayCount = (this.state.studyHistory && this.state.studyHistory[today]) || 0;
    this.state.dailyProgress = todayCount;

    let cursor = null;
    if (activeDays.has(today)) {
      cursor = today;
    } else if (activeDays.has(yesterday)) {
      cursor = yesterday;
    } else {
      this.state.streak = 0;
      return 0;
    }

    let count = 0;
    while (cursor && activeDays.has(cursor)) {
      count++;
      cursor = this.addDaysIso(cursor, -1);
    }
    this.state.streak = count;
    return count;
  },

  checkStreak() {
    const prevStreak = this.state.streak;
    const prevProg = this.state.dailyProgress;
    this.recalculateStreak();
    if (this.state.streak !== prevStreak || this.state.dailyProgress !== prevProg) {
      this.saveState();
    }
  },

  recordStudyAction() {
    const today = this.getTodayStr();
    if (!this.state.studyHistory) this.state.studyHistory = {};
    this.state.studyHistory[today] = (this.state.studyHistory[today] || 0) + 1;
    this.state.lastStudyDate = today;

    const prevStreak = this.state.streak || 0;
    this.recalculateStreak();

    if (this.state.dailyProgress === 1 && prevStreak >= 1) {
      this.toast(`🔥 Günlük serin devam ediyor: ${this.state.streak} Gün Seri!`);
    } else if (this.state.dailyProgress === this.state.dailyGoal) {
      this.toast("🎉 Tebrikler! Günlük çalışma hedefini tamamladın!");
    }
    this.saveState();
  },

  // Tema Yönetimi
  applyTheme() {
    document.documentElement.setAttribute("data-theme", this.state.theme || "dark");
    const btn = document.getElementById("theme-toggle-btn");
    if (btn) btn.textContent = this.state.theme === "light" ? "🌙" : "☀️";
  },

  toggleTheme() {
    this.state.theme = this.state.theme === "light" ? "dark" : "light";
    this.applyTheme();
    this.saveState();
  },

  // Sesli Telaffuz Motoru
  speak(text, lang = "en-US", audioUrl = "") {
    if (!text) return;
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => this.speakFallback(text, lang));
      return;
    }
    this.speakFallback(text, lang);
  },

  speakFallback(text, lang = "en-US") {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 0.94;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      v => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Zira") || v.name.includes("David"))
    ) || voices.find(v => v.lang.startsWith("en"));
    if (preferred) utter.voice = preferred;
    window.speechSynthesis.speak(utter);
  },

  // Mikrofonla Canlı Telaffuz Kontrolü (Web Speech API - SpeechRecognition)
  practicePronunciation(targetWord, btnEl = null) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      this.toast("⚠️ Tarayıcınız mikrofonla ses tanıma (SpeechRecognition) özelliğini desteklemiyor. Edge veya Chrome kullanabilirsiniz.");
      return;
    }

    if (this._activeRecognition) {
      try { this._activeRecognition.stop(); } catch (_) {}
      this._activeRecognition = null;
    }

    const rec = new SpeechRec();
    this._activeRecognition = rec;
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 3;

    if (btnEl) btnEl.classList.add("mic-btn", "listening");
    this.toast(`🎙️ Dinleniyor... Lütfen "${targetWord}" kelimesini yüksek sesle telaffuz edin.`);

    rec.onresult = event => {
      if (btnEl) btnEl.classList.remove("listening");
      const results = Array.from(event.results[0] || []).map(r => r.transcript.trim().toLowerCase());
      const primaryHeard = results[0] || "";
      const cleanTarget = targetWord.toLowerCase().replace(/[^a-z\s]/g, "").trim();
      const headTarget = cleanTarget.replace(/\s+(to|with|of|in|on|for|at|from|about|by|into|over)$/i, "").trim();

      const exactMatch = results.some(r => {
        const cleanR = r.replace(/[^a-z\s]/g, "").trim();
        return cleanR === cleanTarget || (headTarget.length >= 3 && cleanR === headTarget);
      });

      if (exactMatch) {
        this.toast(`🎉 Mükemmel Telaffuz! Algılanan: "${primaryHeard}" (%100 Doğru)`);
        this.recordStudyAction();
      } else {
        this.toast(`🎤 Algılanan: "${primaryHeard}" — Hedef: "${targetWord}". Doğru telaffuz seslendiriliyor...`);
        this.speak(targetWord);
      }
    };

    rec.onerror = err => {
      if (btnEl) btnEl.classList.remove("listening");
      if (err.error === "not-allowed") {
        this.toast("⚠️ Mikrofon izni reddedildi. Tarayıcı adres çubuğundan mikrofon izni verin.");
      } else {
        this.toast("⚠️ Ses algılanamadı, lütfen tekrar deneyin.");
      }
    };

    rec.onend = () => {
      if (btnEl) btnEl.classList.remove("listening");
      this._activeRecognition = null;
    };

    try {
      rec.start();
    } catch (_) {
      if (btnEl) btnEl.classList.remove("listening");
    }
  },

  // Hızlı Defter Geçiş Fonksiyonları
  openTodayDailyNotebook() {
    this.ensureDefaultAndDailyDecks();
    const todayId = this.getTodayDailyDeckId();
    this.state.selectedDeckId = todayId;
    this.saveState();
    this.populateDeckSelectors();
    this.navigate("notebook");
    setTimeout(() => document.getElementById("qe-term")?.focus(), 80);
    this.toast("📅 Bugünün Günlük Defteri açıldı! Diğer kelimeler karışmadan sadece bugünün kelimelerine çalışabilirsiniz.");
  },

  openGeneralPackage() {
    this.state.selectedDeckId = "all";
    this.saveState();
    this.populateDeckSelectors();
    this.navigate("notebook");
    this.toast("🌍 Genel Kelime Paketi (Tüm Kelimeler) seçildi.");
  },

  selectDeck(deckId, openNotebookView = false) {
    this.state.selectedDeckId = deckId;
    this.saveState();
    this.populateDeckSelectors();
    if (openNotebookView) {
      this.navigate("notebook");
    } else {
      const activeSection = document.querySelector(".view-section.active");
      if (activeSection) {
        this.navigate(activeSection.id.replace("view-", ""));
      }
    }
  },

  getSelectedDeckObject() {
    const id = this.state.selectedDeckId;
    if (this.isRangeSelection(id)) {
      const { start, end } = this.parseRange(id);
      const label = this.describeRange(start, end);
      return {
        id,
        name: `🗓️ ${label}`,
        description: start === end
          ? `${this.formatTurkishDate(start)} gününe ait tüm günlük defterler birlikte çalışılıyor.`
          : `${this.formatTurkishDate(start)} ile ${this.formatTurkishDate(end)} arasındaki tüm günlük defterlerin kelimeleri birlikte çalışılıyor.`,
        icon: "🗓️",
        type: "range",
        start,
        end
      };
    }
    if (id === "all") {
      return {
        id: "all",
        name: "Genel Kelime Paketi (Tüm Kelimelerim)",
        description: "Günlük ve özel tüm defterlerinizdeki kelimelerin birleşik genel paketi.",
        icon: "🌍",
        type: "general"
      };
    }
    return this.state.decks.find(d => d.id === id) || {
      id: "all",
      name: "Genel Kelime Paketi",
      description: "Tüm kelimeler",
      icon: "🌍",
      type: "general"
    };
  },

  updateActiveNotebookBanner() {
    const deck = this.getSelectedDeckObject();
    const wordsCount = this.getActiveWords().length;
    const dueCount = this.getDueWords().length;

    const iconEl = document.getElementById("anb-icon");
    const nameEl = document.getElementById("anb-name");
    const badgeEl = document.getElementById("anb-badge");
    const descEl = document.getElementById("anb-desc");
    const dateInput = document.getElementById("anb-date-input");

    if (iconEl) iconEl.textContent = deck.icon || "📓";
    if (nameEl) nameEl.textContent = `${deck.name} (${wordsCount} Kelime)`;
    if (badgeEl) {
      if (deck.id === "all") {
        badgeEl.textContent = "🌍 Genel Paket Modu";
        badgeEl.style.background = "var(--info-soft)";
        badgeEl.style.color = "var(--info)";
      } else if (deck.type === "range") {
        badgeEl.textContent = "🗓️ Çoklu Gün Modu (Seçili Günler Birlikte)";
        badgeEl.style.background = "var(--warning-soft)";
        badgeEl.style.color = "var(--warning)";
      } else if (deck.type === "daily") {
        const iso = this.getDeckDate(deck);
        badgeEl.textContent = `📅 ${iso ? this.getWeekdayName(iso) + " • " : ""}Günlük İzole Mod`;
        badgeEl.style.background = "var(--success-soft)";
        badgeEl.style.color = "var(--success)";
      } else {
        badgeEl.textContent = "📂 Özel Defter Modu (Sadece Bu Defter)";
        badgeEl.style.background = "var(--accent-soft)";
        badgeEl.style.color = "var(--accent)";
      }
    }
    if (descEl) {
      if (deck.id === "all") {
        descEl.textContent = `Tüm defterlerinizdeki toplam ${wordsCount} kelime bir arada (${dueCount} tekrar bekliyor).`;
      } else if (deck.type === "range") {
        descEl.textContent = `${deck.description} (${dueCount} tekrar bekliyor)`;
      } else {
        descEl.textContent = `Şu an sadece "${deck.name}" içindeki ${wordsCount} kelimeye odaklandınız. Kartlar, Test ve Yazma modlarında başka defterlerden kelime sorulmaz.`;
      }
    }
    if (dateInput) dateInput.value = this.getReferenceDate();
  },

  // Navigasyon
  navigate(viewName) {
    document.querySelectorAll(".view-section").forEach(s => s.classList.remove("active"));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add("active");

    document.querySelectorAll(".nav-item").forEach(item => {
      const v = item.getAttribute("data-view");
      item.classList.toggle("active", v === viewName);
    });

    if (this.matchTimerId && viewName !== "match") {
      clearInterval(this.matchTimerId);
      this.matchTimerId = null;
    }

    this.updateActiveNotebookBanner();

    switch (viewName) {
      case "dashboard":
        this.renderDashboard();
        break;
      case "notebook":
        this.renderNotebook();
        break;
      case "srs":
        this.startSRS(false);
        break;
      case "learn":
        this.initLearnMode(false);
        break;
      case "flashcards":
        this.initFlashcards();
        break;
      case "cloze":
        this.initClozeMode();
        break;
      case "write":
        this.initWriteMode();
        break;
      case "quiz":
        this.initQuizMode();
        break;
      case "match":
        this.initMatchGame();
        break;
      case "stats":
        this.renderStats();
        break;
      case "calendar":
        this.renderCalendar();
        break;
    }
  },

  getActiveWords() {
    const id = this.state.selectedDeckId;
    if (id === "all") {
      return this.state.words;
    }
    if (this.isRangeSelection(id)) {
      const { start, end } = this.parseRange(id);
      const deckIds = new Set(
        this.state.decks
          .filter(d => {
            if (d.type !== "daily") return false;
            const iso = this.getDeckDate(d);
            return iso && iso >= start && iso <= end;
          })
          .map(d => d.id)
      );
      return this.state.words.filter(w => deckIds.has(w.deckId));
    }
    return this.state.words.filter(w => w.deckId === id);
  },

  // Çoktan seçmeli şıklar için önce sadece seçili defterden çeldirici (distractor) getirir
  getDistractorsForWord(currentWord, count = 3) {
    const activePool = this.getActiveWords().filter(w => w.id !== currentWord.id);
    if (activePool.length >= count) {
      return this.shuffleArray([...activePool]).slice(0, count);
    }
    const chosenTerms = new Set([currentWord.term.toLowerCase(), ...activePool.map(w => w.term.toLowerCase())]);
    const extraPool = this.state.words.filter(w => !chosenTerms.has(w.term.toLowerCase()));
    const combined = [...activePool, ...this.shuffleArray(extraPool).slice(0, count - activePool.length)];
    if (combined.length >= count) return combined;

    // Eğer tüm defterlerdeki toplam kelime sayısı 4'ten azsa yerleşik sözlükten tamamla
    const builtinExtra = (window.BUILTIN_DICTIONARY || [])
      .filter(b => !chosenTerms.has(b.term.toLowerCase()))
      .map((b, idx) => ({ id: `builtin-${idx}`, term: b.term, meaning: b.meaning }));
    return [...combined, ...this.shuffleArray(builtinExtra).slice(0, count - combined.length)];
  },

  // Bir kelimenin bugün tekrar zamanı gelmiş mi? (Akşam çalışılan kelimenin ertesi sabah saat farkına takılmaması için aynı takvim günündeki due kelimeleri de kapsar)
  isWordDue(w, endOfTodayMs = null) {
    if (!w) return false;
    if (!w.nextReview) return true;
    const cutoff = endOfTodayMs || new Date().setHours(23, 59, 59, 999);
    return w.nextReview <= cutoff;
  },

  getDueWords(wordsPool = null) {
    const pool = wordsPool || this.getActiveWords();
    const endOfTodayMs = new Date().setHours(23, 59, 59, 999);
    return pool.filter(w => this.isWordDue(w, endOfTodayMs));
  },

  // Tüm defterlerdeki tekrar zamanı gelen kelimeleri günlere/defterlere göre analiz eder
  getGlobalDueBreakdown() {
    const today = this.getTodayStr();
    const yesterday = this.addDaysIso(today, -1);
    const endOfTodayMs = new Date().setHours(23, 59, 59, 999);
    const deckMap = {};
    this.state.decks.forEach(d => (deckMap[d.id] = d));

    const allDue = this.state.words.filter(w => this.isWordDue(w, endOfTodayMs));
    const pastGroupsMap = {};
    const todayWords = [];

    allDue.forEach(w => {
      const d = deckMap[w.deckId];
      const iso = d && d.type === "daily" ? this.getDeckDate(d) : (w.createdAt || "");
      if (iso === today) {
        todayWords.push(w);
      } else {
        const key = d ? d.id : "other";
        if (!pastGroupsMap[key]) {
          let label = d ? d.name : "Genel";
          let badge = "Önceki Gün";
          if (iso) {
            const diff = Math.round((this.dateFromIso(today) - this.dateFromIso(iso)) / 86400000);
            badge = iso === yesterday ? "🕘 Dün" : diff > 1 ? `📅 ${diff} Gün Önce` : `📅 ${this.formatTurkishDate(iso)}`;
            label = `${this.formatTurkishDate(iso)} (${this.getWeekdayName(iso)})`;
          }
          pastGroupsMap[key] = {
            deckId: key,
            iso: iso || "",
            badge,
            label,
            words: []
          };
        }
        pastGroupsMap[key].words.push(w);
      }
    });

    const pastGroups = Object.values(pastGroupsMap).sort((a, b) => (b.iso || "").localeCompare(a.iso || ""));
    const pastDueWords = pastGroups.reduce((acc, g) => acc.concat(g.words), []);

    return {
      allDue,
      pastDueWords,
      todayWords,
      pastGroups
    };
  },

  onGlobalDeckChange(deckId) {
    this.selectDeck(deckId, false);
  },

  populateDeckSelectors() {
    const globalSel = document.getElementById("global-deck-select");
    const wmSel = document.getElementById("wm-deck");
    const bulkSel = document.getElementById("bulk-deck-select");
    const sidebarList = document.getElementById("sidebar-decks-list");

    const dailyDecks = this.getDailyDecksSorted();
    const customDecks = this.getCustomDecks();
    const current = this.state.selectedDeckId || "all";
    const today = this.getTodayStr();

    // Günlük defterleri aylara göre grupla (yeniden eskiye)
    const monthGroups = [];
    dailyDecks.forEach(d => {
      const ym = (this.getDeckDate(d) || "").slice(0, 7);
      let grp = monthGroups[monthGroups.length - 1];
      if (!grp || grp.ym !== ym) {
        grp = { ym, decks: [] };
        monthGroups.push(grp);
      }
      grp.decks.push(d);
    });

    if (globalSel) {
      let html = `<option value="all">🌍 Genel Kelime Paketi (Tümü: ${this.state.words.length})</option>`;

      // Çoklu gün seçenekleri
      const last7 = this.makeRangeId(this.addDaysIso(today, -6), today);
      const last30 = this.makeRangeId(this.addDaysIso(today, -29), today);
      const rangeOpts = [
        [last7, "🗓️ Son 7 Günün Tüm Kelimeleri"],
        [last30, "🗓️ Son 30 Günün Tüm Kelimeleri"]
      ];
      if (this.isRangeSelection(current) && !rangeOpts.some(o => o[0] === current)) {
        const { start, end } = this.parseRange(current);
        rangeOpts.unshift([current, `🗓️ ${this.describeRange(start, end)}`]);
      }
      html += `<optgroup label="🗓️ Çoklu Gün Çalışması">`;
      rangeOpts.forEach(([val, label]) => {
        html += `<option value="${val}">${this.escapeHtml(label)}</option>`;
      });
      html += `</optgroup>`;

      monthGroups.forEach(grp => {
        const total = grp.decks.reduce((s, d) => s + this.getDeckWordCount(d.id), 0);
        html += `<optgroup label="📅 ${grp.ym ? this.formatMonthLabel(grp.ym) : "Tarihsiz"} (${grp.decks.length} gün • ${total} kelime)">`;
        grp.decks.forEach(d => {
          const iso = this.getDeckDate(d);
          const label = iso
            ? `${iso === today ? "⭐ Bugün — " : ""}${this.formatTurkishDate(iso)}, ${this.getWeekdayName(iso)}`
            : d.name;
          html += `<option value="${d.id}">${this.escapeHtml(label)} (${this.getDeckWordCount(d.id)})</option>`;
        });
        html += `</optgroup>`;
      });

      if (customDecks.length > 0) {
        html += `<optgroup label="📂 Özel Kelime Defterlerim">`;
        customDecks.forEach(d => {
          html += `<option value="${d.id}">${d.icon || "📘"} ${this.escapeHtml(d.name)} (${this.getDeckWordCount(d.id)})</option>`;
        });
        html += `</optgroup>`;
      }
      globalSel.innerHTML = html;
      globalSel.value = current;

      const exportSel = document.getElementById("export-deck-select");
      if (exportSel) {
        exportSel.innerHTML = html;
        exportSel.value = current;
      }
    }

    // Kelime ekleme pencereleri: önce son günlük defterler, sonra özel defterler
    let deckOptions = "";
    monthGroups.forEach(grp => {
      deckOptions += `<optgroup label="📅 ${grp.ym ? this.formatMonthLabel(grp.ym) : "Tarihsiz"}">`;
      grp.decks.forEach(d => {
        const iso = this.getDeckDate(d);
        deckOptions += `<option value="${d.id}">📅 ${this.escapeHtml(iso ? `${this.formatTurkishDate(iso)}, ${this.getWeekdayName(iso)}` : d.name)}</option>`;
      });
      deckOptions += `</optgroup>`;
    });
    if (customDecks.length) {
      deckOptions += `<optgroup label="📂 Özel Defterler">`;
      customDecks.forEach(d => {
        deckOptions += `<option value="${d.id}">${d.icon || "📘"} ${this.escapeHtml(d.name)}</option>`;
      });
      deckOptions += `</optgroup>`;
    }

    const defaultTarget = this.isVirtualSelection(current) ? this.getQuickEntryTargetDeckId() : current;
    if (wmSel) {
      wmSel.innerHTML = deckOptions;
      wmSel.value = defaultTarget;
    }
    if (bulkSel) {
      bulkSel.innerHTML = deckOptions;
      bulkSel.value = defaultTarget;
    }

    // Sol menü: sadece son günler + özel defterler (liste büyüse bile kompakt kalır)
    if (sidebarList) {
      const item = (id, label, count, extraTitle = "") => `
        <li class="sidebar-deck-item ${current === id ? "active" : ""}" onclick="App.selectDeck('${id}', true)" title="${this.escapeHtml(extraTitle || label)}">
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${label}</span>
          <span style="font-size:11px; opacity:0.8;">${count}</span>
        </li>`;

      let sHtml = item("all", "🌍 Genel Paket (Tümü)", this.state.words.length);

      const recentDaily = dailyDecks
        .filter(d => this.getDeckWordCount(d.id) > 0 || this.getDeckDate(d) === today)
        .slice(0, 5);
      // Seçili günlük defter son 5'te değilse onu da göster
      const selDeck = this.state.decks.find(d => d.id === current);
      if (selDeck && selDeck.type === "daily" && !recentDaily.includes(selDeck)) recentDaily.push(selDeck);

      sHtml += `<li class="sidebar-group-label">📅 Son Günler</li>`;
      recentDaily.forEach(d => {
        const iso = this.getDeckDate(d);
        const label = iso === today
          ? `⭐ Bugün (${this.formatTurkishDate(iso).split(" ").slice(0, 2).join(" ")})`
          : iso === this.addDaysIso(today, -1)
            ? `🕘 Dün (${this.formatTurkishDate(iso).split(" ").slice(0, 2).join(" ")})`
            : `📅 ${iso ? `${this.formatTurkishDate(iso).split(" ").slice(0, 2).join(" ")}, ${this.getWeekdayName(iso).slice(0, 3)}` : d.name}`;
        sHtml += item(d.id, label, this.getDeckWordCount(d.id), d.name);
      });

      const activeDayCount = Object.keys(this.getDailyDateMap()).filter(iso => this.getWordCountForDate(iso) > 0).length;
      sHtml += `
        <li class="sidebar-deck-item sidebar-more-link" onclick="App.navigate('calendar')">
          <span>📆 Tüm Günler — Takvim & Arşiv</span>
          <span style="font-size:11px; opacity:0.8;">${activeDayCount}</span>
        </li>
        <li class="sidebar-deck-item sidebar-more-link" onclick="App.selectLastNDays(7)">
          <span>🗓️ Son 7 Günü Birlikte Çalış</span>
        </li>`;

      if (customDecks.length) {
        sHtml += `<li class="sidebar-group-label">📂 Özel Defterler</li>`;
        customDecks.forEach(d => {
          sHtml += item(d.id, `${d.icon || "📘"} ${this.escapeHtml(d.name)}`, this.getDeckWordCount(d.id), d.name);
        });
      }
      if (this.isRangeSelection(current)) {
        const { start, end } = this.parseRange(current);
        sHtml = item(current, `🗓️ ${this.escapeHtml(this.describeRange(start, end))}`, this.getActiveWords().length) + sHtml;
      }
      sidebarList.innerHTML = sHtml;
    }
  },

  updateTopCounters() {
    this.recalculateStreak();
    const activeWords = this.getActiveWords();
    const totalWords = this.state.words.length;
    const todayDeckId = this.getTodayDailyDeckId();
    const todayWordsCount = this.state.words.filter(w => w.deckId === todayDeckId).length;
    const dueWords = this.getDueWords(activeWords).length;
    const globalDueCount = this.getDueWords(this.state.words).length;
    const masteredWords = activeWords.filter(w => w.status === "mastered" || w.status === "familiar").length;

    let totalCorrect = 0;
    let totalAttempts = 0;
    activeWords.forEach(w => {
      totalCorrect += (w.correctCount || 0);
      totalAttempts += (w.correctCount || 0) + (w.wrongCount || 0);
    });
    const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 100;

    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setEl("nav-total-words", totalWords);
    setEl("nav-today-words", todayWordsCount);
    setEl("nav-due-count", globalDueCount);
    setEl("stat-total", activeWords.length);
    setEl("stat-due", globalDueCount);
    setEl("stat-mastered", masteredWords);
    setEl("stat-accuracy", `%${accuracy}`);
    setEl("streak-count", this.state.streak ?? 0);

    const prog = Math.min(this.state.dailyProgress || 0, this.state.dailyGoal || 15);
    const goal = this.state.dailyGoal || 15;
    setEl("daily-goal-text", `${this.state.dailyProgress || 0} / ${goal} pratik`);
    const bar = document.getElementById("daily-goal-bar");
    if (bar) bar.style.width = `${Math.min(100, Math.round((prog / goal) * 100))}%`;
  },

  renderDailyCoachBanner() {
    const coachEl = document.getElementById("dashboard-coach-banner");
    if (!coachEl) return;

    const { allDue, pastDueWords, todayWords, pastGroups } = this.getGlobalDueBreakdown();
    const today = this.getTodayStr();
    const todayStudied = (this.state.studyHistory && this.state.studyHistory[today]) || 0;

    if (allDue.length === 0) {
      coachEl.innerHTML = `
        <div class="coach-banner" style="border-color:rgba(16,185,129,0.35);">
          <div class="coach-header">
            <div>
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span style="font-size:22px;">✅</span>
                <h3 style="font-size:16.5px;">Harika! Bugün İçin Bekleyen Aralıklı Tekrarın Kalmadı</h3>
                <span class="pos-badge" style="background:var(--success-soft); color:var(--success);">🔥 ${this.state.streak} Gün Seri</span>
              </div>
              <p style="font-size:13px; color:var(--text-secondary);">
                Önceki günlerin tekrar zamanı gelen tüm kelimelerini tamamladın. Bugünün defterine yeni kelimeler ekleyebilir veya serbest pratik yapabilirsin.
              </p>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn btn-primary btn-sm" onclick="App.openTodayDailyNotebook()">✍️ Bugünün Defterine Kelime Yaz</button>
              <button class="btn btn-secondary btn-sm" onclick="App.startCustomSRSSession('all')">🔄 Tüm Kelimelerle Serbest Tekrar</button>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const pastSummaryText = pastGroups.length > 0
      ? `Önceki <b>${pastGroups.length}</b> günden tekrar zamanı gelmiş <b>${pastDueWords.length} kelime</b>${todayWords.length > 0 ? ` ve bugün eklediğin <b>${todayWords.length} yeni kelime</b>` : ""} seni bekliyor.`
      : `Bugün eklediğin <b>${todayWords.length} yeni kelime</b> ilk öğrenme tekrarını bekliyor.`;

    coachEl.innerHTML = `
      <div class="coach-banner">
        <div class="coach-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
              <span style="font-size:22px;">🧠</span>
              <h3 style="font-size:17px;">Bugünkü Akıllı Tekrar & Öğrenme Rehberin</h3>
              <span class="pos-badge" style="background:var(--warning-soft); color:var(--warning);">⏰ Toplam ${allDue.length} Kelime Tekrar Bekliyor</span>
              <span class="pos-badge" style="background:var(--success-soft); color:var(--success);">🔥 ${this.state.streak} Gün Seri (${todayStudied} pratik)</span>
            </div>
            <p style="font-size:13.5px; color:var(--text-secondary);">
              ${pastSummaryText} Unutma eğrisine göre <b>önce geçmiş günlerin kelimelerini</b> tekrar etmen kalıcılığı 3 kat artırır:
            </p>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${pastDueWords.length > 0 ? `
              <button class="btn btn-primary btn-sm" onclick="App.startCustomSRSSession('past')">
                ⏪ Önceki Günlerin ${pastDueWords.length} Kelimesini Tekrar Et
              </button>
            ` : ""}
            <button class="btn ${pastDueWords.length > 0 ? "btn-secondary" : "btn-primary"} btn-sm" onclick="App.startCustomSRSSession('all_due')">
              🎯 Tüm Bekleyenleri Başlat (${allDue.length})
            </button>
          </div>
        </div>

        ${pastGroups.length > 0 ? `
          <div class="coach-days-list">
            ${pastGroups.slice(0, 6).map(g => {
              const sample = g.words.slice(0, 4).map(w => w.term).join(", ");
              return `
                <div class="coach-day-chip">
                  <div>
                    <div style="font-weight:700; font-size:13.5px;">
                      <span style="color:var(--warning);">${this.escapeHtml(g.badge)}:</span> ${this.escapeHtml(g.label)}
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">
                      <b>${g.words.length} kelime tekrar bekliyor:</b> ${this.escapeHtml(sample)}${g.words.length > 4 ? "..." : ""}
                    </div>
                  </div>
                  <div style="display:flex; gap:6px; flex-shrink:0;">
                    <button class="btn btn-primary btn-sm" onclick="App.startCustomSRSSession('deck', '${g.deckId}')" title="Bu günün bekleyen kelimelerini Akıllı Tekrar (SM-2) ile çalış">
                      🎯 Tekrar Et (${g.words.length})
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="App.selectDeck('${g.deckId}', false); App.navigate('quiz');" title="Bu günün kelimelerinden test çöz">
                      📝 Test
                    </button>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        ` : ""}
      </div>
    `;
  },

  // 1. ANA PANEL (DASHBOARD)
  renderDashboard() {
    this.updateTopCounters();
    this.populateDeckSelectors();
    this.renderDailyCoachBanner();

    const dailyGrid = document.getElementById("dashboard-daily-decks-grid");
    const customGrid = document.getElementById("dashboard-decks-grid");

    const today = this.getTodayStr();
    const dailyDecks = this.getDailyDecksSorted();
    const customDecks = this.getCustomDecks();

    if (dailyGrid) {
      // Sadece en son 5 günü kart olarak göster; geri kalanı takvim & arşivde
      const recent = dailyDecks
        .filter(d => this.getDeckWordCount(d.id) > 0 || this.getDeckDate(d) === today)
        .slice(0, 5);
      const activeDays = Object.keys(this.getDailyDateMap()).filter(iso => this.getWordCountForDate(iso) > 0);
      const dailyWordTotal = dailyDecks.reduce((s, d) => s + this.getDeckWordCount(d.id), 0);
      const archiveCard = `
        <div class="mode-card" onclick="App.navigate('calendar')" style="border-style:dashed; border-color:var(--border-highlight);">
          <div>
            <div class="mode-card-header">
              <div class="mode-card-icon" style="background:var(--warning-soft); color:var(--warning);">📆</div>
              <span class="mode-tag" style="background:var(--warning-soft); color:var(--warning);">
                ${activeDays.length} Gün • ${dailyWordTotal} Kelime
              </span>
            </div>
            <h4>Takvim & Günlük Defter Arşivi</h4>
            <p>Tüm günlerinizi takvimde görün, istediğiniz tarihe atlayın, kelime arayarak hangi gün yazdığınızı bulun.</p>
          </div>
          <div style="display:flex; gap:8px; margin-top:14px; flex-wrap:wrap;" onclick="event.stopPropagation()">
            <button class="btn btn-secondary btn-sm" onclick="App.selectLastNDays(7)">🗓️ Son 7 Gün</button>
            <button class="btn btn-secondary btn-sm" onclick="App.selectLastNDays(30)">🗓️ Son 30 Gün</button>
            <button class="btn btn-secondary btn-sm" onclick="App.openDeckSwitcher()">🔎 Ara</button>
          </div>
        </div>
      `;
      dailyGrid.innerHTML = recent.map(d => this.renderDeckCardHtml(d, true)).join("") + archiveCard;
    }

    if (customGrid) {
      const generalCardHtml = `
        <div class="mode-card" onclick="App.selectDeck('all', true)" style="${this.state.selectedDeckId === "all" ? "border-color:var(--accent);" : ""}">
          <div>
            <div class="mode-card-header">
              <div class="mode-card-icon" style="background:var(--info-soft); color:var(--info);">🌍</div>
              <span class="mode-tag" style="background:var(--info-soft); color:var(--info);">
                Genel Paket • ${this.state.words.length} Kelime
              </span>
            </div>
            <h4>Genel Kelime Paketi (Tüm Kelimeler)</h4>
            <p>Günlük ve özel tüm defterlerinizdeki kelimeleri tek bir büyük paket olarak bir arada çalışın.</p>
          </div>
        </div>
      `;
      customGrid.innerHTML = generalCardHtml + customDecks.map(d => this.renderDeckCardHtml(d, false)).join("");
    }
  },

  renderDeckCardHtml(d, isDaily) {
    const words = this.state.words.filter(w => w.deckId === d.id);
    const due = this.getDueWords(words).length;
    const mastered = words.filter(w => w.status === "mastered" || w.status === "familiar").length;
    const pct = words.length > 0 ? Math.round((mastered / words.length) * 100) : 0;
    const isSelected = this.state.selectedDeckId === d.id;

    return `
      <div class="mode-card" onclick="App.selectDeck('${d.id}', true)" style="${isSelected ? "border-color:var(--accent);" : ""}">
        <div>
          <div class="mode-card-header">
            <div class="mode-card-icon" style="background:${d.color || "#6366f1"}22; color:${d.color || "#6366f1"};">${d.icon || (isDaily ? "📅" : "📘")}</div>
            <span class="mode-tag" style="background:${isDaily ? "var(--success-soft)" : "var(--bg-elevated)"}; color:${isDaily ? "var(--success)" : "var(--text-secondary)"};">
              ${words.length} Kelime • ${due} Tekrar
            </span>
          </div>
          <h4>${this.escapeHtml(d.name)}</h4>
          <p>${this.escapeHtml(d.description || "")}</p>
        </div>
        <div style="margin-top:14px;">
          <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--text-muted); margin-bottom:4px;">
            <span>Öğrenme Oranı</span>
            <span>%${pct}</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width:${pct}%;"></div>
          </div>
        </div>
      </div>
    `;
  },

  // 2. KELİME DEFTERİ GÖRÜNÜMÜ & HIZLI GÜNLÜK GİRİŞ
  renderNotebookTabs() {
    const bar = document.getElementById("notebook-tabs-bar");
    if (!bar) return;

    const current = this.state.selectedDeckId;
    const today = this.getTodayStr();
    const tab = (id, label, count, extraStyle = "") => `
      <button class="notebook-tab ${current === id ? "active" : ""}" onclick="App.selectDeck('${id}', true)" style="${extraStyle}">
        <span>${label}</span>
        ${count !== null ? `<span class="tab-count">${count}</span>` : ""}
      </button>`;

    let html = tab("all", "🌍 Genel Paket", this.state.words.length);

    if (this.isRangeSelection(current)) {
      const { start, end } = this.parseRange(current);
      html += tab(current, `🗓️ ${this.escapeHtml(this.describeRange(start, end))}`, this.getActiveWords().length);
    }

    // Son 4 günlük defter (+ seçiliyse eski bir gün)
    const recent = this.getDailyDecksSorted()
      .filter(d => this.getDeckWordCount(d.id) > 0 || this.getDeckDate(d) === today)
      .slice(0, 4);
    const selDeck = this.state.decks.find(d => d.id === current);
    if (selDeck && selDeck.type === "daily" && !recent.includes(selDeck)) recent.push(selDeck);
    recent.forEach(d => {
      const iso = this.getDeckDate(d);
      const short = iso ? this.formatTurkishDate(iso).split(" ").slice(0, 2).join(" ") : d.name;
      const label = iso === today ? `⭐ Bugün` : iso === this.addDaysIso(today, -1) ? `🕘 Dün` : `📅 ${short}`;
      html += tab(d.id, this.escapeHtml(label), this.getDeckWordCount(d.id));
    });

    html += `
      <button class="notebook-tab" onclick="App.navigate('calendar')" style="border-style:dashed; color:var(--warning);">📆 Tüm Günler</button>
      <button class="notebook-tab" onclick="App.openDeckSwitcher()" style="border-style:dashed;">🔎 Defter Ara <kbd class="kbd">Ctrl+P</kbd></button>
      <span class="tabs-divider"></span>
    `;

    this.getCustomDecks().forEach(d => {
      html += tab(d.id, `${d.icon || "📘"} ${this.escapeHtml(d.name)}`, this.getDeckWordCount(d.id));
    });

    html += `
      <button class="notebook-tab" onclick="App.openDeckModal('custom')" style="border-style:dashed; color:var(--accent);">
        ➕ Yeni Özel Defter
      </button>
    `;

    bar.innerHTML = html;
  },

  // Mükerrer Kelime Tespiti (Daha önce başka bir günde veya defterde eklenmiş mi?)
  findExistingWord(term, excludeId = null) {
    const clean = (term || "").trim().toLowerCase();
    if (!clean || clean.length < 2) return null;
    const head = clean.replace(/\s+(to|with|of|in|on|for|at|from|about|by|into|over)$/i, "").trim();
    return this.state.words.find(w => {
      if (excludeId && w.id === excludeId) return false;
      const wTerm = (w.term || "").trim().toLowerCase();
      const wHead = wTerm.replace(/\s+(to|with|of|in|on|for|at|from|about|by|into|over)$/i, "").trim();
      return wTerm === clean || (head.length >= 3 && wHead === head);
    }) || null;
  },

  checkQuickEntryDuplicate(val) {
    const banner = document.getElementById("qe-duplicate-banner");
    if (!banner) return;
    const found = this.findExistingWord(val);
    if (!found) {
      banner.style.display = "none";
      banner.innerHTML = "";
      return;
    }
    const deck = this.state.decks.find(d => d.id === found.deckId);
    const deckLabel = deck ? deck.name : "Genel Paket";
    banner.style.display = "block";
    banner.innerHTML = `
      <div class="duplicate-alert-banner">
        <div>
          ⚠️ <b>"${this.escapeHtml(found.term)}"</b> kelimesi zaten <b>${this.escapeHtml(deckLabel)}</b> içinde kayıtlı!
          <span style="color:var(--success); font-weight:700; margin-left:6px;">(🇹🇷 ${this.escapeHtml(found.meaning)})</span>
        </div>
        <div style="display:flex; gap:6px;">
          <button type="button" class="btn btn-primary btn-sm" onclick="App.bumpExistingWordReview('${found.id}')">🎯 Bugünkü Tekrara Çek</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="App.openWordModal('${found.id}')">✏️ Mevcut Kelimeyi Aç</button>
        </div>
      </div>
    `;
  },

  checkWordModalDuplicate(val) {
    const banner = document.getElementById("wm-duplicate-banner");
    if (!banner) return;
    const editId = document.getElementById("wm-id")?.value || null;
    const found = this.findExistingWord(val, editId);
    if (!found) {
      banner.style.display = "none";
      banner.innerHTML = "";
      return;
    }
    const deck = this.state.decks.find(d => d.id === found.deckId);
    const deckLabel = deck ? deck.name : "Genel Paket";
    banner.style.display = "block";
    banner.innerHTML = `
      <div class="duplicate-alert-banner">
        <div>
          ⚠️ <b>"${this.escapeHtml(found.term)}"</b> zaten <b>${this.escapeHtml(deckLabel)}</b> içinde var (🇹🇷 ${this.escapeHtml(found.meaning)}).
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="App.openWordModal('${found.id}')">✏️ Mevcut Kaydı Düzenle</button>
      </div>
    `;
  },

  bumpExistingWordReview(wordId) {
    const w = this.state.words.find(item => item.id === wordId);
    if (!w) return;
    w.nextReview = Date.now();
    w.status = "learning";
    this.saveState();
    const qeTerm = document.getElementById("qe-term");
    if (qeTerm) qeTerm.value = "";
    this.checkQuickEntryDuplicate("");
    this.toast(`🎯 "${w.term}" tekrar listesinin en başına alındı! Şimdi Akıllı Tekrar (SM-2) modunda çalışabilirsiniz.`);
  },

  // Seçili Defterdeki Kelimelerin Eksik Okunuş, Cümle ve Akademik Eş Anlamlılarını Tek Tıkla Tamamla
  async enrichMissingWordsInCurrentDeck() {
    const words = this.getActiveWords();
    if (!words.length) {
      this.toast("⚠️ Seçili defterde kelime bulunmuyor.");
      return;
    }

    const slangRe = /\b(bitch|bellyache|monkey business|hanky-panky|spooky|scary|creepy|shivering|shivery|beef|crab|squawk|holler|gripe|whine)\b/i;
    const targets = words.filter(w =>
      !w.phonetic ||
      !w.example ||
      !w.exampleTr ||
      !w.synonyms ||
      slangRe.test(w.synonyms || "") ||
      /\s+(to|with|of|in|on|for|at|from|about)$/i.test(w.term || "")
    );

    if (targets.length === 0) {
      this.toast("✅ Bu defterdeki tüm kelimelerin okunuş, örnek cümle ve eş anlamlıları zaten tam!");
      return;
    }

    const btn = document.getElementById("enrich-deck-btn");
    const origText = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `⏳ Tamamlanıyor (0/${targets.length})...`;
    }

    let updatedCount = 0;
    for (let i = 0; i < targets.length; i++) {
      const w = targets[i];
      if (btn) btn.innerHTML = `⏳ Tamamlanıyor (${i + 1}/${targets.length})...`;
      try {
        const data = await this.lookupWordData(w.term, "en-tr");
        if (data) {
          if (data.phonetic && !w.phonetic) w.phonetic = data.phonetic;
          if (data.pos && (!w.pos || w.pos === "noun")) w.pos = data.pos;
          if (Array.isArray(data.synonyms) && data.synonyms.length > 0 && (!w.synonyms || slangRe.test(w.synonyms))) {
            w.synonyms = data.synonyms.slice(0, 5).join(", ");
          }
          if (data.example && !w.example) w.example = data.example;
          if (data.exampleTr && !w.exampleTr) w.exampleTr = data.exampleTr;
          updatedCount++;
        }
      } catch (_) {}
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origText;
    }

    this.saveState();
    this.renderNotebook();
    this.toast(`✨ ${updatedCount} kelimenin eksik okunuş, örnek cümle ve akademik eş anlamlıları tamamlandı!`);
  },

  async quickEntryAutoTranslate() {
    const termInput = document.getElementById("qe-term");
    const meaningInput = document.getElementById("qe-meaning");
    const exampleInput = document.getElementById("qe-example");
    const btn = document.getElementById("qe-auto-btn");

    const term = (termInput?.value || "").trim();
    if (!term) {
      this.toast("⚠️ Önce İngilizce kelimeyi yazın.");
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = "⏳...";
    }

    const data = await this.lookupWordData(term, "en-tr");
    this.quickEntryMeta = data;

    if (btn) {
      btn.disabled = false;
      btn.textContent = "✨ Oto-Çevir";
    }

    if (data.meaning && meaningInput) meaningInput.value = data.meaning;
    if (data.example && exampleInput && !exampleInput.value) exampleInput.value = data.example;

    this.speak(term);
    meaningInput?.focus();
  },

  async quickEntrySave() {
    const termInput = document.getElementById("qe-term");
    const meaningInput = document.getElementById("qe-meaning");
    const exampleInput = document.getElementById("qe-example");

    const term = (termInput?.value || "").trim();
    let meaning = (meaningInput?.value || "").trim();
    let example = (exampleInput?.value || "").trim();

    if (!term) {
      this.toast("⚠️ Lütfen İngilizce kelimeyi yazın.");
      return;
    }

    // Eğer kullanıcı Türkçe anlamı boş bırakıp doğrudan Enter'a bastıysa otomatik sözlükten çekip kaydet!
    let meta = this.quickEntryMeta && this.quickEntryMeta.term?.toLowerCase() === term.toLowerCase()
      ? this.quickEntryMeta
      : null;

    if (!meaning) {
      meta = await this.lookupWordData(term, "en-tr");
      meaning = meta.meaning || "";
      if (!example && meta.example) example = meta.example;
    }

    if (!meaning) {
      this.toast("⚠️ Türkçe anlam bulunamadı, lütfen Türkçe anlamını yazın.");
      meaningInput?.focus();
      return;
    }

    // Hangi deftere kaydedilecek? Genel Paket / çoklu gün seçiliyse bugünün günlük defterine kaydet
    const targetDeckId = this.getQuickEntryTargetDeckId();

    const newWord = {
      id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      deckId: targetDeckId,
      term,
      meaning,
      phonetic: meta?.phonetic || "",
      pos: meta?.pos || "noun",
      synonyms: Array.isArray(meta?.synonyms) ? meta.synonyms.slice(0, 5).join(", ") : "",
      example,
      exampleTr: meta?.exampleTr || "",
      mnemonic: meta?.mnemonic || "",
      createdAt: this.getTodayStr(),
      favorite: false,
      repetitions: 0,
      interval: 0,
      easeFactor: 2.5,
      nextReview: Date.now(),
      correctCount: 0,
      wrongCount: 0,
      status: "new"
    };

    this.state.words.unshift(newWord);
    this.quickEntryMeta = null;

    if (termInput) termInput.value = "";
    if (meaningInput) meaningInput.value = "";
    if (exampleInput) exampleInput.value = "";
    this.checkQuickEntryDuplicate("");

    this.saveState();
    this.populateDeckSelectors();
    this.renderNotebook();
    this.speak(term);

    const deckObj = this.state.decks.find(d => d.id === targetDeckId);
    this.toast(`✅ "${term}" ➔ ${deckObj ? deckObj.name : "Deftere"} eklendi!`);
    termInput?.focus();
  },

  setNotebookFilter(filter, btnEl) {
    this.state.notebookFilter = filter;
    document.querySelectorAll("#view-notebook .filter-pill").forEach(b => b.classList.remove("active"));
    if (btnEl) btnEl.classList.add("active");
    this.renderNotebook();
  },

  renderNotebook() {
    this.renderNotebookTabs();
    const deck = this.getSelectedDeckObject();
    const titleEl = document.getElementById("notebook-view-title");
    const subEl = document.getElementById("notebook-view-subtitle");
    const targetLabel = document.getElementById("quick-entry-target-label");
    const delBtn = document.getElementById("delete-current-deck-btn");
    const editBtn = document.getElementById("edit-current-deck-btn");

    if (titleEl) titleEl.textContent = `${deck.icon || "📓"} ${deck.name}`;
    if (subEl) subEl.textContent = deck.description || "Bu defterdeki kelimeler diğer defterlerle karışmadan çalışılır.";
    if (targetLabel) {
      const targetDeck = this.state.decks.find(d => d.id === this.getQuickEntryTargetDeckId());
      targetLabel.textContent = `⚡ Hızlı Kelime Yaz — Hedef Defter: ${targetDeck ? targetDeck.name : "Bugünün Günlük Defteri"}`;
    }
    const isVirtual = this.isVirtualSelection(deck.id);
    if (delBtn) delBtn.style.display = isVirtual ? "none" : "inline-flex";
    if (editBtn) editBtn.style.display = isVirtual ? "none" : "inline-flex";

    const listEl = document.getElementById("notebook-words-list");
    if (!listEl) return;

    const searchQ = (document.getElementById("notebook-search")?.value || "").trim().toLowerCase();
    let words = [...this.getActiveWords()];

    if (this.state.notebookFilter === "due") {
      const now = Date.now();
      words = words.filter(w => !w.nextReview || w.nextReview <= now);
    } else if (this.state.notebookFilter === "fav") {
      words = words.filter(w => w.favorite);
    } else if (["new", "learning", "mastered"].includes(this.state.notebookFilter)) {
      if (this.state.notebookFilter === "mastered") {
        words = words.filter(w => w.status === "mastered" || w.status === "familiar");
      } else {
        words = words.filter(w => (w.status || "new") === this.state.notebookFilter);
      }
    }

    if (searchQ) {
      words = words.filter(w =>
        (w.term || "").toLowerCase().includes(searchQ) ||
        (w.meaning || "").toLowerCase().includes(searchQ) ||
        (w.example || "").toLowerCase().includes(searchQ) ||
        (w.synonyms || "").toLowerCase().includes(searchQ)
      );
    }

    if (words.length === 0) {
      listEl.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding: 44px 20px; background:var(--bg-card); border-radius:var(--radius-lg); border:1px dashed var(--border-color);">
          <div style="font-size:40px; margin-bottom:10px;">📝</div>
          <h3>"${this.escapeHtml(deck.name)}" içinde henüz kelime yok</h3>
          <p style="color:var(--text-secondary); margin: 8px auto 16px; max-width:520px;">
            Yukarıdaki <b>⚡ Hızlı Kelime Yaz</b> çubuğundan bugünün kelimelerini saniyeler içinde alt alta ekleyebilir ve diğer kelimeler karışmadan sadece bu deftere çalışabilirsiniz!
          </p>
          <button class="btn btn-primary" onclick="document.getElementById('qe-term')?.focus()">⚡ Hemen İlk Kelimeyi Yaz</button>
        </div>
      `;
      return;
    }

    const deckMap = {};
    this.state.decks.forEach(d => (deckMap[d.id] = d));

    const statusLabels = {
      new: "Yeni",
      learning: "Öğreniliyor",
      familiar: "Tanıdık",
      mastered: "Uzmanlaşıldı"
    };

    listEl.innerHTML = words.map(w => {
      const dObj = deckMap[w.deckId] || { name: "Genel", icon: "📘" };
      const st = w.status || "new";
      const safeTerm = this.escapeAttr(w.term);
      return `
        <div class="word-card">
          <div class="word-card-top">
            <div>
              <div class="word-term-group">
                <span class="word-term">${this.escapeHtml(w.term)}</span>
                ${w.phonetic ? `<span class="word-phonetic">${this.escapeHtml(w.phonetic)}</span>` : ""}
                ${w.pos ? `<span class="pos-badge">${this.escapeHtml(w.pos)}</span>` : ""}
              </div>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn-icon" title="Sesli Dinle (Telaffuz)" onclick="App.speak('${safeTerm}')">🔊</button>
              <button class="btn-icon mic-btn" title="Mikrofonla Telaffuzunu Test Et" onclick="App.practicePronunciation('${safeTerm}', this)">🎙️</button>
              <button class="btn-icon" title="Favorilere Ekle/Çıkar" onclick="App.toggleFavorite('${w.id}')">
                ${w.favorite ? "⭐" : "☆"}
              </button>
              <button class="btn-icon" title="Düzenle / Başka Deftere Taşı" onclick="App.openWordModal('${w.id}')">✏️</button>
              <button class="btn-icon" title="Sil" onclick="App.deleteWord('${w.id}')">🗑️</button>
            </div>
          </div>

          <div class="word-meaning">${this.escapeHtml(w.meaning)}</div>

          ${w.synonyms ? `<div style="font-size:12px; color:var(--text-secondary);"><b>Eş Anlam:</b> ${this.escapeHtml(w.synonyms)}</div>` : ""}

          ${w.example ? `
            <div class="word-example">
              "${this.escapeHtml(w.example)}"
              <button class="btn-icon" style="width:22px; height:22px; font-size:11px; margin-left:6px; vertical-align:middle;" title="Cümleyi Dinle" onclick="App.speak('${this.escapeAttr(w.example)}')">🔊</button>
              ${w.exampleTr ? `<span class="word-example-tr">🇹🇷 ${this.escapeHtml(w.exampleTr)}</span>` : ""}
            </div>
          ` : ""}

          ${w.mnemonic ? `
            <div class="word-mnemonic">
              <span>💡</span>
              <span><b>İpucu:</b> ${this.escapeHtml(w.mnemonic)}</span>
            </div>
          ` : ""}

          <div class="word-card-footer">
            <span style="cursor:pointer;" onclick="App.selectDeck('${w.deckId}', true)" title="Sadece bu deftere geç">
              ${dObj.icon || "📘"} ${this.escapeHtml(dObj.name)}
            </span>
            <span class="status-dot status-${st}">${statusLabels[st] || "Yeni"}</span>
          </div>
        </div>
      `;
    }).join("");
  },

  deleteCurrentDeck() {
    const deckId = this.state.selectedDeckId;
    if (deckId === "all") return;
    const deck = this.state.decks.find(d => d.id === deckId);
    if (!deck) return;

    const wordCount = this.state.words.filter(w => w.deckId === deckId).length;
    const confirmMsg = wordCount > 0
      ? `"${deck.name}" defterini ve içindeki ${wordCount} kelimeyi silmek istediğinize emin misiniz?`
      : `"${deck.name}" defterini silmek istediğinize emin misiniz?`;

    if (!window.confirm(confirmMsg)) return;

    this.state.decks = this.state.decks.filter(d => d.id !== deckId);
    this.state.words = this.state.words.filter(w => w.deckId !== deckId);
    this.state.selectedDeckId = "all";
    this.ensureDefaultAndDailyDecks();
    this.saveState();
    this.populateDeckSelectors();
    this.renderNotebook();
    this.toast(`🗑️ "${deck.name}" silindi.`);
  },

  toggleFavorite(wordId) {
    const w = this.state.words.find(item => item.id === wordId);
    if (w) {
      w.favorite = !w.favorite;
      this.saveState();
      this.renderNotebook();
    }
  },

  deleteWord(wordId) {
    const idx = this.state.words.findIndex(item => item.id === wordId);
    if (idx !== -1) {
      const removed = this.state.words[idx];
      this.state.words.splice(idx, 1);
      this.saveState();
      this.renderNotebook();
      this.toast(`🗑️ "${removed.term}" defterden silindi.`);
    }
  },

  // Boş Defter Uyarısı Yardımcı Şablonu
  getEmptyDeckStudyHtml() {
    const deck = this.getSelectedDeckObject();
    return `
      <div class="study-box" style="text-align:center; padding:44px 24px;">
        <div style="font-size:48px; margin-bottom:10px;">📭</div>
        <h3>"${this.escapeHtml(deck.name)}" içinde henüz kelime bulunmuyor</h3>
        <p style="color:var(--text-secondary); max-width:480px; margin:10px auto 20px;">
          Şu an izole defter modundasınız (diğer defterlerin kelimeleri buraya karışmaz). Çalışmaya başlamak için bu deftere birkaç kelime ekleyin veya başka bir deftere geçin.
        </p>
        <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="App.navigate('notebook'); setTimeout(()=>document.getElementById('qe-term')?.focus(), 80);">
            ✍️ Bu Deftere Hızlı Kelime Yaz
          </button>
          <button class="btn btn-secondary" onclick="App.openGeneralPackage()">
            🌍 Genel Kelime Paketine Geç
          </button>
        </div>
      </div>
    `;
  },

  // 3. CANLI İNGİLİZCE-TÜRKÇE SÖZLÜK MOTORU
  setDictDirection(dir) {
    this.dictDirection = dir;
    document.getElementById("dict-dir-entr")?.classList.toggle("active", dir === "en-tr");
    document.getElementById("dict-dir-tren")?.classList.toggle("active", dir === "tr-en");
  },

  quickLookupFromTopbar() {
    const input = document.getElementById("top-dict-input");
    const q = (input?.value || "").trim();
    if (!q) return;
    this.navigate("dictionary");
    const dictInput = document.getElementById("dict-query-input");
    if (dictInput) dictInput.value = q;
    this.performDictionarySearch(q);
  },

  quickDictWord(word, switchTab = true) {
    if (switchTab) this.navigate("dictionary");
    const dictInput = document.getElementById("dict-query-input");
    if (dictInput) dictInput.value = word;
    this.performDictionarySearch(word);
  },

  async lookupWordData(query, direction = "en-tr") {
    const clean = query.trim();
    const lower = clean.toLowerCase();

    const builtin = (window.BUILTIN_DICTIONARY || []).find(
      item => item.term.toLowerCase() === lower || (direction === "tr-en" && item.meaning.toLowerCase().includes(lower))
    );

    const result = {
      term: builtin ? builtin.term : clean,
      phonetic: builtin ? builtin.phonetic : "",
      audio: "",
      pos: builtin ? builtin.pos : "noun",
      meaning: builtin ? builtin.meaning : "",
      alternatives: [],
      definitions: [],
      synonyms: builtin ? [...(builtin.synonyms || [])] : [],
      antonyms: builtin ? [...(builtin.antonyms || [])] : [],
      example: builtin ? builtin.example : "",
      exampleTr: builtin ? builtin.exampleTr : "",
      mnemonic: builtin ? builtin.mnemonic : ""
    };

    // 1.Masaüstü Python Çok Katmanlı Sözlük API'si (/api/dictionary)
    try {
      const apiRes = await fetch(`/api/dictionary?q=${encodeURIComponent(clean)}&dir=${direction}`);
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data && data.ok) {
          const trans = data.translation || {};
          const en = data.englishDetails || {};

          if (direction === "tr-en" && trans.primary) {
            result.term = trans.primary;
            result.meaning = trans.combinedMeaning || clean;
          } else if (trans.primary && !builtin) {
            result.meaning = trans.primary;
          } else if (trans.primary && !result.meaning) {
            result.meaning = trans.primary;
          }
          if (trans.alternatives && trans.alternatives.length) {
            result.alternatives = trans.alternatives;
          }
          if (en.phonetic && !result.phonetic) result.phonetic = en.phonetic;
          if (en.audio) result.audio = en.audio;
          if (en.pos && !builtin) result.pos = en.pos;
          if (en.definitions && en.definitions.length) {
            result.definitions = en.definitions;
          }
          if (en.synonyms && en.synonyms.length && result.synonyms.length === 0) {
            result.synonyms = en.synonyms;
          }
          if (en.antonyms && en.antonyms.length && result.antonyms.length === 0) {
            result.antonyms = en.antonyms;
          }
          if (en.examples && en.examples.length && !result.example) {
            result.example = en.examples[0];
          }
          if (data.exampleTranslation && !result.exampleTr) {
            result.exampleTr = data.exampleTranslation;
          }
          return result;
        }
      }
    } catch (_) {}

    // 2. Doğrudan Tarayıcı Modu (index.html tek başına açıldıysa): Google GTX dj=1 + Datamuse
    try {
      const sl = direction === "tr-en" ? "tr" : "en";
      const tl = direction === "tr-en" ? "en" : "tr";
      const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&dt=bd&dt=ex&dt=md&dt=ss&dt=rm&dj=1&q=${encodeURIComponent(clean)}`;
      const dmUrl = `https://api.datamuse.com/words?sp=${encodeURIComponent(lower)}&qe=sp&md=dprf&max=1`;

      const [gtxResp, dmResp] = await Promise.allSettled([fetch(gtxUrl), fetch(dmUrl)]);

      if (gtxResp.status === "fulfilled" && gtxResp.value.ok) {
        const gData = await gtxResp.value.json();
        const primary = (gData.sentences || []).map(s => s.trans || "").join("").trim();
        const translit = (gData.sentences || []).find(s => s.src_translit)?.src_translit;
        if (translit && !result.phonetic) result.phonetic = `/${translit.replace(/\//g, "")}/`;

        if (Array.isArray(gData.dict)) {
          result.alternatives = gData.dict.map(d => ({
            pos: d.pos || "kelime",
            meanings: (d.terms || []).slice(0, 8)
          }));
          if (!builtin && gData.dict[0]?.pos) result.pos = gData.dict[0].pos;
        }

        if (direction === "tr-en" && primary) {
          result.term = primary;
          result.meaning = clean;
        } else if (primary && !builtin) {
          const comb = [primary];
          for (const m of (result.alternatives[0]?.meanings || []).slice(0, 3)) {
            if (!comb.some(c => c.toLowerCase() === m.toLowerCase())) comb.push(m);
          }
          result.meaning = comb.join(", ");
        }

        if (Array.isArray(gData.definitions)) {
          const defs = [];
          for (const dg of gData.definitions) {
            for (const e of (dg.entry || []).slice(0, 3)) {
              if (e.gloss) defs.push({ pos: dg.pos || "", definition: e.gloss, example: e.example || "" });
              if (!result.example && e.example) result.example = e.example;
            }
          }
          if (defs.length) result.definitions = defs;
        }

        if (!result.example && Array.isArray(gData.examples?.example) && gData.examples.example[0]?.text) {
          result.example = gData.examples.example[0].text.replace(/<[^>]+>/g, "");
        }

        if (Array.isArray(gData.synsets) && result.synonyms.length === 0) {
          const syns = [];
          for (const sg of gData.synsets) {
            for (const e of sg.entry || []) {
              for (const s of e.synonym || []) {
                if (!syns.includes(s)) syns.push(s);
              }
            }
          }
          result.synonyms = syns.slice(0, 10);
        }
      }

      if (dmResp.status === "fulfilled" && dmResp.value.ok) {
        const dmData = await dmResp.value.json();
        if (Array.isArray(dmData) && dmData[0] && result.definitions.length === 0) {
          const posMap = { n: "noun", v: "verb", adj: "adjective", adv: "adverb" };
          result.definitions = (dmData[0].defs || []).slice(0, 3).map(d => {
            const [p, text] = d.split("\t");
            return { pos: posMap[p] || p, definition: text || d, example: "" };
          });
        }
      }
    } catch (_) {}

    return result;
  },

  async performDictionarySearch(overrideQuery = null) {
    const input = document.getElementById("dict-query-input");
    const query = (overrideQuery !== null ? overrideQuery : input?.value || "").trim();
    if (!query) return;

    const container = document.getElementById("dict-result-container");
    if (!container) return;

    container.innerHTML = `
      <div class="dict-result-card" style="text-align:center; padding:40px;">
        <div style="font-size:28px; margin-bottom:10px;">⏳</div>
        <p style="color:var(--text-secondary);">"<b>${this.escapeHtml(query)}</b>" için İngilizce-Türkçe sözlük taranıyor...</p>
      </div>
    `;

    const res = await this.lookupWordData(query, this.dictDirection);
    this.lastDictResult = res;

    const deck = this.getSelectedDeckObject();
    const targetName = deck.id === "all" ? "Bugünün Günlük Defteri" : deck.name;

    container.innerHTML = `
      <div class="dict-result-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:14px; border-bottom:1px solid var(--border-color); padding-bottom:18px; margin-bottom:18px;">
          <div>
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
              <h2 style="font-size:32px; font-weight:800;">${this.escapeHtml(res.term)}</h2>
              ${res.phonetic ? `<span class="word-phonetic" style="font-size:17px;">${this.escapeHtml(res.phonetic)}</span>` : ""}
              ${res.pos ? `<span class="pos-badge" style="font-size:13px;">${this.escapeHtml(res.pos)}</span>` : ""}
              <button class="btn btn-secondary btn-sm" onclick="App.speak('${this.escapeAttr(res.term)}', 'en-US', '${this.escapeAttr(res.audio)}')">
                🔊 Amerikan (US)
              </button>
              <button class="btn btn-secondary btn-sm" onclick="App.speak('${this.escapeAttr(res.term)}', 'en-GB')">
                🔊 İngiliz (UK)
              </button>
              <button class="btn btn-secondary btn-sm mic-btn" onclick="App.practicePronunciation('${this.escapeAttr(res.term)}', this)">
                🎙️ Telaffuzumu Test Et
              </button>
            </div>
            <div style="font-size:22px; font-weight:800; color:var(--success); margin-top:10px;">
              🇹🇷 ${this.escapeHtml(res.meaning || "Anlam bulunamadı")}
            </div>
          </div>

          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="App.addLastDictResultToNotebook()">
              ➕ "${this.escapeHtml(targetName)}" İçine Ekle
            </button>
          </div>
        </div>

        ${res.alternatives && res.alternatives.length ? `
          <div style="margin-bottom:18px;">
            <h4 style="font-size:13.5px; color:var(--text-secondary); margin-bottom:8px;">📚 Kelime Türüne Göre Türkçe Karşılıklar:</h4>
            <div style="display:grid; gap:8px;">
              ${res.alternatives.map(alt => `
                <div style="background:var(--bg-secondary); padding:10px 14px; border-radius:var(--radius-sm);">
                  <span class="pos-badge" style="margin-right:8px;">${this.escapeHtml(alt.pos)}</span>
                  <span style="font-size:14px;">${this.escapeHtml((alt.meanings || []).join(", "))}</span>
                </div>
              `).join("")}
            </div>
          </div>
        ` : ""}

        ${res.example ? `
          <div style="margin-bottom:18px;">
            <h4 style="font-size:13.5px; color:var(--text-secondary); margin-bottom:8px;">💬 Örnek Cümle:</h4>
            <div class="word-example" style="font-size:15px;">
              "${this.escapeHtml(res.example)}"
              <button class="btn-icon" style="width:26px; height:26px; font-size:12px; margin-left:8px;" onclick="App.speak('${this.escapeAttr(res.example)}')">🔊</button>
              ${res.exampleTr ? `<span class="word-example-tr" style="font-size:13.5px; margin-top:5px;">🇹🇷 ${this.escapeHtml(res.exampleTr)}</span>` : ""}
            </div>
          </div>
        ` : ""}

        ${res.mnemonic ? `
          <div style="margin-bottom:18px;">
            <div class="word-mnemonic" style="font-size:13.5px;">
              <span>💡</span>
              <span><b>Hafıza Çivisi (Mnemonic):</b> ${this.escapeHtml(res.mnemonic)}</span>
            </div>
          </div>
        ` : ""}

        ${res.definitions && res.definitions.length ? `
          <div style="margin-bottom:18px;">
            <h4 style="font-size:13.5px; color:var(--text-secondary); margin-bottom:8px;">🇬🇧 İngilizce Sözlük Tanımları (English Definitions):</h4>
            <div style="display:grid; gap:8px;">
              ${res.definitions.slice(0, 4).map(d => `
                <div style="background:var(--bg-secondary); padding:10px 14px; border-radius:var(--radius-sm); font-size:13.5px;">
                  <span class="pos-badge" style="margin-right:6px;">${this.escapeHtml(d.pos)}</span>
                  <span>${this.escapeHtml(d.definition)}</span>
                  ${d.example ? `<div style="color:var(--text-muted); margin-top:4px; font-style:italic;">Örn: "${this.escapeHtml(d.example)}"</div>` : ""}
                </div>
              `).join("")}
            </div>
          </div>
        ` : ""}

        ${res.synonyms && res.synonyms.length ? `
          <div style="margin-bottom:14px;">
            <h4 style="font-size:13.5px; color:var(--text-secondary);">🔗 Eş Anlamlılar (Tıklayarak Ara):</h4>
            <div class="chip-list">
              ${res.synonyms.map(s => `<span class="word-chip" onclick="App.quickDictWord('${this.escapeAttr(s)}')">${this.escapeHtml(s)}</span>`).join("")}
            </div>
          </div>
        ` : ""}

        ${res.antonyms && res.antonyms.length ? `
          <div>
            <h4 style="font-size:13.5px; color:var(--text-secondary);">⚖️ Zıt Anlamlılar (Antonyms):</h4>
            <div class="chip-list">
              ${res.antonyms.map(a => `<span class="word-chip" style="border-color:rgba(239,68,68,0.3); color:var(--danger);" onclick="App.quickDictWord('${this.escapeAttr(a)}')">${this.escapeHtml(a)}</span>`).join("")}
            </div>
          </div>
        ` : ""}
      </div>
    `;
  },

  addLastDictResultToNotebook() {
    if (!this.lastDictResult) return;
    this.openWordModal(null, this.lastDictResult);
  },

  // 4. SM-2 ARALIKLI TEKRAR SİSTEMİ & GÜNLER ARASI AKILLI TEKRAR KOÇU
  setSRSScope(scope) {
    this.srsScope = scope;
    document.getElementById("srs-scope-global")?.classList.toggle("active", scope === "global");
    document.getElementById("srs-scope-deck")?.classList.toggle("active", scope === "deck");
    this.startSRS(false);
  },

  startCustomSRSSession(mode, targetDeckId = null) {
    if (mode === "deck" && targetDeckId) {
      this.state.selectedDeckId = targetDeckId;
      this.srsScope = "deck";
      this.saveState();
      this.populateDeckSelectors();
      this.navigate("srs");
      return;
    }
    this.srsScope = "global";
    this.navigate("srs");
    if (mode === "past") {
      const { pastDueWords } = this.getGlobalDueBreakdown();
      if (pastDueWords.length > 0) {
        this.srsQueue = [...pastDueWords];
        this.srsIndex = 0;
        this.srsFlipped = false;
        this.renderSRSPlanSummary();
        this.renderSRSCard();
      }
    } else if (mode === "all") {
      this.startSRS(true);
    }
  },

  renderSRSPlanSummary() {
    const planEl = document.getElementById("srs-plan-summary");
    if (!planEl) return;

    document.getElementById("srs-scope-global")?.classList.toggle("active", this.srsScope === "global");
    document.getElementById("srs-scope-deck")?.classList.toggle("active", this.srsScope === "deck");

    const { allDue, pastDueWords, todayWords, pastGroups } = this.getGlobalDueBreakdown();
    const deck = this.getSelectedDeckObject();

    if (this.srsScope === "deck" && deck.id !== "all") {
      const deckPool = this.getActiveWords();
      const deckDue = this.getDueWords(deckPool);
      planEl.innerHTML = `
        <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:12px 18px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
          <div style="font-size:13.5px;">
            📓 <b>Sadece Seçili Defter Modu:</b> "${this.escapeHtml(deck.name)}" içinde <b>${deckDue.length}</b> kelime tekrar bekliyor (Toplam ${deckPool.length} kelime).
          </div>
          ${pastDueWords.length > 0 ? `
            <button class="btn btn-secondary btn-sm" onclick="App.setSRSScope('global')">
              🌍 Önceki Günlerden Bekleyen ${pastDueWords.length} Kelimeye Geç
            </button>
          ` : ""}
        </div>
      `;
      return;
    }

    if (allDue.length === 0) {
      planEl.innerHTML = "";
      return;
    }

    const dayBadges = pastGroups.slice(0, 5).map(g =>
      `<span class="word-chip" onclick="App.startCustomSRSSession('deck', '${g.deckId}')" title="Sadece bu günün bekleyen kelimelerini çalış">${this.escapeHtml(g.badge)}: <b>${g.words.length} kelime</b></span>`
    ).join("");

    planEl.innerHTML = `
      <div style="background:var(--bg-card); border:1px solid var(--border-highlight); border-radius:var(--radius-lg); padding:14px 18px; display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div style="font-size:13.5px;">
            🧠 <b>Akıllı Tekrar Sırası:</b>
            ${pastDueWords.length > 0
              ? `Önce geçmiş günlerden tekrar zamanı gelen <b>${pastDueWords.length} kelime</b>, ardından bugün eklenen <b>${todayWords.length} yeni kelime</b> soruluyor.`
              : `Bugün eklenen <b>${todayWords.length} kelime</b> çalışılıyor.`}
          </div>
          ${pastDueWords.length > 0 && todayWords.length > 0 ? `
            <button class="btn btn-secondary btn-sm" onclick="App.startCustomSRSSession('past')">
              ⏪ Sadece Önceki Günleri Sor (${pastDueWords.length})
            </button>
          ` : ""}
        </div>
        ${dayBadges ? `<div class="chip-list" style="margin-top:2px;">${dayBadges}</div>` : ""}
      </div>
    `;
  },

  startSRS(forceAll = false) {
    this.renderSRSPlanSummary();
    const useGlobal = this.srsScope === "global";
    const pool = useGlobal ? this.state.words : this.getActiveWords();

    if (pool.length === 0) {
      const container = document.getElementById("srs-stage-container");
      if (container) container.innerHTML = this.getEmptyDeckStudyHtml();
      return;
    }

    if (forceAll) {
      this.srsQueue = this.shuffleArray([...pool]);
    } else if (useGlobal) {
      // Önce geçmiş günlerin tekrar zamanı gelmiş kelimeleri, sonra bugünün yeni kelimeleri
      const { pastDueWords, todayWords } = this.getGlobalDueBreakdown();
      this.srsQueue = [...this.shuffleArray(pastDueWords), ...this.shuffleArray(todayWords)];
    } else {
      const due = this.getDueWords(pool);
      this.srsQueue = this.shuffleArray(due);
    }

    this.srsIndex = 0;
    this.srsFlipped = false;
    this.renderSRSCard();
  },

  getWordOriginLabel(w) {
    const today = this.getTodayStr();
    const yesterday = this.addDaysIso(today, -1);
    const deck = this.state.decks.find(d => d.id === w.deckId);
    const iso = deck && deck.type === "daily" ? this.getDeckDate(deck) : (w.createdAt || "");
    if (iso) {
      if (iso === today) return "⭐ Bugünün Kelimesi";
      if (iso === yesterday) return `🕘 Dünün Kelimesi (${this.formatTurkishDate(iso)})`;
      const diff = Math.round((this.dateFromIso(today) - this.dateFromIso(iso)) / 86400000);
      return diff > 1
        ? `📅 ${diff} Gün Önceki Defter (${this.formatTurkishDate(iso)})`
        : `📅 ${this.formatTurkishDate(iso)}`;
    }
    return deck ? `${deck.icon || "📘"} ${deck.name}` : "🌍 Genel Paket";
  },

  renderSRSCard() {
    const container = document.getElementById("srs-stage-container");
    const badge = document.getElementById("srs-counter-badge");
    if (!container) return;

    const pool = this.srsScope === "global" ? this.state.words : this.getActiveWords();
    if (pool.length === 0) {
      container.innerHTML = this.getEmptyDeckStudyHtml();
      return;
    }

    const remaining = this.srsQueue.length - this.srsIndex;
    if (badge) badge.textContent = `${Math.max(0, remaining)} Kelime Kaldı`;

    if (this.srsIndex >= this.srsQueue.length) {
      const scopeName = this.srsScope === "global" ? "Tüm Günler" : this.getSelectedDeckObject().name;
      container.innerHTML = `
        <div class="study-box" style="text-align:center; padding:48px 28px;">
          <div style="font-size:54px; margin-bottom:12px;">🎉</div>
          <h2 style="margin-bottom:8px;">"${this.escapeHtml(scopeName)}" İçin Bekleyen Tüm Tekrarları Bitirdin!</h2>
          <p style="color:var(--text-secondary); max-width:500px; margin:0 auto 24px;">
            Unutma eğrisine göre bugün tekrar edilmesi gereken tüm kelimeleri tamamladın. İstersen tüm kelimelerle ekstra tur yapabilir veya diğer modlara geçebilirsin.
          </p>
          <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="App.startSRS(true)">🔄 Tüm Kelimelerle Serbest Tekrar</button>
            <button class="btn btn-secondary" onclick="App.navigate('cloze')">🧩 Cümle Tamamlama Moduna Geç</button>
            <button class="btn btn-secondary" onclick="App.navigate('write')">✍️ Yazarak Çalış</button>
          </div>
        </div>
      `;
      return;
    }

    const w = this.srsQueue[this.srsIndex];
    const safeTerm = this.escapeAttr(w.term);
    const originLabel = this.getWordOriginLabel(w);

    const nextHard = Math.max(1, Math.round((w.interval || 1) * 1.2));
    const nextGood = w.repetitions === 0 ? 1 : w.repetitions === 1 ? 3 : Math.round((w.interval || 3) * (w.easeFactor || 2.5));
    const nextEasy = w.repetitions === 0 ? 4 : Math.round((w.interval || 4) * (w.easeFactor || 2.5) * 1.3);

    container.innerHTML = `
      <div class="flashcard-stage">
        <div style="width:100%; display:flex; justify-content:space-between; align-items:center; font-size:13px; color:var(--text-secondary);">
          <span>Sıradaki: <b>${this.srsIndex + 1} / ${this.srsQueue.length}</b></span>
          <span class="pos-badge" style="background:var(--warning-soft); color:var(--warning); font-size:12px;">${this.escapeHtml(originLabel)}</span>
        </div>

        <div class="flashcard-scene" onclick="App.flipSRSCard()">
          <div class="flashcard-3d ${this.srsFlipped ? "is-flipped" : ""}" id="srs-card-3d">
            <div class="flashcard-face">
              <span class="card-face-label">🇬🇧 İNGİLİZCE KELİME (SM-2 AKILLI TEKRAR)</span>
              <div class="card-face-actions" onclick="event.stopPropagation()">
                <button class="btn-icon mic-btn" onclick="App.practicePronunciation('${safeTerm}', this)" title="Mikrofonla Telaffuzunu Test Et">🎙️</button>
                <button class="btn-icon" onclick="App.speak('${safeTerm}')" title="Telaffuzu Dinle">🔊</button>
              </div>
              <div class="card-main-word">${this.escapeHtml(w.term)}</div>
              ${w.phonetic ? `<div class="card-phonetic">${this.escapeHtml(w.phonetic)}</div>` : ""}
              ${w.pos ? `<span class="pos-badge" style="font-size:13px;">${this.escapeHtml(w.pos)}</span>` : ""}
              <span class="card-flip-hint">👆 Cevabı görmek için tıkla veya Boşluk (Space) tuşuna bas (1-4 ile puanla)</span>
            </div>

            <div class="flashcard-face flashcard-back">
              <span class="card-face-label">🇹🇷 TÜRKÇE ANLAMI & BAĞLAM</span>
              <div class="card-face-actions" onclick="event.stopPropagation()">
                <button class="btn-icon" onclick="App.speak('${safeTerm}')" title="Kelimeyi Dinle">🔊</button>
              </div>
              <div class="card-meaning-big">${this.escapeHtml(w.meaning)}</div>
              ${w.synonyms ? `<div style="font-size:13px; color:var(--text-secondary); margin-bottom:8px;"><b>Eş Anlam:</b> ${this.escapeHtml(w.synonyms)}</div>` : ""}
              ${w.example ? `
                <div class="card-example-box">
                  "${this.escapeHtml(w.example)}"
                  ${w.exampleTr ? `<div style="font-size:12.5px; color:var(--text-muted); margin-top:4px;">🇹🇷 ${this.escapeHtml(w.exampleTr)}</div>` : ""}
                </div>
              ` : ""}
              ${w.mnemonic ? `<div class="word-mnemonic" style="margin-top:10px;">💡 ${this.escapeHtml(w.mnemonic)}</div>` : ""}
            </div>
          </div>
        </div>

        <div class="srs-buttons">
          <button class="srs-btn again" onclick="App.rateSRSCard(0)">
            <span class="srs-time">&lt; 10 dk (1)</span>
            <span class="srs-label">🔴 Hatırlamadım</span>
          </button>
          <button class="srs-btn hard" onclick="App.rateSRSCard(1)">
            <span class="srs-time">${nextHard} gün (2)</span>
            <span class="srs-label">🟠 Zorlandım</span>
          </button>
          <button class="srs-btn good" onclick="App.rateSRSCard(2)">
            <span class="srs-time">${nextGood} gün (3)</span>
            <span class="srs-label">🟢 İyi Hatırladım</span>
          </button>
          <button class="srs-btn easy" onclick="App.rateSRSCard(3)">
            <span class="srs-time">${nextEasy} gün (4)</span>
            <span class="srs-label">🔵 Çok Kolay</span>
          </button>
        </div>
      </div>
    `;
  },

  flipSRSCard() {
    this.srsFlipped = !this.srsFlipped;
    const card = document.getElementById("srs-card-3d");
    if (card) card.classList.toggle("is-flipped", this.srsFlipped);
    const w = this.srsQueue[this.srsIndex];
    if (this.srsFlipped && w && this.fcAutoSpeak) {
      this.speak(w.term);
    }
  },

  rateSRSCard(rating) {
    const w = this.srsQueue[this.srsIndex];
    if (!w) return;

    let reps = w.repetitions || 0;
    let interval = w.interval || 0;
    let ef = w.easeFactor || 2.5;

    if (rating === 0) {
      reps = 0;
      interval = 0;
      w.wrongCount = (w.wrongCount || 0) + 1;
      w.nextReview = Date.now() + 10 * 60 * 1000;
      w.status = "learning";
      this.srsQueue.push(w);
    } else {
      w.correctCount = (w.correctCount || 0) + 1;
      if (rating === 1) {
        interval = Math.max(1, Math.round((interval || 1) * 1.2));
        ef = Math.max(1.3, ef - 0.15);
      } else if (rating === 2) {
        if (reps === 0) interval = 1;
        else if (reps === 1) interval = 3;
        else interval = Math.round(interval * ef);
      } else if (rating === 3) {
        if (reps === 0) interval = 4;
        else interval = Math.round((interval || 3) * ef * 1.3);
        ef = ef + 0.15;
      }
      reps += 1;
      w.nextReview = Date.now() + interval * 86400000;
      if (interval >= 7) w.status = "mastered";
      else if (interval >= 3) w.status = "familiar";
      else w.status = "learning";
    }

    w.repetitions = reps;
    w.interval = interval;
    w.easeFactor = ef;

    this.recordStudyAction();
    this.srsIndex += 1;
    this.srsFlipped = false;
    this.renderSRSCard();
  },

  // 4B. KARMA AKILLI ÖĞRENME DÖNGÜSÜ (QUIZLET LEARN PRO MODU)
  initLearnMode(forceReset = false) {
    const active = this.getActiveWords();
    const container = document.getElementById("learn-container");
    if (!container) return;

    if (active.length === 0) {
      container.innerHTML = this.getEmptyDeckStudyHtml();
      return;
    }

    const activeIds = new Set(active.map(w => w.id));
    const currentPoolMatches = this.learnPool.length > 0 &&
      this.learnPool.every(w => activeIds.has(w.id)) &&
      this.learnPool.length === active.length;

    if (forceReset || !currentPoolMatches) {
      this.learnPool = this.shuffleArray([...active]);
      this.learnStageMap = {};
      this.learnPool.forEach(w => {
        this.learnStageMap[w.id] = 0; // 0: Tanıma (MC) -> 1: Bağlam/Ters MC -> 2: Yazarak Üretim -> 3: Mezun Oldu 🏆
      });
    }

    this.learnAnswered = false;
    this.pickNextLearnQuestion();
    this.renderLearnStep();
  },

  pickNextLearnQuestion() {
    const pending = this.learnPool.filter(w => (this.learnStageMap[w.id] || 0) < 3);
    if (pending.length === 0) {
      this.learnCurrent = null;
      return;
    }
    // Önce daha düşük aşamadaki kelimelerden rastgele seç (aynı kelime üst üste gelmesin)
    pending.sort((a, b) => (this.learnStageMap[a.id] || 0) - (this.learnStageMap[b.id] || 0));
    const candidates = pending.length > 1 && this.learnCurrent
      ? pending.filter(w => w.id !== this.learnCurrent.id).slice(0, 5)
      : pending.slice(0, 5);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)] || pending[0];
    this.learnCurrent = chosen;

    const st = this.learnStageMap[chosen.id] || 0;
    if (st === 0) {
      this.learnStepType = "mc-en-tr";
    } else if (st === 1) {
      this.learnStepType = (chosen.example && chosen.example.trim().length > 6) ? "cloze" : "mc-tr-en";
    } else {
      this.learnStepType = "write";
    }
  },

  renderLearnStep() {
    const container = document.getElementById("learn-container");
    if (!container) return;

    if (this.learnPool.length === 0) {
      container.innerHTML = this.getEmptyDeckStudyHtml();
      return;
    }

    const stageCounts = [0, 0, 0, 0];
    this.learnPool.forEach(w => {
      const s = Math.min(3, Math.max(0, this.learnStageMap[w.id] || 0));
      stageCounts[s]++;
    });

    const totalMasteryPoints = this.learnPool.length * 3;
    const earnedPoints = this.learnPool.reduce((sum, w) => sum + Math.min(3, this.learnStageMap[w.id] || 0), 0);
    const masteryPct = totalMasteryPoints > 0 ? Math.round((earnedPoints / totalMasteryPoints) * 100) : 100;

    const curStage = this.learnCurrent ? (this.learnStageMap[this.learnCurrent.id] || 0) : 3;

    const stagesHeaderHtml = `
      <div style="margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; font-size:12.5px; color:var(--text-secondary); margin-bottom:6px;">
          <span>🎓 Oturum Ustalık İlerlemesi (3 Aşamalı Kalıcı Öğrenme)</span>
          <b>%${masteryPct} Tamamlandı (${stageCounts[3]} / ${this.learnPool.length} Mezun)</b>
        </div>
        <div class="progress-bar-bg" style="height:10px;">
          <div class="progress-bar-fill" style="width:${masteryPct}%;"></div>
        </div>
      </div>
      <div class="learn-stages-bar">
        <div class="learn-stage-card ${curStage === 0 ? "active-stage" : ""}">
          <span>1️⃣ Tanıma (Şıklı)</span>
          <span class="nav-badge" style="background:var(--info-soft); color:var(--info);">${stageCounts[0]}</span>
        </div>
        <div class="learn-stage-card ${curStage === 1 ? "active-stage" : ""}">
          <span>2️⃣ Bağlam & Cümle</span>
          <span class="nav-badge" style="background:var(--warning-soft); color:var(--warning);">${stageCounts[1]}</span>
        </div>
        <div class="learn-stage-card ${curStage === 2 ? "active-stage" : ""}">
          <span>3️⃣ Yazarak Üretim</span>
          <span class="nav-badge" style="background:var(--accent-soft); color:var(--accent);">${stageCounts[2]}</span>
        </div>
        <div class="learn-stage-card ${curStage === 3 ? "active-stage" : ""}">
          <span>🏆 Mezun Oldu</span>
          <span class="nav-badge" style="background:var(--success-soft); color:var(--success);">${stageCounts[3]}</span>
        </div>
      </div>
    `;

    if (!this.learnCurrent) {
      container.innerHTML = `
        ${stagesHeaderHtml}
        <div class="study-box" style="text-align:center; padding:44px 28px;">
          <div style="font-size:56px; margin-bottom:10px;">🎓🏆</div>
          <h2>Tebrikler! Bu Defterdeki ${this.learnPool.length} Kelimenin Tamamı Mezun Oldu!</h2>
          <p style="color:var(--text-secondary); max-width:520px; margin:10px auto 22px;">
            Her kelimeyi önce <b>Çoktan Seçmeli Tanıma</b>, ardından <b>Cümle Bağlamı</b> ve son olarak <b>Yazarak Aktif Üretim</b> aşamalarından geçirerek kalıcı hafızaya kaydettin.
          </p>
          <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="App.initLearnMode(true)">🔄 Döngüyü Baştan Tekrarla</button>
            <button class="btn btn-secondary" onclick="App.navigate('match')">⚡ Eşleştirme Oyununa Geç</button>
          </div>
        </div>
      `;
      return;
    }

    const w = this.learnCurrent;
    const safeTerm = this.escapeAttr(w.term);

    if (this.learnStepType === "mc-en-tr" || this.learnStepType === "mc-tr-en" || this.learnStepType === "cloze") {
      const distractors = this.getDistractorsForWord(w, 3);
      const options = this.shuffleArray([w, ...distractors]);
      let promptHtml = "";
      let stageBadge = "";

      if (this.learnStepType === "mc-en-tr") {
        stageBadge = "Aşama 1/3 • 🔍 Kelimeyi Tanı (İngilizce ➔ Türkçe)";
        promptHtml = `
          <div style="text-align:center; padding:14px 0;">
            <div style="font-size:34px; font-weight:800;">
              🇬🇧 ${this.escapeHtml(w.term)}
              <button class="btn-icon" style="margin-left:8px; vertical-align:middle;" onclick="App.speak('${safeTerm}')" title="Dinle">🔊</button>
              <button class="btn-icon mic-btn" style="margin-left:4px; vertical-align:middle;" onclick="App.practicePronunciation('${safeTerm}', this)" title="Telaffuzunu Test Et">🎙️</button>
            </div>
            ${w.phonetic ? `<div class="word-phonetic" style="margin-top:4px; font-size:16px;">${this.escapeHtml(w.phonetic)}</div>` : ""}
            ${w.pos ? `<span class="pos-badge" style="margin-top:6px; display:inline-block;">${this.escapeHtml(w.pos)}</span>` : ""}
          </div>
        `;
      } else if (this.learnStepType === "cloze") {
        stageBadge = "Aşama 2/3 • 🧩 Bağlam İçinde Boşluğu Tamamla";
        const masked = this.maskWordInSentence(w.example, w.term);
        promptHtml = `
          <div style="font-size:21px; font-weight:700; line-height:1.5; margin:10px 0 12px; padding:16px; background:var(--bg-secondary); border-radius:var(--radius-md); border-left:4px solid var(--accent);">
            "${this.escapeHtml(masked)}"
          </div>
          <div style="font-size:14px; color:var(--success); font-weight:700;">🇹🇷 Anlam İpucu: ${this.escapeHtml(w.meaning)}</div>
          ${w.exampleTr ? `<div style="font-size:12.5px; color:var(--text-muted); margin-top:3px;">💬 Çeviri: "${this.escapeHtml(w.exampleTr)}"</div>` : ""}
        `;
      } else {
        stageBadge = "Aşama 2/3 • 🔄 Türkçe Anlamdan İngilizce Kelimeyi Bul";
        promptHtml = `
          <div style="text-align:center; padding:14px 0;">
            <div style="font-size:28px; font-weight:800; color:var(--success);">🇹🇷 ${this.escapeHtml(w.meaning)}</div>
            ${w.synonyms ? `<div style="font-size:13px; color:var(--text-secondary); margin-top:6px;">🔗 Eş Anlam İpucu: ${this.escapeHtml(w.synonyms)}</div>` : ""}
          </div>
        `;
      }

      const showTrOptions = this.learnStepType === "mc-en-tr";
      container.innerHTML = `
        ${stagesHeaderHtml}
        <div class="study-box">
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:12.5px; color:var(--text-muted); margin-bottom:10px;">
            <span class="pos-badge" style="font-size:12px;">${stageBadge}</span>
            <span>${this.escapeHtml(this.getWordOriginLabel(w))}</span>
          </div>
          ${promptHtml}
          <div class="options-grid" id="learn-options">
            ${options.map((opt, idx) => `
              <button class="option-btn" data-word-id="${opt.id}" onclick="App.answerLearnMC('${opt.id}', this)">
                <span style="color:var(--accent); font-weight:800;">${idx + 1}.</span>
                <span>${this.escapeHtml(showTrOptions ? opt.meaning : opt.term)}</span>
              </button>
            `).join("")}
          </div>
          <div id="learn-feedback" style="margin-top:16px;"></div>
        </div>
      `;
      if (this.learnStepType === "mc-en-tr") this.speak(w.term);
    } else {
      // Aşama 3: Yazarak Aktif Üretim (Mezuniyet Aşaması)
      container.innerHTML = `
        ${stagesHeaderHtml}
        <div class="study-box" style="text-align:center;">
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:12.5px; color:var(--text-muted); margin-bottom:12px;">
            <span class="pos-badge" style="background:var(--success-soft); color:var(--success); font-size:12px;">Aşama 3/3 (Mezuniyet) • ✍️ İngilizce Karşılığını Yaz</span>
            <span>İpucu: ${w.term.length} harf</span>
          </div>
          <div style="font-size:26px; font-weight:800; color:var(--success); margin-bottom:8px;">
            🇹🇷 ${this.escapeHtml(w.meaning)}
          </div>
          ${w.synonyms ? `<div style="font-size:13px; color:var(--text-secondary); margin-bottom:6px;">🔗 Eş Anlam: ${this.escapeHtml(w.synonyms)}</div>` : ""}
          ${w.example ? `<div style="font-size:13.5px; color:var(--text-muted); margin-bottom:8px;">"${this.escapeHtml(this.maskWordInSentence(w.example, w.term))}"</div>` : ""}
          <div style="margin-bottom:8px;">
            <button class="btn btn-secondary btn-sm" onclick="App.speak('${safeTerm}')">🔊 Ses İpucu Dinle</button>
          </div>
          <input
            type="text"
            id="learn-write-input"
            class="write-input"
            placeholder="Kelimenin İngilizcesini yazıp Enter'a basın..."
            autocomplete="off"
            onkeydown="if(event.key==='Enter'){event.preventDefault(); App.answerLearnWrite();}"
          />
          <div style="display:flex; justify-content:center; gap:10px; margin-top:14px;">
            <button class="btn btn-primary" onclick="App.answerLearnWrite()">✅ Kontrol Et & Mezun Et</button>
          </div>
          <div id="learn-feedback" style="margin-top:16px;"></div>
        </div>
      `;
      setTimeout(() => document.getElementById("learn-write-input")?.focus(), 50);
    }
  },

  answerLearnMC(selectedId, btnEl) {
    if (this.learnAnswered || !this.learnCurrent) return;
    this.learnAnswered = true;
    const w = this.learnCurrent;
    const isCorrect = selectedId === w.id;

    document.querySelectorAll("#learn-options .option-btn").forEach(b => {
      b.disabled = true;
      if (b.getAttribute("data-word-id") === w.id) b.classList.add("correct");
    });

    if (isCorrect) {
      btnEl.classList.add("correct");
      this.learnStageMap[w.id] = Math.min(3, (this.learnStageMap[w.id] || 0) + 1);
      w.correctCount = (w.correctCount || 0) + 1;
      if (!w.status || w.status === "new") w.status = "learning";
    } else {
      btnEl.classList.add("wrong");
      this.learnStageMap[w.id] = Math.max(0, (this.learnStageMap[w.id] || 0) - 1);
      w.wrongCount = (w.wrongCount || 0) + 1;
      w.nextReview = Date.now();
    }

    this.speak(w.term);
    this.recordStudyAction();

    if (isCorrect) {
      setTimeout(() => this.nextLearnStep(), 750);
    } else {
      const fb = document.getElementById("learn-feedback");
      if (fb) {
        fb.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-radius:var(--radius-md); background:var(--danger-soft);">
            <span>❌ Doğrusu: <b>${this.escapeHtml(w.term)}</b> — ${this.escapeHtml(w.meaning)} (Bu kelime az sonra tekrar sorulacak)</span>
            <button class="btn btn-primary btn-sm" onclick="App.nextLearnStep()">Devam Et ➡️</button>
          </div>
        `;
      }
    }
  },

  answerLearnWrite() {
    if (this.learnAnswered) {
      this.nextLearnStep();
      return;
    }
    const w = this.learnCurrent;
    if (!w) return;
    const input = document.getElementById("learn-write-input");
    const userVal = (input?.value || "").trim();
    if (!userVal) return;

    this.learnAnswered = true;
    const isCorrect = this.isWriteAnswerMatch(userVal, w, true);
    this.speak(w.term);

    if (isCorrect) {
      this.learnStageMap[w.id] = 3;
      w.correctCount = (w.correctCount || 0) + 1;
      w.status = (w.repetitions || 0) >= 2 ? "mastered" : "familiar";
      w.repetitions = (w.repetitions || 0) + 1;
      w.interval = Math.max(3, w.interval || 3);
      w.nextReview = Date.now() + w.interval * 86400000;
    } else {
      this.learnStageMap[w.id] = 1; // Bağlam aşamasına geri çek
      w.wrongCount = (w.wrongCount || 0) + 1;
      w.nextReview = Date.now();
    }

    this.recordStudyAction();

    const fb = document.getElementById("learn-feedback");
    if (fb) {
      fb.innerHTML = `
        <div style="padding:14px; border-radius:var(--radius-md); background:${isCorrect ? "var(--success-soft)" : "var(--danger-soft)"};">
          <div style="font-size:16px; font-weight:700; color:${isCorrect ? "var(--success)" : "var(--danger)"};">
            ${isCorrect
              ? `🏆 Harika! "${this.escapeHtml(w.term)}" kelimesi bu oturumdan MEZUN OLDU!`
              : `❌ Doğru yazılışı: "${this.escapeHtml(w.term)}" (Pekiştirme için tekrar sorulacak)`}
          </div>
          <button class="btn btn-primary btn-sm" style="margin-top:10px;" onclick="App.nextLearnStep()">Sonraki Adım (Enter) ➡️</button>
        </div>
      `;
    }
  },

  nextLearnStep() {
    this.learnAnswered = false;
    this.pickNextLearnQuestion();
    this.renderLearnStep();
  },

  // 5. 3B KELİME KARTLARI
  initFlashcards() {
    this.fcList = [...this.getActiveWords()];
    this.fcIndex = 0;
    this.fcFlipped = false;
    this.fcUnknownWords = [];
    this.renderFlashcard();
  },

  startFlashcardsWithSubset(list) {
    this.fcList = [...list];
    this.fcIndex = 0;
    this.fcFlipped = false;
    this.fcUnknownWords = [];
    this.renderFlashcard();
  },

  toggleFlashcardFront() {
    this.fcFrontLang = this.fcFrontLang === "en" ? "tr" : "en";
    const btn = document.getElementById("fc-front-btn");
    if (btn) btn.textContent = this.fcFrontLang === "en" ? "Ön Yüz: 🇬🇧 İngilizce" : "Ön Yüz: 🇹🇷 Türkçe";
    this.fcFlipped = false;
    this.renderFlashcard();
  },

  shuffleFlashcards() {
    this.fcList = this.shuffleArray([...this.fcList]);
    this.fcIndex = 0;
    this.fcFlipped = false;
    this.fcUnknownWords = [];
    this.renderFlashcard();
    this.toast("🔀 Kartlar karıştırıldı!");
  },

  toggleAutoSpeak() {
    this.fcAutoSpeak = !this.fcAutoSpeak;
    const btn = document.getElementById("fc-autospeak-btn");
    if (btn) btn.textContent = `🔊 Otomatik Ses: ${this.fcAutoSpeak ? "Açık" : "Kapalı"}`;
  },

  renderFlashcard() {
    const stage = document.getElementById("fc-stage");
    if (!stage) return;
    if (this.fcList.length === 0) {
      stage.innerHTML = this.getEmptyDeckStudyHtml();
      return;
    }

    if (this.fcIndex >= this.fcList.length) {
      const unknown = this.fcUnknownWords || [];
      stage.innerHTML = `
        <div class="study-box" style="text-align:center; width:100%;">
          <div style="font-size:48px; margin-bottom:10px;">🎉</div>
          <h2>Kart Turu Tamamlandı! (${this.fcList.length} Kart)</h2>
          <p style="color:var(--text-secondary); margin:8px 0 20px;">
            ${unknown.length > 0
              ? `<b>${unknown.length}</b> kelimeyi "Tekrar Çalışacağım" olarak işaretledin.`
              : `Tüm kartları biliyorsun! Harika iş çıkardın.`}
          </p>
          <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            ${unknown.length > 0 ? `
              <button class="btn btn-primary" onclick="App.startFlashcardsWithSubset(App.fcUnknownWords)">
                🤔 Sadece Zorlandığım ${unknown.length} Kartı Çalış
              </button>
            ` : ""}
            <button class="btn btn-secondary" onclick="App.initFlashcards()">🔄 Tüm Kartları Baştan Çalış</button>
            <button class="btn btn-secondary" onclick="App.navigate('quiz')">📝 Şimdi Test Çöz</button>
          </div>
        </div>
      `;
      return;
    }

    const w = this.fcList[this.fcIndex];
    const safeTerm = this.escapeAttr(w.term);
    const frontIsEn = this.fcFrontLang === "en";

    stage.innerHTML = `
      <div style="width:100%; display:flex; justify-content:space-between; align-items:center; font-size:13.5px; color:var(--text-secondary);">
        <span>Kart <b>${this.fcIndex + 1} / ${this.fcList.length}</b></span>
        <span>${this.escapeHtml(this.getWordOriginLabel(w))} • ${this.escapeHtml(w.pos || "")}</span>
      </div>

      <div class="flashcard-scene" onclick="App.flipFlashcard()">
        <div class="flashcard-3d ${this.fcFlipped ? "is-flipped" : ""}" id="fc-card-3d">
          <div class="flashcard-face">
            <span class="card-face-label">${frontIsEn ? "🇬🇧 İNGİLİZCE" : "🇹🇷 TÜRKÇE"}</span>
            <div class="card-face-actions" onclick="event.stopPropagation()">
              <button class="btn-icon mic-btn" onclick="App.practicePronunciation('${safeTerm}', this)" title="Mikrofonla Telaffuzunu Test Et">🎙️</button>
              <button class="btn-icon" onclick="App.speak('${safeTerm}')" title="Sesli Dinle">🔊</button>
            </div>
            <div class="card-main-word">${this.escapeHtml(frontIsEn ? w.term : w.meaning)}</div>
            ${frontIsEn && w.phonetic ? `<div class="card-phonetic">${this.escapeHtml(w.phonetic)}</div>` : ""}
            <span class="card-flip-hint">Çevirmek için tıkla veya Boşluk (Space) tuşuna bas</span>
          </div>

          <div class="flashcard-face flashcard-back">
            <span class="card-face-label">${frontIsEn ? "🇹🇷 TÜRKÇE ANLAMI & ÖRNEK" : "🇬🇧 İNGİLİZCE KARŞILIĞI"}</span>
            <div class="card-face-actions" onclick="event.stopPropagation()">
              <button class="btn-icon" onclick="App.speak('${safeTerm}')" title="Sesli Dinle">🔊</button>
            </div>
            <div class="card-meaning-big">${this.escapeHtml(frontIsEn ? w.meaning : w.term)}</div>
            ${!frontIsEn && w.phonetic ? `<div class="card-phonetic">${this.escapeHtml(w.phonetic)}</div>` : ""}
            ${w.example ? `
              <div class="card-example-box">
                "${this.escapeHtml(w.example)}"
                ${w.exampleTr ? `<div style="font-size:12.5px; color:var(--text-muted); margin-top:4px;">🇹🇷 ${this.escapeHtml(w.exampleTr)}</div>` : ""}
              </div>
            ` : ""}
            ${w.mnemonic ? `<div class="word-mnemonic" style="margin-top:10px;">💡 ${this.escapeHtml(w.mnemonic)}</div>` : ""}
          </div>
        </div>
      </div>

      <div style="display:flex; gap:14px; align-items:center; justify-content:center; width:100%; flex-wrap:wrap;">
        <button class="btn btn-secondary" onclick="App.prevFlashcard()">⬅️ Önceki</button>
        <button class="btn btn-danger" onclick="App.markFlashcard(false)">🤔 Tekrar Çalışacağım (1)</button>
        <button class="btn btn-success" onclick="App.markFlashcard(true)">✅ Biliyorum (2)</button>
        <button class="btn btn-secondary" onclick="App.nextFlashcard()">Sonraki ➡️</button>
      </div>
    `;

    if (this.fcAutoSpeak && frontIsEn) {
      this.speak(w.term);
    }
  },

  flipFlashcard() {
    this.fcFlipped = !this.fcFlipped;
    const el = document.getElementById("fc-card-3d");
    if (el) el.classList.toggle("is-flipped", this.fcFlipped);
  },

  nextFlashcard() {
    if (!this.fcList.length) return;
    this.fcIndex = this.fcIndex + 1;
    this.fcFlipped = false;
    this.renderFlashcard();
  },

  prevFlashcard() {
    if (!this.fcList.length) return;
    this.fcIndex = Math.max(0, this.fcIndex - 1);
    this.fcFlipped = false;
    this.renderFlashcard();
  },

  markFlashcard(known) {
    const w = this.fcList[this.fcIndex];
    if (w) {
      if (known) {
        w.correctCount = (w.correctCount || 0) + 1;
        if (!w.status || w.status === "new") w.status = "familiar";
      } else {
        w.wrongCount = (w.wrongCount || 0) + 1;
        w.status = "learning";
        w.nextReview = Date.now();
        if (!this.fcUnknownWords) this.fcUnknownWords = [];
        if (!this.fcUnknownWords.some(item => item.id === w.id)) {
          this.fcUnknownWords.push(w);
        }
      }
      this.recordStudyAction();
    }
    this.nextFlashcard();
  },

  // 6. CÜMLE İÇİNDE BOŞLUK DOLDURMA (CLOZE DELETION)
  initClozeMode() {
    const active = this.getActiveWords();
    const withEx = active.filter(w => w.example && w.example.trim().length > 0);
    this.clozeList = this.shuffleArray(withEx.length > 0 ? withEx : [...active]);
    this.clozeIndex = 0;
    this.clozeScore = 0;
    this.clozeAnswered = false;
    this.renderClozeQuestion();
  },

  maskWordInSentence(sentence, term) {
    if (!sentence || !term) return "_______";
    const escapedTerm = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const fullRegex = new RegExp(escapedTerm + "\\w*", "gi");
    if (fullRegex.test(sentence)) {
      return sentence.replace(fullRegex, "_______");
    }
    const base = term.trim().split(/\s+/)[0];
    const escBase = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const baseRegex = new RegExp(escBase + "\\w*", "gi");
    if (baseRegex.test(sentence)) {
      return sentence.replace(baseRegex, "_______");
    }
    // Son harfi düşmüş kökler (örn: illustrate -> illustrated,grumble -> grumbling)
    if (base.length >= 5) {
      const stem = base.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const stemRegex = new RegExp("\\b" + stem + "\\w*", "gi");
      if (stemRegex.test(sentence)) {
        return sentence.replace(stemRegex, "_______");
      }
    }
    return sentence + " (_______)";
  },

  renderClozeQuestion() {
    const container = document.getElementById("cloze-container");
    if (!container) return;

    if (this.clozeList.length === 0) {
      container.innerHTML = this.getEmptyDeckStudyHtml();
      return;
    }

    if (this.clozeIndex >= this.clozeList.length) {
      container.innerHTML = `
        <div class="study-box" style="text-align:center;">
          <div style="font-size:48px; margin-bottom:10px;">🏆</div>
          <h2>Cümle Tamamlama Turu Tamamlandı!</h2>
          <p style="color:var(--text-secondary); margin:8px 0 20px;">
            Seçili defterdeki <b>${this.clozeList.length}</b> sorudan <b>${this.clozeScore}</b> doğru yaptın.
          </p>
          <button class="btn btn-primary" onclick="App.initClozeMode()">🔄 Yeniden Başlat</button>
        </div>
      `;
      return;
    }

    const current = this.clozeList[this.clozeIndex];
    const masked = this.maskWordInSentence(current.example || `Please remember the word _______ in this context.`, current.term);
    const distractors = this.getDistractorsForWord(current, 3);
    const options = this.shuffleArray([current, ...distractors]);

    container.innerHTML = `
      <div class="study-box">
        <div style="display:flex; justify-content:space-between; color:var(--text-muted); font-size:13px; margin-bottom:14px;">
          <span>Soru ${this.clozeIndex + 1} / ${this.clozeList.length}</span>
          <span>Doğru: ${this.clozeScore}</span>
        </div>

        <div style="font-size:22px; font-weight:700; line-height:1.5; margin-bottom:14px; padding:18px; background:var(--bg-secondary); border-radius:var(--radius-md); border-left:4px solid var(--accent);">
          "${this.escapeHtml(masked)}"
        </div>

        <div style="font-size:14.5px; color:var(--success); font-weight:600; margin-bottom:6px;">
          💡 Türkçe Anlam İpucu: ${this.escapeHtml(current.meaning)}
        </div>
        ${current.exampleTr ? `<div style="font-size:13px; color:var(--text-muted);">🇹🇷 Cümle Çevirisi: "${this.escapeHtml(current.exampleTr)}"</div>` : ""}

        <div class="options-grid" id="cloze-options">
          ${options.map((opt, idx) => `
            <button class="option-btn" data-word-id="${opt.id}" onclick="App.answerCloze('${opt.id}', this)">
              <span style="color:var(--accent); font-weight:800;">${idx + 1}.</span>
              <span>${this.escapeHtml(opt.term)}</span>
            </button>
          `).join("")}
        </div>

        <div id="cloze-feedback" style="margin-top:18px;"></div>
      </div>
    `;
  },

  answerCloze(selectedId, btnEl) {
    if (this.clozeAnswered) return;
    this.clozeAnswered = true;
    const current = this.clozeList[this.clozeIndex];
    const isCorrect = selectedId === current.id;

    document.querySelectorAll("#cloze-options .option-btn").forEach(b => {
      b.disabled = true;
      if (b.getAttribute("data-word-id") === current.id) b.classList.add("correct");
    });

    if (isCorrect) {
      this.clozeScore += 1;
      current.correctCount = (current.correctCount || 0) + 1;
      btnEl.classList.add("correct");
    } else {
      current.wrongCount = (current.wrongCount || 0) + 1;
      btnEl.classList.add("wrong");
    }

    this.speak(current.example || current.term);
    this.recordStudyAction();

    const fb = document.getElementById("cloze-feedback");
    if (fb) {
      fb.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-radius:var(--radius-md); background:${isCorrect ? "var(--success-soft)" : "var(--danger-soft)"};">
          <span>${isCorrect ? "✅ Harika! Doğru kelime:" : "❌ Doğru cevap:"} <b>${this.escapeHtml(current.term)}</b></span>
          <button class="btn btn-primary btn-sm" onclick="App.nextCloze()">Sonraki Soru ➡️</button>
        </div>
      `;
    }
  },

  nextCloze() {
    this.clozeIndex += 1;
    this.clozeAnswered = false;
    this.renderClozeQuestion();
  },

  // 7. YAZARAK & DİNLEYEREK ÖĞRENME
  initWriteMode() {
    this.writeList = this.shuffleArray([...this.getActiveWords()]);
    this.writeIndex = 0;
    this.writeHintLen = 0;
    this.writeAnswered = false;
    this.writeRoundWrong = [];
    this.renderWriteCard();
  },

  startWriteWithSubset(list) {
    this.writeList = this.shuffleArray([...list]);
    this.writeIndex = 0;
    this.writeHintLen = 0;
    this.writeAnswered = false;
    this.writeRoundWrong = [];
    this.renderWriteCard();
  },

  toggleWritePromptLang() {
    this.writePromptLang = this.writePromptLang === "tr" ? "en" : "tr";
    const btn = document.getElementById("write-prompt-toggle");
    if (btn) {
      btn.textContent = this.writePromptLang === "tr"
        ? "🔄 Soru: 🇹🇷 Türkçe ➔ 🇬🇧 İngilizce Yaz"
        : "🔄 Soru: 🇬🇧 İngilizce ➔ 🇹🇷 Türkçe Yaz";
    }
    this.writeHintLen = 0;
    this.writeAnswered = false;
    this.renderWriteCard();
  },

  toggleDictationMode() {
    this.writeDictationOnly = !this.writeDictationOnly;
    const btn = document.getElementById("write-mode-toggle");
    if (btn) btn.textContent = this.writeDictationOnly ? "🎧 Mod: Sadece Dinleyerek (Dikte)" : "🎧 Mod: Anlam + Ses";
    this.renderWriteCard();
  },

  renderWriteCard() {
    const container = document.getElementById("write-container");
    if (!container) return;

    if (this.writeList.length === 0) {
      container.innerHTML = this.getEmptyDeckStudyHtml();
      return;
    }

    if (this.writeIndex >= this.writeList.length) {
      const wrongList = this.writeRoundWrong || [];
      container.innerHTML = `
        <div class="study-box" style="text-align:center;">
          <div style="font-size:48px; margin-bottom:10px;">✍️</div>
          <h2>Yazma Turu Tamamlandı! (${this.writeList.length} Kelime)</h2>
          <p style="color:var(--text-secondary); margin:8px 0 20px;">
            ${wrongList.length > 0
              ? `Bu turda zorlandığın <b>${wrongList.length}</b> kelimeyi pekiştirmek için sadece onları tekrar yazabilirsin.`
              : `Tüm kelimeleri doğru yazdın!`}
          </p>
          <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            ${wrongList.length > 0 ? `
              <button class="btn btn-primary" onclick="App.startWriteWithSubset(App.writeRoundWrong)">
                🔁 Yanlış Yazdığım ${wrongList.length} Kelimeyi Tekrar Yaz
              </button>
            ` : ""}
            <button class="btn btn-secondary" onclick="App.initWriteMode()">🔄 Tüm Defteri Baştan Yaz</button>
          </div>
        </div>
      `;
      return;
    }

    const w = this.writeList[this.writeIndex];
    const safeTerm = this.escapeAttr(w.term);
    const askTrWriteEn = this.writeDictationOnly || this.writePromptLang !== "en";
    const targetAnswer = askTrWriteEn ? w.term : w.meaning.split(",")[0].trim();

    container.innerHTML = `
      <div class="study-box" style="text-align:center;">
        <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-muted); margin-bottom:14px;">
          <span>Kelime ${this.writeIndex + 1} / ${this.writeList.length} • ${this.escapeHtml(this.getWordOriginLabel(w))}</span>
          <span>İpucu: ${targetAnswer.length} harf</span>
        </div>

        ${this.writeDictationOnly ? `
          <div style="padding:20px;">
            <button class="btn btn-primary" onclick="App.speak('${safeTerm}')">🔊 Kelimeyi Tekrar Dinle</button>
            <p style="font-size:13px; color:var(--text-secondary); margin-top:10px;">Duyduğun İngilizce kelimeyi aşağıya yaz:</p>
          </div>
        ` : askTrWriteEn ? `
          <div style="font-size:26px; font-weight:800; color:var(--success); margin-bottom:8px;">
            🇹🇷 ${this.escapeHtml(w.meaning)}
          </div>
          <div style="margin-bottom:8px;">
            <span class="pos-badge">${this.escapeHtml(w.pos || "")}</span>
            <button class="btn-icon" style="margin-left:8px;" onclick="App.speak('${safeTerm}')" title="Telaffuz İpucu Dinle">🔊</button>
          </div>
        ` : `
          <div style="font-size:28px; font-weight:800; color:var(--text-primary); margin-bottom:8px;">
            🇬🇧 ${this.escapeHtml(w.term)}
            ${w.phonetic ? `<span class="word-phonetic" style="font-size:16px; margin-left:8px;">${this.escapeHtml(w.phonetic)}</span>` : ""}
          </div>
          <div style="margin-bottom:8px;">
            <span class="pos-badge">${this.escapeHtml(w.pos || "")}</span>
            <button class="btn-icon" style="margin-left:8px;" onclick="App.speak('${safeTerm}')" title="Telaffuzu Dinle">🔊</button>
          </div>
        `}

        <div id="write-hint-display" style="font-family:monospace; font-size:16px; color:var(--warning); min-height:24px;"></div>

        <input
          type="text"
          id="write-user-input"
          class="write-input"
          placeholder="${askTrWriteEn ? "İngilizce karşılığını yazıp Enter'a basın..." : "Türkçe anlamlarından birini yazıp Enter'a basın..."}"
          autocomplete="off"
          onkeydown="if(event.key==='Enter'){event.preventDefault(); App.checkWriteAnswer();}"
        />

        <div style="display:flex; justify-content:center; gap:10px; margin-top:16px; flex-wrap:wrap;">
          <button class="btn btn-secondary" onclick="App.giveWriteHint()">💡 Harf İpucu Ver</button>
          <button class="btn btn-primary" onclick="App.checkWriteAnswer()">✅ Kontrol Et</button>
          <button class="btn btn-secondary" onclick="App.nextWriteCard()">Atla ➡️</button>
        </div>

        <div id="write-feedback" style="margin-top:18px;"></div>
      </div>
    `;

    if (this.writeDictationOnly || !askTrWriteEn) {
      this.speak(w.term);
    }
    setTimeout(() => document.getElementById("write-user-input")?.focus(), 50);
  },

  giveWriteHint() {
    const w = this.writeList[this.writeIndex];
    if (!w) return;
    const askTrWriteEn = this.writeDictationOnly || this.writePromptLang !== "en";
    const target = askTrWriteEn ? w.term.trim() : w.meaning.split(",")[0].trim();
    this.writeHintLen = Math.min(target.length, this.writeHintLen + 1);
    const revealed = target.slice(0, this.writeHintLen) + "_".repeat(Math.max(0, target.length - this.writeHintLen));
    const el = document.getElementById("write-hint-display");
    if (el) el.textContent = `İpucu: ${revealed}`;
    const input = document.getElementById("write-user-input");
    if (input && !input.value) input.value = target.slice(0, this.writeHintLen);
    input?.focus();
  },

  isWriteAnswerMatch(userVal, w, askTrWriteEn) {
    const cleanUser = userVal.toLowerCase().replace(/\s+/g, " ").trim();
    if (askTrWriteEn) {
      const cleanTerm = w.term.toLowerCase().replace(/\s+/g, " ").trim();
      if (cleanUser === cleanTerm) return true;
      // "indifferent to" veya "content with" gibi edatlı kelimelerde ana kök yazıldığında da kabul et
      const withoutPrep = cleanTerm.replace(/\s+(to|with|of|in|on|for|at|from|about)$/i, "").trim();
      return withoutPrep.length >= 3 && cleanUser === withoutPrep;
    } else {
      const meanings = w.meaning
        .toLowerCase()
        .split(/[,;/]/)
        .map(s => s.replace(/\(.*?\)/g, "").trim())
        .filter(Boolean);
      return meanings.some(m => m === cleanUser || (cleanUser.length >= 4 && m.includes(cleanUser)));
    }
  },

  checkWriteAnswer() {
    if (this.writeAnswered) {
      this.nextWriteCard();
      return;
    }
    const w = this.writeList[this.writeIndex];
    const input = document.getElementById("write-user-input");
    const userVal = (input?.value || "").trim();
    if (!userVal) return;

    const askTrWriteEn = this.writeDictationOnly || this.writePromptLang !== "en";
    const isCorrect = this.isWriteAnswerMatch(userVal, w, askTrWriteEn);
    this.writeAnswered = true;
    this.speak(w.term);
    this.recordStudyAction();

    if (isCorrect) {
      w.correctCount = (w.correctCount || 0) + 1;
      if (!w.status || w.status === "new") w.status = "familiar";
    } else {
      w.wrongCount = (w.wrongCount || 0) + 1;
      w.status = "learning";
      w.nextReview = Date.now();
      if (!this.writeRoundWrong) this.writeRoundWrong = [];
      if (!this.writeRoundWrong.some(item => item.id === w.id)) {
        this.writeRoundWrong.push(w);
      }
    }

    const expectedDisplay = askTrWriteEn ? w.term : w.meaning;
    const fb = document.getElementById("write-feedback");
    if (fb) {
      fb.innerHTML = `
        <div style="padding:14px; border-radius:var(--radius-md); background:${isCorrect ? "var(--success-soft)" : "var(--danger-soft)"};">
          <div style="font-size:16px; font-weight:700; color:${isCorrect ? "var(--success)" : "var(--danger)"};">
            ${isCorrect ? `🎉 Mükemmel! Doğru cevap: "${this.escapeHtml(expectedDisplay)}"` : `❌ Doğru cevap: "${this.escapeHtml(expectedDisplay)}"`}
          </div>
          ${w.example ? `<div style="font-size:13px; color:var(--text-secondary); margin-top:6px;">Örnek: "${this.escapeHtml(w.example)}"</div>` : ""}
          <button class="btn btn-primary btn-sm" style="margin-top:10px;" onclick="App.nextWriteCard()">Sonraki Kelime (Enter) ➡️</button>
        </div>
      `;
    }
  },

  nextWriteCard() {
    this.writeIndex += 1;
    this.writeHintLen = 0;
    this.writeAnswered = false;
    this.renderWriteCard();
  },

  // 8. ÇOKTAN SEÇMELİ TEST (QUIZ)
  getPrimarySynonym(w) {
    if (!w || !w.synonyms) return "";
    const list = w.synonyms
      .split(",")
      .map(s => s.trim())
      .filter(s => s && s.toLowerCase() !== (w.term || "").toLowerCase());
    return list.slice(0, 2).join(", ");
  },

  initQuizMode() {
    const active = this.getActiveWords();
    if (this.quizDir === "en-syn") {
      const withSyn = active.filter(w => this.getPrimarySynonym(w).length > 0);
      this.quizList = this.shuffleArray(withSyn.length >= 2 ? withSyn : [...active]);
    } else {
      this.quizList = this.shuffleArray([...active]);
    }
    this.quizIndex = 0;
    this.quizScore = 0;
    this.quizWrongWords = [];
    this.quizAnswered = false;
    this.renderQuizQuestion();
  },

  startQuizWithSubset(list) {
    this.quizList = this.shuffleArray([...list]);
    this.quizIndex = 0;
    this.quizScore = 0;
    this.quizWrongWords = [];
    this.quizAnswered = false;
    this.renderQuizQuestion();
  },

  toggleQuizDirection() {
    const order = ["en-tr", "tr-en", "en-syn"];
    const nextIdx = (order.indexOf(this.quizDir) + 1) % order.length;
    this.quizDir = order[nextIdx];
    const btn = document.getElementById("quiz-dir-btn");
    if (btn) {
      if (this.quizDir === "en-tr") btn.textContent = "Yön: 🇬🇧 İng ➔ 🇹🇷 Tr";
      else if (this.quizDir === "tr-en") btn.textContent = "Yön: 🇹🇷 Tr ➔ 🇬🇧 İng";
      else btn.textContent = "Yön: 🔗 İng ➔ Eş Anlam (Synonym)";
    }
    this.initQuizMode();
  },

  renderQuizQuestion() {
    const container = document.getElementById("quiz-container");
    if (!container) return;

    if (this.quizList.length === 0) {
      container.innerHTML = this.getEmptyDeckStudyHtml();
      return;
    }

    if (this.quizIndex >= this.quizList.length) {
      const pct = this.quizList.length > 0 ? Math.round((this.quizScore / this.quizList.length) * 100) : 0;
      container.innerHTML = `
        <div class="study-box" style="text-align:center;">
          <div style="font-size:52px; margin-bottom:8px;">🎯</div>
          <h2>Test Sonucu: %${pct} Başarı (${this.quizScore} / ${this.quizList.length})</h2>
          ${this.quizWrongWords.length > 0 ? `
            <div style="text-align:left; margin:20px 0; background:var(--bg-secondary); padding:16px; border-radius:var(--radius-md);">
              <h4 style="color:var(--danger); margin-bottom:8px;">📌 Tekrar Etmen Gereken Kelimeler (${this.quizWrongWords.length}):</h4>
              ${this.quizWrongWords.map(w => `
                <div style="padding:6px 0; border-bottom:1px solid var(--border-color); font-size:14px;">
                  <b>${this.escapeHtml(w.term)}</b> — ${this.escapeHtml(w.meaning)}
                  ${w.synonyms ? `<span style="color:var(--text-muted); font-size:12px;"> (Eş Anlam: ${this.escapeHtml(w.synonyms)})</span>` : ""}
                </div>
              `).join("")}
            </div>
          ` : `<p style="color:var(--success); margin:12px 0;">Seçili defterdeki tüm soruları hatasız bildin!</p>`}
          <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            ${this.quizWrongWords.length > 0 ? `
              <button class="btn btn-primary" onclick="App.startQuizWithSubset(App.quizWrongWords)">
                🔁 Sadece Yanlış Yaptığım ${this.quizWrongWords.length} Kelimeyi Test Et
              </button>
            ` : ""}
            <button class="btn btn-secondary" onclick="App.initQuizMode()">🔄 Tüm Defterle Yeni Test</button>
          </div>
        </div>
      `;
      return;
    }

    const current = this.quizList[this.quizIndex];
    const distractors = this.getDistractorsForWord(current, 3);
    const options = this.shuffleArray([current, ...distractors]);
    const isEnToTr = this.quizDir === "en-tr";
    const isSynMode = this.quizDir === "en-syn";

    const getOptionLabel = opt => {
      if (isSynMode) {
        return this.getPrimarySynonym(opt) || opt.meaning;
      }
      return isEnToTr ? opt.meaning : opt.term;
    };

    container.innerHTML = `
      <div class="study-box">
        <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-muted); margin-bottom:12px;">
          <span>Soru ${this.quizIndex + 1} / ${this.quizList.length} ${isSynMode ? "• 🔗 Eş Anlamlı Testi" : ""}</span>
          <span>Puan: ${this.quizScore}</span>
        </div>

        <div style="text-align:center; padding:18px 0;">
          <div style="font-size:32px; font-weight:800;">
            ${this.escapeHtml(isEnToTr || isSynMode ? current.term : current.meaning)}
          </div>
          ${(isEnToTr || isSynMode) && current.phonetic ? `<div class="word-phonetic" style="margin-top:4px;">${this.escapeHtml(current.phonetic)}</div>` : ""}
          ${isSynMode ? `<div style="font-size:13.5px; color:var(--success); margin-top:6px;">💡 Anlam İpucu: ${this.escapeHtml(current.meaning)} — Hangi şık eş anlamlısıdır?</div>` : ""}
        </div>

        <div class="options-grid" id="quiz-options">
          ${options.map((opt, i) => `
            <button class="option-btn" data-word-id="${opt.id}" onclick="App.answerQuiz('${opt.id}', this)">
              <span style="color:var(--accent); font-weight:800;">${String.fromCharCode(65 + i)})</span>
              <span>${this.escapeHtml(getOptionLabel(opt))}</span>
            </button>
          `).join("")}
        </div>
      </div>
    `;

    if (isEnToTr || isSynMode) this.speak(current.term);
  },

  answerQuiz(selectedId, btnEl) {
    if (this.quizAnswered) return;
    this.quizAnswered = true;
    const current = this.quizList[this.quizIndex];
    const isCorrect = selectedId === current.id;

    document.querySelectorAll("#quiz-options .option-btn").forEach(b => {
      b.disabled = true;
      if (b.getAttribute("data-word-id") === current.id) b.classList.add("correct");
    });

    if (isCorrect) {
      this.quizScore += 1;
      current.correctCount = (current.correctCount || 0) + 1;
      btnEl.classList.add("correct");
    } else {
      current.wrongCount = (current.wrongCount || 0) + 1;
      current.nextReview = Date.now();
      this.quizWrongWords.push(current);
      btnEl.classList.add("wrong");
    }

    this.recordStudyAction();
    setTimeout(() => {
      this.quizIndex += 1;
      this.quizAnswered = false;
      this.renderQuizQuestion();
    }, 950);
  },

  // 9. EŞLEŞTİRME OYUNU (MATCH GAME)
  toggleMatchMode() {
    this.matchMode = this.matchMode === "en-tr" ? "en-syn" : "en-tr";
    const btn = document.getElementById("match-mode-btn");
    if (btn) {
      btn.textContent = this.matchMode === "en-syn"
        ? "Mod: 🔗 İng ⇄ Eş Anlam (Synonym)"
        : "Mod: 🇬🇧 İng ⇄ 🇹🇷 Tr";
    }
    this.initMatchGame();
  },

  initMatchGame() {
    if (this.matchTimerId) clearInterval(this.matchTimerId);
    const active = this.getActiveWords();
    const container = document.getElementById("match-container");
    if (active.length === 0) {
      if (container) container.innerHTML = this.getEmptyDeckStudyHtml();
      return;
    }

    let sourcePool = [...active];
    if (this.matchMode === "en-syn") {
      const withSyn = active.filter(w => this.getPrimarySynonym(w).length > 0);
      if (withSyn.length >= 3) sourcePool = withSyn;
    }

    const pool = this.shuffleArray(sourcePool).slice(0, 6);
    const tiles = [];
    pool.forEach(w => {
      const pairText = this.matchMode === "en-syn"
        ? `🔗 ${this.getPrimarySynonym(w) || w.meaning}`
        : w.meaning;
      tiles.push({ uid: `en-${w.id}`, wordId: w.id, text: w.term, type: "en" });
      tiles.push({ uid: `tr-${w.id}`, wordId: w.id, text: pairText, type: "tr" });
    });

    this.matchTiles = this.shuffleArray(tiles);
    this.matchSelected = null;
    this.matchMatchedCount = 0;
    this.matchStartTime = performance.now();

    const bestEl = document.getElementById("match-best");
    if (bestEl) {
      bestEl.textContent = this.state.bestMatchTime ? `${this.state.bestMatchTime.toFixed(1)} sn` : "--";
    }

    this.matchTimerId = setInterval(() => {
      const elapsed = (performance.now() - this.matchStartTime) / 1000;
      const tEl = document.getElementById("match-timer");
      if (tEl) tEl.textContent = `${elapsed.toFixed(1)} sn`;
    }, 100);

    this.renderMatchBoard();
  },

  renderMatchBoard() {
    const container = document.getElementById("match-container");
    if (!container) return;

    container.innerHTML = `
      <div class="match-board">
        ${this.matchTiles.map(t => `
          <div class="match-tile" id="tile-${t.uid}" onclick="App.clickMatchTile('${t.uid}')">
            ${this.escapeHtml(t.text)}
          </div>
        `).join("")}
      </div>
    `;
  },

  clickMatchTile(uid) {
    const tile = this.matchTiles.find(t => t.uid === uid);
    const domEl = document.getElementById(`tile-${uid}`);
    if (!tile || !domEl || domEl.classList.contains("matched")) return;

    if (tile.type === "en") this.speak(tile.text);

    if (!this.matchSelected) {
      this.matchSelected = tile;
      domEl.classList.add("selected");
      return;
    }

    if (this.matchSelected.uid === tile.uid) {
      domEl.classList.remove("selected");
      this.matchSelected = null;
      return;
    }

    const prevTile = this.matchSelected;
    const prevEl = document.getElementById(`tile-${prevTile.uid}`);
    this.matchSelected = null;

    if (prevTile.wordId === tile.wordId && prevTile.type !== tile.type) {
      prevEl?.classList.remove("selected");
      prevEl?.classList.add("matched");
      domEl.classList.add("matched");
      this.matchMatchedCount += 2;

      if (this.matchMatchedCount >= this.matchTiles.length) {
        clearInterval(this.matchTimerId);
        this.matchTimerId = null;
        const finalTime = (performance.now() - this.matchStartTime) / 1000;
        let isNewRecord = false;
        if (!this.state.bestMatchTime || finalTime < this.state.bestMatchTime) {
          this.state.bestMatchTime = finalTime;
          isNewRecord = true;
        }
        this.recordStudyAction();
        const container = document.getElementById("match-container");
        if (container) {
          container.innerHTML = `
            <div class="study-box" style="text-align:center; margin-top:20px;">
              <div style="font-size:52px; margin-bottom:10px;">⚡</div>
              <h2>Tüm Kartları ${finalTime.toFixed(1)} Saniyede Eşleştirdin!</h2>
              ${isNewRecord ? `<p style="color:var(--warning); font-weight:700; margin-top:8px;">🏆 YENİ KİŞİSEL REKOR!</p>` : ""}
              <button class="btn btn-primary" style="margin-top:18px;" onclick="App.initMatchGame()">🎮 Tekrar Oyna</button>
            </div>
          `;
        }
      }
    } else {
      domEl.classList.add("mismatch");
      prevEl?.classList.remove("selected");
      prevEl?.classList.add("mismatch");
      setTimeout(() => {
        domEl.classList.remove("mismatch");
        prevEl?.classList.remove("mismatch");
      }, 400);
    }
  },

  // 10. İSTATİSTİKLER
  renderStats() {
    const container = document.getElementById("stats-container");
    if (!container) return;

    const pool = this.getActiveWords();
    const counts = { new: 0, learning: 0, familiar: 0, mastered: 0 };
    pool.forEach(w => {
      const st = w.status || "new";
      counts[st] = (counts[st] || 0) + 1;
    });

    const hardWords = [...pool]
      .filter(w => (w.wrongCount || 0) > 0)
      .sort((a, b) => (b.wrongCount || 0) - (a.wrongCount || 0))
      .slice(0, 8);

    // Son 7 Günlük Çalışma Grafiği Verisi
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const key = `${y}-${m}-${day}`;
      const val = (this.state.studyHistory && this.state.studyHistory[key]) || 0;
      last7Days.push({ label: `${day}.${m}`, count: val, isToday: i === 0 });
    }
    const maxDayCount = Math.max(this.state.dailyGoal || 15, ...last7Days.map(d => d.count), 1);

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--info-soft); color:var(--info);">🆕</div>
          <div class="stat-info"><h3>${counts.new}</h3><p>Yeni Kelime</p></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--warning-soft); color:var(--warning);">📖</div>
          <div class="stat-info"><h3>${counts.learning}</h3><p>Öğreniliyor</p></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--accent-soft); color:var(--accent);">✨</div>
          <div class="stat-info"><h3>${counts.familiar}</h3><p>Tanıdık</p></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--success-soft); color:var(--success);">🏆</div>
          <div class="stat-info"><h3>${counts.mastered}</h3><p>Uzmanlaşıldı</p></div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap:18px; margin-bottom:20px;">
        <!-- 7 Günlük Aktivite Grafiği -->
        <div class="dict-result-card">
          <h3 style="margin-bottom:16px;">📅 Son 7 Günlük Çalışma Aktivitesi</h3>
          <div style="display:flex; align-items:flex-end; justify-content:space-between; height:160px; gap:10px; padding-top:16px; border-bottom:1px solid var(--border-color);">
            ${last7Days.map(d => {
              const hPct = Math.max(6, Math.round((d.count / maxDayCount) * 100));
              return `
                <div style="flex:1; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end;">
                  <span style="font-size:11.5px; font-weight:700; color:var(--text-secondary); margin-bottom:4px;">${d.count}</span>
                  <div style="width:100%; max-width:38px; height:${hPct}%; background:${d.isToday ? "var(--accent-gradient)" : "var(--accent-soft)"}; border:1px solid var(--border-highlight); border-radius:8px 8px 0 0; transition:height 0.3s;"></div>
                </div>
              `;
            }).join("")}
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:8px;">
            ${last7Days.map(d => `<span style="flex:1; text-align:center; font-size:11.5px; color:${d.isToday ? "var(--accent)" : "var(--text-muted)"}; font-weight:${d.isToday ? "800" : "500"};">${d.label}</span>`).join("")}
          </div>
        </div>

        <!-- En Çok Zorlanılan Kelimeler -->
        <div class="dict-result-card">
          <h3 style="margin-bottom:12px;">🔥 Bu Defterde En Çok Zorlandığın Kelimeler</h3>
          ${hardWords.length === 0 ? `
            <p style="color:var(--text-secondary);">Seçili defterde henüz hata yaptığın kelime kaydedilmedi.</p>
          ` : `
            <div style="display:grid; gap:10px;">
              ${hardWords.map(w => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-secondary); padding:10px 14px; border-radius:var(--radius-sm);">
                  <div>
                    <b style="font-size:15px;">${this.escapeHtml(w.term)}</b> — <span style="color:var(--success);">${this.escapeHtml(w.meaning)}</span>
                  </div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <button class="btn-icon" style="width:28px; height:28px; font-size:12px;" onclick="App.speak('${this.escapeAttr(w.term)}')">🔊</button>
                    <span class="nav-badge urgent">${w.wrongCount} Hata</span>
                  </div>
                </div>
              `).join("")}
            </div>
          `}
        </div>
      </div>

      <!-- Tüm Defterlerin Özeti Tablosu -->
      <div class="dict-result-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          <h3>📂 Tüm Günlük & Özel Defterlerin İlerleme Durumu</h3>
          <button class="btn btn-secondary btn-sm" onclick="App.navigate('calendar')">📆 Takvim & Arşiv Görünümü ➔</button>
        </div>
        <div style="display:grid; gap:10px;">
          ${this.state.decks.slice(0, 15).map(d => {
            const dWords = this.state.words.filter(w => w.deckId === d.id);
            const dMastered = dWords.filter(w => w.status === "mastered" || w.status === "familiar").length;
            const dPct = dWords.length > 0 ? Math.round((dMastered / dWords.length) * 100) : 0;
            return `
              <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-secondary); padding:12px 16px; border-radius:var(--radius-sm); flex-wrap:wrap; gap:10px;">
                <div>
                  <span style="font-weight:700;">${d.icon || "📘"} ${this.escapeHtml(d.name)}</span>
                  <span style="font-size:12px; color:var(--text-muted); margin-left:8px;">(${dWords.length} kelime • %${dPct} öğrenildi)</span>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="App.selectDeck('${d.id}', true)">Defteri Aç ➔</button>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  },

  // 11. GÜNLÜK TAKVİM & ARŞİV MERKEZİ + HIZLI DEFTER ARAMA PALETİ (CTRL+P)
  calendarMonthIso: null, // "YYYY-MM"
  archiveSearchQuery: "",
  switcherItems: [],
  switcherActiveIdx: 0,

  changeCalendarMonth(delta) {
    const cur = this.calendarMonthIso || this.getTodayStr().slice(0, 7);
    const [y, m] = cur.split("-").map(n => parseInt(n, 10));
    const d = new Date(y, m - 1 + delta, 1);
    this.calendarMonthIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    this.renderCalendar();
  },

  applyCustomDateRange() {
    const s = document.getElementById("cal-range-start")?.value;
    const e = document.getElementById("cal-range-end")?.value;
    if (!s || !e) {
      this.toast("⚠️ Lütfen başlangıç ve bitiş tarihlerini seçin.");
      return;
    }
    this.selectDateRange(s, e, "notebook");
  },

  renderCalendar() {
    const container = document.getElementById("calendar-view-container");
    if (!container) return;

    const today = this.getTodayStr();
    if (!this.calendarMonthIso) this.calendarMonthIso = today.slice(0, 7);
    const [year, month] = this.calendarMonthIso.split("-").map(n => parseInt(n, 10));
    const daysInMonth = new Date(year, month, 0).getDate();
    // Pazartesi=0 ... Pazar=6
    const firstDayWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;

    const dateMap = this.getDailyDateMap();
    const refDate = this.getReferenceDate();

    let calCellsHtml = "";
    for (let i = 0; i < firstDayWeekday; i++) {
      calCellsHtml += `<div class="cal-day empty"></div>`;
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${this.calendarMonthIso}-${String(day).padStart(2, "0")}`;
      const count = this.getWordCountForDate(iso);
      const hasDeck = Boolean(dateMap[iso]);
      const isToday = iso === today;
      const isSelected = iso === refDate;
      const classes = [
        "cal-day",
        count > 0 ? "has-words" : "",
        isToday ? "is-today" : "",
        isSelected ? "is-selected" : ""
      ].filter(Boolean).join(" ");

      calCellsHtml += `
        <div class="${classes}" onclick="App.openDailyByDate('${iso}', true)" title="${this.formatTurkishDate(iso)} (${count} kelime) — Tıklayarak bu günün defterini açın">
          <span class="cal-num">${day}</span>
          ${count > 0 ? `<span class="cal-badge">${count} klm</span>` : hasDeck ? `<span class="cal-badge" style="opacity:0.6;">boş</span>` : ""}
        </div>
      `;
    }

    // Aylara göre gruplanmış tüm günlük defterler + kelime/tarih filtreleme
    const q = (this.archiveSearchQuery || "").trim().toLowerCase();
    const dailyDecks = this.getDailyDecksSorted().filter(d => {
      if (!q) return true;
      const iso = this.getDeckDate(d) || "";
      const nameMatch = (d.name || "").toLowerCase().includes(q) || iso.includes(q) || this.getWeekdayName(iso).toLowerCase().includes(q);
      if (nameMatch) return true;
      return this.state.words.some(w => w.deckId === d.id && (w.term.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)));
    });

    const monthGroups = [];
    dailyDecks.forEach(d => {
      const ym = (this.getDeckDate(d) || "").slice(0, 7) || "Diğer";
      let grp = monthGroups[monthGroups.length - 1];
      if (!grp || grp.ym !== ym) {
        grp = { ym, decks: [] };
        monthGroups.push(grp);
      }
      grp.decks.push(d);
    });

    const monthWordsCount = Array.from({ length: daysInMonth }, (_, i) =>
      this.getWordCountForDate(`${this.calendarMonthIso}-${String(i + 1).padStart(2, "0")}`)
    ).reduce((a, b) => a + b, 0);

    container.innerHTML = `
      <div class="calendar-layout">
        <!-- SOL: İNTERAKTİF TAKVİM & TARİH ARALIĞI SEÇİCİ -->
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div class="calendar-card">
            <div class="calendar-header">
              <button class="btn-icon" onclick="App.changeCalendarMonth(-1)" title="Önceki Ay">◀</button>
              <div style="text-align:center;">
                <h3 style="font-size:17px;">${this.formatMonthLabel(this.calendarMonthIso)}</h3>
                <span style="font-size:12px; color:var(--text-secondary);">Bu ayda toplam ${monthWordsCount} kelime</span>
              </div>
              <button class="btn-icon" onclick="App.changeCalendarMonth(1)" title="Sonraki Ay">▶</button>
            </div>

            <div class="calendar-weekdays">
              <span>Pzt</span><span>Sal</span><span>Çar</span><span>Per</span><span>Cum</span><span>Cmt</span><span>Paz</span>
            </div>

            <div class="calendar-grid">
              ${calCellsHtml}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding-top:12px; border-top:1px solid var(--border-color); flex-wrap:wrap; gap:8px;">
              <button class="btn btn-secondary btn-sm" onclick="App.selectMonth('${this.calendarMonthIso}')">
                🗓️ ${this.formatMonthLabel(this.calendarMonthIso)} Ayının Tümünü Çalış
              </button>
              <button class="btn btn-primary btn-sm" onclick="App.calendarMonthIso='${today.slice(0, 7)}'; App.renderCalendar();">
                📍 Bugüne Dön
              </button>
            </div>
          </div>

          <!-- Özel Tarih Aralığı Birleştirici -->
          <div class="calendar-card">
            <h4 style="margin-bottom:6px; font-size:14.5px;">🗓️ Birden Fazla Günü Birlikte Çalış (Tarih Aralığı)</h4>
            <p style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;">
              Belirli iki tarih arasındaki günlük defterlerinizi tek paket gibi birleştirip test ve kart modlarında çalışın:
            </p>
            <div class="form-row" style="margin-bottom:10px;">
              <div>
                <label style="font-size:11.5px; color:var(--text-muted);">Başlangıç Tarihi</label>
                <input type="date" id="cal-range-start" class="form-control" value="${this.addDaysIso(today, -6)}" />
              </div>
              <div>
                <label style="font-size:11.5px; color:var(--text-muted);">Bitiş Tarihi</label>
                <input type="date" id="cal-range-end" class="form-control" value="${today}" />
              </div>
            </div>
            <button class="btn btn-primary btn-sm" style="width:100%;" onclick="App.applyCustomDateRange()">
              🎯 Seçili Tarih Aralığını Birlikte Çalış
            </button>
          </div>
        </div>

        <!-- SAĞ: AYLIK GRUPLANMIŞ GÜNLÜK DEFTER ARŞİVİ VE KELİME ARAMA -->
        <div>
          <div class="filter-bar" style="margin-bottom:14px;">
            <input
              type="text"
              class="filter-input"
              placeholder="Günlük defterlerde tarih (örn: 22 Ekim, Cuma) veya içinde geçen bir kelime ara..."
              value="${this.escapeAttr(this.archiveSearchQuery)}"
              oninput="App.archiveSearchQuery=this.value; App.renderCalendar();"
            />
            <button class="btn btn-secondary btn-sm" onclick="App.openDeckModal('daily')">➕ Yeni Günlük Defter</button>
          </div>

          ${monthGroups.length === 0 ? `
            <div class="dict-result-card" style="text-align:center; padding:40px;">
              <p style="color:var(--text-secondary);">Aramanızla eşleşen günlük defter bulunamadı.</p>
            </div>
          ` : monthGroups.map(grp => {
            const totalWords = grp.decks.reduce((s, d) => s + this.getDeckWordCount(d.id), 0);
            const ymLabel = grp.ym.includes("-") ? this.formatMonthLabel(grp.ym) : grp.ym;
            return `
              <div class="month-archive-box">
                <div class="month-archive-header">
                  <div>
                    <span>📅 ${this.escapeHtml(ymLabel)}</span>
                    <span class="pos-badge" style="margin-left:8px;">${grp.decks.length} Gün • ${totalWords} Kelime</span>
                  </div>
                  ${grp.ym.includes("-") ? `
                    <button class="btn btn-secondary btn-sm" onclick="App.selectMonth('${grp.ym}')">
                      🗓️ Bu Ayın Tümünü Çalış
                    </button>
                  ` : ""}
                </div>
                <div class="month-archive-list">
                  ${grp.decks.map(d => {
                    const iso = this.getDeckDate(d);
                    const count = this.getDeckWordCount(d.id);
                    const sampleWords = this.state.words
                      .filter(w => w.deckId === d.id)
                      .slice(0, 4)
                      .map(w => w.term)
                      .join(", ");
                    return `
                      <div class="switcher-item ${this.state.selectedDeckId === d.id ? "active" : ""}" onclick="App.selectDeck('${d.id}', true)">
                        <div>
                          <div style="font-weight:700; font-size:14px;">
                            ${iso === today ? "⭐ " : "📅 "}${this.escapeHtml(d.name)}
                            ${iso ? `<span style="font-size:11.5px; color:var(--text-muted); font-weight:500; margin-left:6px;">(${this.getWeekdayName(iso)})</span>` : ""}
                          </div>
                          <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">
                            ${sampleWords ? `Kelimeler: ${this.escapeHtml(sampleWords)}${count > 4 ? "..." : ""}` : "Henüz kelime eklenmedi"}
                          </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;" onclick="event.stopPropagation()">
                          <span class="nav-badge" style="background:var(--accent-soft); color:var(--accent);">${count} kelime</span>
                          <button class="btn btn-secondary btn-sm" onclick="App.selectDeck('${d.id}', false); App.navigate('flashcards');" title="Kartlarla Çalış">🃏</button>
                          <button class="btn btn-secondary btn-sm" onclick="App.selectDeck('${d.id}', false); App.navigate('quiz');" title="Test Çöz">📝</button>
                          <button class="btn btn-primary btn-sm" onclick="App.selectDeck('${d.id}', true)">Aç ➔</button>
                        </div>
                      </div>
                    `;
                  }).join("")}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  },

  // HIZLI DEFTER & GÜN ARAMA PALETİ (CTRL+P)
  openDeckSwitcher() {
    const modal = document.getElementById("deck-switcher-modal");
    const input = document.getElementById("deck-switcher-input");
    if (!modal) return;
    modal.classList.add("open");
    if (input) {
      input.value = "";
      setTimeout(() => input.focus(), 40);
    }
    this.renderDeckSwitcherResults("");
  },

  renderDeckSwitcherResults(query = "") {
    const container = document.getElementById("deck-switcher-results");
    if (!container) return;
    const q = query.trim().toLowerCase();
    const today = this.getTodayStr();

    const items = [];
    // Tüm günlük ve özel defterleri tara (kelime eşleşmesi dahil!)
    const allDecks = [...this.getDailyDecksSorted(), ...this.getCustomDecks()];
    allDecks.forEach(d => {
      const iso = this.getDeckDate(d) || "";
      const weekday = iso ? this.getWeekdayName(iso) : "";
      const deckWords = this.state.words.filter(w => w.deckId === d.id);
      const matchedWord = q
        ? deckWords.find(w => w.term.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q))
        : null;
      const textMatch = !q ||
        (d.name || "").toLowerCase().includes(q) ||
        (d.description || "").toLowerCase().includes(q) ||
        iso.includes(q) ||
        weekday.toLowerCase().includes(q) ||
        Boolean(matchedWord);

      if (textMatch) {
        items.push({
          id: d.id,
          icon: d.type === "daily" ? (iso === today ? "⭐" : "📅") : (d.icon || "📘"),
          title: d.name,
          subtitle: matchedWord
            ? `💡 Eşleşen kelime: "${matchedWord.term}" (${matchedWord.meaning})`
            : (d.type === "daily" && iso ? `${this.formatTurkishDate(iso)} • ${weekday}` : (d.description || "Özel Kelime Defteri")),
          count: deckWords.length
        });
      }
    });

    this.switcherItems = items.slice(0, 40);
    this.switcherActiveIdx = 0;

    if (this.switcherItems.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:24px; color:var(--text-secondary);">
          Eşleşen defter veya kelime bulunamadı.
        </div>
      `;
      return;
    }

    container.innerHTML = this.switcherItems.map((it, idx) => `
      <div class="switcher-item ${idx === this.switcherActiveIdx ? "active" : ""}" onclick="App.pickSwitcherItem(${idx})">
        <div>
          <div style="font-weight:700; font-size:14px;">${it.icon} ${this.escapeHtml(it.title)}</div>
          <div style="font-size:12px; color:var(--text-secondary);">${this.escapeHtml(it.subtitle)}</div>
        </div>
        <span class="nav-badge" style="background:var(--bg-elevated); color:var(--text-primary);">${it.count} kelime</span>
      </div>
    `).join("");
  },

  onDeckSwitcherKeydown(e) {
    if (!this.switcherItems.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.switcherActiveIdx = (this.switcherActiveIdx + 1) % this.switcherItems.length;
      this.highlightSwitcherItem();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.switcherActiveIdx = (this.switcherActiveIdx - 1 + this.switcherItems.length) % this.switcherItems.length;
      this.highlightSwitcherItem();
    } else if (e.key === "Enter") {
      e.preventDefault();
      this.pickSwitcherItem(this.switcherActiveIdx);
    } else if (e.key === "Escape") {
      this.closeModal("deck-switcher-modal");
    }
  },

  highlightSwitcherItem() {
    const els = document.querySelectorAll("#deck-switcher-results .switcher-item");
    els.forEach((el, i) => {
      el.classList.toggle("active", i === this.switcherActiveIdx);
      if (i === this.switcherActiveIdx) el.scrollIntoView({ block: "nearest" });
    });
  },

  pickSwitcherItem(idx) {
    const item = this.switcherItems[idx];
    if (!item) return;
    this.closeModal("deck-switcher-modal");
    this.selectDeck(item.id, true);
  },

  // MODALLAR VE YENİ DEFTER / GÜNLÜK DEFTER YÖNETİMİ
  openWordModal(wordId = null, prefill = null) {
    this.populateDeckSelectors();
    const modal = document.getElementById("word-modal");
    const title = document.getElementById("word-modal-title");
    if (!modal) return;

    const existing = wordId ? this.state.words.find(w => w.id === wordId) : null;
    const src = existing || prefill || {};

    if (title) title.textContent = existing ? "✏️ Kelimeyi Düzenle / Başka Deftere Taşı" : "➕ Kelime Defterine Ekle";
    document.getElementById("wm-id").value = existing ? existing.id : "";
    document.getElementById("wm-term").value = src.term || "";
    document.getElementById("wm-meaning").value = src.meaning || "";
    document.getElementById("wm-phonetic").value = src.phonetic || "";
    document.getElementById("wm-pos").value = src.pos || "noun";
    document.getElementById("wm-synonyms").value = Array.isArray(src.synonyms) ? src.synonyms.join(", ") : (src.synonyms || "");
    document.getElementById("wm-example").value = src.example || "";
    document.getElementById("wm-example-tr").value = src.exampleTr || "";
    document.getElementById("wm-mnemonic").value = src.mnemonic || "";

    const deckSel = document.getElementById("wm-deck");
    if (deckSel) {
      deckSel.value = existing?.deckId || (this.state.selectedDeckId !== "all" ? this.state.selectedDeckId : this.getTodayDailyDeckId());
    }

    this.checkWordModalDuplicate(src.term || "");
    modal.classList.add("open");
    setTimeout(() => document.getElementById("wm-term")?.focus(), 50);
  },

  async autoFillWordModal() {
    const termInput = document.getElementById("wm-term");
    const term = (termInput?.value || "").trim();
    if (!term) {
      this.toast("⚠️ Lütfen önce İngilizce kelimeyi yazın.");
      return;
    }

    const btn = document.getElementById("wm-autofill-btn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "⏳ Sözlükten Çekiliyor...";
    }

    const data = await this.lookupWordData(term, "en-tr");

    if (btn) {
      btn.disabled = false;
      btn.textContent = "✨ Sözlükten Otomatik Doldur";
    }

    if (data.meaning) document.getElementById("wm-meaning").value = data.meaning;
    if (data.phonetic) document.getElementById("wm-phonetic").value = data.phonetic;
    if (data.pos) document.getElementById("wm-pos").value = data.pos;
    if (data.synonyms?.length) document.getElementById("wm-synonyms").value = data.synonyms.slice(0, 5).join(", ");
    if (data.example) document.getElementById("wm-example").value = data.example;
    if (data.exampleTr) document.getElementById("wm-example-tr").value = data.exampleTr;
    if (data.mnemonic && !document.getElementById("wm-mnemonic").value) {
      document.getElementById("wm-mnemonic").value = data.mnemonic;
    }

    this.speak(term);
    this.toast(`✨ "${term}" için anlam, fonetik ve örnek cümle dolduruldu!`);
  },

  saveWordFromModal() {
    const id = document.getElementById("wm-id").value;
    const term = document.getElementById("wm-term").value.trim();
    const meaning = document.getElementById("wm-meaning").value.trim();
    const deckId = document.getElementById("wm-deck").value || this.getTodayDailyDeckId();

    if (!term || !meaning) {
      this.toast("⚠️ İngilizce kelime ve Türkçe anlamı zorunludur.");
      return;
    }

    const payload = {
      id: id || `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      deckId,
      term,
      meaning,
      phonetic: document.getElementById("wm-phonetic").value.trim(),
      pos: document.getElementById("wm-pos").value,
      synonyms: document.getElementById("wm-synonyms").value.trim(),
      example: document.getElementById("wm-example").value.trim(),
      exampleTr: document.getElementById("wm-example-tr").value.trim(),
      mnemonic: document.getElementById("wm-mnemonic").value.trim()
    };

    if (id) {
      const idx = this.state.words.findIndex(w => w.id === id);
      if (idx !== -1) {
        this.state.words[idx] = Object.assign({}, this.state.words[idx], payload);
      }
    } else {
      this.state.words.unshift(Object.assign({
        favorite: false,
        repetitions: 0,
        interval: 0,
        easeFactor: 2.5,
        nextReview: Date.now(),
        correctCount: 0,
        wrongCount: 0,
        status: "new"
      }, payload));
    }

    this.saveState();
    this.populateDeckSelectors();
    this.renderDashboard();
    this.renderNotebook();
    this.closeModal("word-modal");
    this.toast(`✅ "${term}" kaydedildi!`);
  },

  openBulkModal() {
    this.populateDeckSelectors();
    document.getElementById("bulk-modal")?.classList.add("open");
  },

  importBulkText() {
    const raw = document.getElementById("bulk-textarea")?.value || "";
    const deckId = document.getElementById("bulk-deck-select")?.value || this.getTodayDailyDeckId();
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let added = 0;

    lines.forEach(line => {
      const parts = line.includes("\t") ? line.split("\t") : line.split(/\s*[-;]\s*/);
      if (parts.length >= 2) {
        const term = parts[0].trim();
        const meaning = parts[1].trim();
        const example = (parts[2] || "").trim();
        if (term && meaning) {
          this.state.words.unshift({
            id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            deckId,
            term,
            meaning,
            phonetic: "",
            pos: "noun",
            synonyms: "",
            example,
            exampleTr: "",
            mnemonic: "",
            favorite: false,
            repetitions: 0,
            interval: 0,
            easeFactor: 2.5,
            nextReview: Date.now(),
            correctCount: 0,
            wrongCount: 0,
            status: "new"
          });
          added++;
        }
      }
    });

    if (added > 0) {
      document.getElementById("bulk-textarea").value = "";
      this.saveState();
      this.populateDeckSelectors();
      this.renderDashboard();
      this.renderNotebook();
      this.closeModal("bulk-modal");
      this.toast(`🎉 ${added} yeni kelime seçili deftere eklendi!`);
    } else {
      this.toast("⚠️ Geçerli satır bulunamadı. 'kelime - anlam' formatında yazın.");
    }
  },

  openDeckModal(defaultType = "daily") {
    const modal = document.getElementById("deck-modal");
    const titleEl = document.getElementById("deck-modal-title");
    const editIdEl = document.getElementById("dm-edit-id");
    const typeSel = document.getElementById("dm-type");
    const dateInput = document.getElementById("dm-date");
    const today = this.getTodayStr();

    if (titleEl) titleEl.textContent = "📁 Yeni Kelime Defteri Oluştur";
    if (editIdEl) editIdEl.value = "";
    if (typeSel) typeSel.value = defaultType;
    if (dateInput) dateInput.value = today;

    this.onDeckModalTypeChange(defaultType);
    modal?.classList.add("open");
  },

  openEditCurrentDeck() {
    const deckId = this.state.selectedDeckId;
    if (deckId === "all") return;
    const deck = this.state.decks.find(d => d.id === deckId);
    if (!deck) return;

    const modal = document.getElementById("deck-modal");
    const titleEl = document.getElementById("deck-modal-title");
    const editIdEl = document.getElementById("dm-edit-id");
    const typeSel = document.getElementById("dm-type");
    const dateGrp = document.getElementById("dm-date-group");
    const dateInput = document.getElementById("dm-date");

    if (titleEl) titleEl.textContent = "✏️ Kelime Defterini Düzenle";
    if (editIdEl) editIdEl.value = deck.id;
    if (typeSel) typeSel.value = deck.type || "custom";
    if (dateGrp) dateGrp.style.display = deck.type === "daily" ? "block" : "none";
    if (dateInput) dateInput.value = deck.date || this.getTodayStr();

    document.getElementById("dm-name").value = deck.name || "";
    document.getElementById("dm-desc").value = deck.description || "";
    document.getElementById("dm-icon").value = deck.icon || "📘";
    document.getElementById("dm-color").value = deck.color || "#6366f1";

    modal?.classList.add("open");
  },

  onDeckModalTypeChange(type) {
    const dateGrp = document.getElementById("dm-date-group");
    const nameInput = document.getElementById("dm-name");
    const descInput = document.getElementById("dm-desc");
    const iconInput = document.getElementById("dm-icon");
    const colorInput = document.getElementById("dm-color");
    const dateVal = document.getElementById("dm-date")?.value || this.getTodayStr();

    if (type === "daily") {
      if (dateGrp) dateGrp.style.display = "block";
      if (nameInput) nameInput.value = `${this.formatTurkishDate(dateVal)} — Günlük Defter`;
      if (descInput) descInput.value = `${this.formatTurkishDate(dateVal)} günü eklenen kelimeler (izole çalışma defteri).`;
      if (iconInput) iconInput.value = "📅";
      if (colorInput) colorInput.value = "#10b981";
    } else {
      if (dateGrp) dateGrp.style.display = "none";
      if (nameInput) nameInput.value = "";
      if (descInput) descInput.value = "";
      if (iconInput) iconInput.value = "📘";
      if (colorInput) colorInput.value = "#6366f1";
    }
  },

  onDeckModalDateChange(dateVal) {
    const type = document.getElementById("dm-type")?.value;
    if (type === "daily" && dateVal) {
      const nameInput = document.getElementById("dm-name");
      const descInput = document.getElementById("dm-desc");
      if (nameInput) nameInput.value = `${this.formatTurkishDate(dateVal)} — Günlük Defter`;
      if (descInput) descInput.value = `${this.formatTurkishDate(dateVal)} günü eklenen kelimeler (izole çalışma defteri).`;
    }
  },

  saveNewDeck() {
    const editId = document.getElementById("dm-edit-id")?.value || "";
    const type = document.getElementById("dm-type")?.value || "custom";
    const dateVal = document.getElementById("dm-date")?.value || this.getTodayStr();
    const name = document.getElementById("dm-name")?.value.trim();
    const description = document.getElementById("dm-desc")?.value.trim();
    const icon = document.getElementById("dm-icon")?.value.trim() || (type === "daily" ? "📅" : "📘");
    const color = document.getElementById("dm-color")?.value || "#6366f1";

    if (!name) {
      this.toast("⚠️ Lütfen defter adını girin.");
      return;
    }

    if (editId) {
      const existing = this.state.decks.find(d => d.id === editId);
      if (existing) {
        existing.name = name;
        existing.description = description;
        existing.icon = icon;
        existing.color = color;
        existing.type = type;
        if (type === "daily") existing.date = dateVal;
        this.saveState();
        this.populateDeckSelectors();
        this.closeModal("deck-modal");
        this.renderNotebook();
        this.toast(`✅ "${name}" güncellendi!`);
        return;
      }
    }

    const newDeck = {
      id: type === "daily" ? `deck-daily-${dateVal}-${Date.now().toString(36).slice(-3)}` : `deck-${Date.now()}`,
      name,
      description,
      icon,
      color,
      type,
      date: type === "daily" ? dateVal : undefined
    };

    this.state.decks.unshift(newDeck);
    this.state.selectedDeckId = newDeck.id;
    this.saveState();
    this.populateDeckSelectors();
    this.closeModal("deck-modal");
    this.navigate("notebook");
    this.toast(`📁 "${name}" oluşturuldu ve aktif defter olarak seçildi!`);
  },

  openBackupModal(preselectDeckId = null) {
    this.populateDeckSelectors();
    const exportSel = document.getElementById("export-deck-select");
    if (exportSel) {
      exportSel.value = preselectDeckId || this.state.selectedDeckId || "all";
    }
    document.getElementById("backup-modal")?.classList.add("open");
  },

  getWordsAndMetaForScope(scopeId) {
    const id = scopeId || this.state.selectedDeckId || "all";
    if (id === "all") {
      return {
        title: "Genel Kelime Paketi (Tüm Kelimelerim)",
        subtitle: "Günlük ve özel tüm defterlerinizdeki kelimelerin birleşik çalışması",
        words: [...this.state.words]
      };
    }
    if (this.isRangeSelection(id)) {
      const { start, end } = this.parseRange(id);
      const deckIds = new Set(
        this.state.decks
          .filter(d => d.type === "daily" && this.getDeckDate(d) >= start && this.getDeckDate(d) <= end)
          .map(d => d.id)
      );
      return {
        title: this.describeRange(start, end),
        subtitle: `${this.formatTurkishDate(start)} – ${this.formatTurkishDate(end)} tarihleri arasındaki günlük kelimeler`,
        words: this.state.words.filter(w => deckIds.has(w.deckId))
      };
    }
    const deck = this.state.decks.find(d => d.id === id);
    return {
      title: deck ? deck.name : "Kelime Defterim",
      subtitle: deck?.description || "LexiMind Seçili Kelime Defteri",
      words: this.state.words.filter(w => w.deckId === id)
    };
  },

  buildPrintableDeckHtml({ title, subtitle, words, layout = "cards", includeExamples = true, includeSynonyms = true }) {
    const statusMap = {
      new: { label: "Yeni", bg: "#eff6ff", color: "#2563eb" },
      learning: { label: "Öğreniliyor", bg: "#fffbeb", color: "#d97706" },
      familiar: { label: "Tanıdık", bg: "#f5f3ff", color: "#7c3aed" },
      mastered: { label: "Uzmanlaşıldı", bg: "#ecfdf5", color: "#059669" }
    };

    const masteredCount = words.filter(w => w.status === "mastered" || w.status === "familiar").length;
    const learningCount = words.filter(w => w.status === "learning").length;
    const newCount = words.length - masteredCount - learningCount;
    const dateLabel = this.formatTurkishDate(this.getTodayStr());

    let bodySectionHtml = "";

    if (layout === "cards") {
      bodySectionHtml = `
        <div class="cards-grid">
          ${words.map((w, idx) => {
            const st = statusMap[w.status] || statusMap.new;
            return `
              <div class="vocab-card">
                <div class="vc-top">
                  <div class="vc-term-wrap">
                    <span class="vc-index">${idx + 1}.</span>
                    <span class="vc-term">${this.escapeHtml(w.term)}</span>
                    ${w.phonetic ? `<span class="vc-phonetic">${this.escapeHtml(w.phonetic)}</span>` : ""}
                  </div>
                  <div class="vc-badges">
                    ${w.pos ? `<span class="vc-pos">${this.escapeHtml(w.pos)}</span>` : ""}
                    <span class="vc-status" style="background:${st.bg}; color:${st.color};">${st.label}</span>
                  </div>
                </div>
                <div class="vc-meaning">🇹🇷 ${this.escapeHtml(w.meaning)}</div>
                ${includeSynonyms && w.synonyms ? `
                  <div class="vc-syn"><b>Eş Anlam:</b> ${this.escapeHtml(w.synonyms)}</div>
                ` : ""}
                ${includeExamples && w.example ? `
                  <div class="vc-example">
                    <div>"${this.escapeHtml(w.example)}"</div>
                    ${w.exampleTr ? `<div class="vc-example-tr">➔ ${this.escapeHtml(w.exampleTr)}</div>` : ""}
                  </div>
                ` : ""}
                ${includeSynonyms && w.mnemonic ? `
                  <div class="vc-mnemonic">💡 <b>İpucu:</b> ${this.escapeHtml(w.mnemonic)}</div>
                ` : ""}
              </div>
            `;
          }).join("")}
        </div>
      `;
    } else if (layout === "worksheet") {
      bodySectionHtml = `
        <div class="worksheet-banner">
          ✍️ <b>Kendini Sına Çalışma Kağıdı:</b> Aşağıdaki İngilizce kelimelerin Türkçe karşılıklarını boş bırakılan alanlara yazarak kendinizi test edin. Cevap anahtarı son sayfadadır.
        </div>
        <table class="vocab-table">
          <thead>
            <tr>
              <th style="width:38px;">#</th>
              <th style="width:28%;">🇬🇧 İngilizce Kelime</th>
              <th style="width:34%;">🇹🇷 Türkçe Anlamını Yazın</th>
              <th>💬 Bağlam / Örnek Cümle İpucu</th>
            </tr>
          </thead>
          <tbody>
            ${words.map((w, idx) => `
              <tr>
                <td class="td-num">${idx + 1}</td>
                <td>
                  <div class="tbl-term">${this.escapeHtml(w.term)}</div>
                  <div class="tbl-meta">
                    ${w.phonetic ? `<span>${this.escapeHtml(w.phonetic)}</span>` : ""}
                    ${w.pos ? `<span class="vc-pos">${this.escapeHtml(w.pos)}</span>` : ""}
                  </div>
                </td>
                <td>
                  <div class="worksheet-line"></div>
                </td>
                <td>
                  ${includeExamples && w.example ? `<div class="tbl-ex">"${this.escapeHtml(this.maskWordInSentence(w.example, w.term))}"</div>` : `<span style="color:#94a3b8;">—</span>`}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="answer-key-box">
          <h4>🔑 Cevap Anahtarı</h4>
          <div class="answer-key-grid">
            ${words.map((w, idx) => `
              <div class="ak-item"><b>${idx + 1}. ${this.escapeHtml(w.term)}:</b> ${this.escapeHtml(w.meaning)}</div>
            `).join("")}
          </div>
        </div>
      `;
    } else {
      bodySectionHtml = `
        <table class="vocab-table">
          <thead>
            <tr>
              <th style="width:36px;">#</th>
              <th style="width:24%;">🇬🇧 İngilizce &amp; Okunuş</th>
              <th style="width:26%;">🇹🇷 Türkçe Anlamı</th>
              <th>💬 Örnek Cümle &amp; Eş Anlamlılar</th>
            </tr>
          </thead>
          <tbody>
            ${words.map((w, idx) => `
              <tr>
                <td class="td-num">${idx + 1}</td>
                <td>
                  <div class="tbl-term">${this.escapeHtml(w.term)}</div>
                  <div class="tbl-meta">
                    ${w.phonetic ? `<span class="vc-phonetic">${this.escapeHtml(w.phonetic)}</span>` : ""}
                    ${w.pos ? `<span class="vc-pos">${this.escapeHtml(w.pos)}</span>` : ""}
                  </div>
                </td>
                <td class="tbl-meaning">${this.escapeHtml(w.meaning)}</td>
                <td>
                  ${includeExamples && w.example ? `
                    <div class="tbl-ex">"${this.escapeHtml(w.example)}"</div>
                    ${w.exampleTr ? `<div class="tbl-ex-tr">🇹🇷 ${this.escapeHtml(w.exampleTr)}</div>` : ""}
                  ` : ""}
                  ${includeSynonyms && w.synonyms ? `<div class="tbl-syn"><b>Eş Anlam:</b> ${this.escapeHtml(w.synonyms)}</div>` : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }

    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>${this.escapeHtml(title)} — LexiMind PDF</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 13mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 12px;
      line-height: 1.45;
    }
    .doc-header {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: #ffffff;
      padding: 20px 24px;
      border-radius: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .doc-brand {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.9;
      margin-bottom: 4px;
    }
    .doc-title {
      font-size: 21px;
      font-weight: 800;
      letter-spacing: -0.3px;
      margin-bottom: 4px;
    }
    .doc-sub {
      font-size: 11.5px;
      opacity: 0.9;
    }
    .doc-stats {
      display: flex;
      gap: 10px;
      text-align: center;
    }
    .stat-pill {
      background: rgba(255, 255, 255, 0.16);
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 10px;
      padding: 8px 12px;
      min-width: 72px;
    }
    .stat-pill b {
      display: block;
      font-size: 16px;
      font-weight: 800;
    }
    .stat-pill span {
      font-size: 10px;
      opacity: 0.9;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 11px;
    }
    .vocab-card {
      border: 1px solid #cbd5e1;
      border-radius: 11px;
      padding: 12px 14px;
      background: #ffffff;
      page-break-inside: avoid;
      break-inside: avoid;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .vc-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 6px;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 5px;
    }
    .vc-term-wrap {
      display: flex;
      align-items: baseline;
      gap: 5px;
      flex-wrap: wrap;
    }
    .vc-index {
      font-size: 11px;
      font-weight: 800;
      color: #64748b;
    }
    .vc-term {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }
    .vc-phonetic {
      font-size: 11px;
      color: #4f46e5;
      font-family: "Segoe UI", Arial, sans-serif;
    }
    .vc-badges {
      display: flex;
      gap: 4px;
      align-items: center;
      flex-shrink: 0;
    }
    .vc-pos {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1.5px 6px;
      border-radius: 5px;
      background: #eef2ff;
      color: #4f46e5;
      text-transform: lowercase;
    }
    .vc-status {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1.5px 6px;
      border-radius: 5px;
    }
    .vc-meaning {
      font-size: 13px;
      font-weight: 700;
      color: #059669;
    }
    .vc-syn {
      font-size: 10.5px;
      color: #475569;
    }
    .vc-example {
      background: #f8fafc;
      border-left: 3px solid #6366f1;
      padding: 6px 9px;
      border-radius: 5px;
      font-size: 11px;
      color: #334155;
      margin-top: 2px;
    }
    .vc-example-tr {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 2px;
    }
    .vc-mnemonic {
      background: #fffbeb;
      color: #b45309;
      padding: 5px 8px;
      border-radius: 5px;
      font-size: 10.5px;
    }
    .vocab-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
      font-size: 11.5px;
    }
    .vocab-table th {
      background: #f1f5f9;
      color: #1e293b;
      text-align: left;
      padding: 9px 10px;
      border-bottom: 2px solid #cbd5e1;
      font-size: 11px;
      font-weight: 800;
    }
    .vocab-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .vocab-table tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .vocab-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .td-num {
      font-weight: 700;
      color: #64748b;
      text-align: center;
    }
    .tbl-term {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }
    .tbl-meta {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-top: 2px;
    }
    .tbl-meaning {
      font-size: 12.5px;
      font-weight: 700;
      color: #059669;
    }
    .tbl-ex {
      font-style: italic;
      color: #334155;
    }
    .tbl-ex-tr {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 2px;
    }
    .tbl-syn {
      font-size: 10.5px;
      color: #475569;
      margin-top: 3px;
    }
    .worksheet-banner {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      color: #92400e;
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 11.5px;
    }
    .worksheet-line {
      border-bottom: 1.5px dashed #94a3b8;
      height: 22px;
      width: 100%;
    }
    .answer-key-box {
      margin-top: 22px;
      padding-top: 14px;
      border-top: 2px dashed #cbd5e1;
      page-break-inside: avoid;
    }
    .answer-key-box h4 {
      font-size: 12px;
      margin-bottom: 8px;
      color: #334155;
    }
    .answer-key-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px 12px;
      font-size: 10px;
      color: #475569;
    }
    .doc-footer {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="doc-header">
    <div>
      <div class="doc-brand">📚 LexiMind — Kişisel İngilizce Kelime Defteri</div>
      <div class="doc-title">${this.escapeHtml(title)}</div>
      <div class="doc-sub">${this.escapeHtml(subtitle)} • Oluşturulma: ${this.escapeHtml(dateLabel)}</div>
    </div>
    <div class="doc-stats">
      <div class="stat-pill"><b>${words.length}</b><span>Toplam Kelime</span></div>
      <div class="stat-pill"><b>${masteredCount}</b><span>Öğrenilen</span></div>
      <div class="stat-pill"><b>${learningCount + newCount}</b><span>Çalışılan</span></div>
    </div>
  </div>

  ${bodySectionHtml}

  <div class="doc-footer">
    <span>LexiMind Akıllı Kelime Defteri &amp; Öğrenme Stüdyosu tarafından hazırlanmıştır.</span>
    <span>Toplam ${words.length} kelime • ${this.escapeHtml(dateLabel)}</span>
  </div>
</body>
</html>`;
  },

  async exportDeckPDF(previewOnly = false) {
    const scopeId = document.getElementById("export-deck-select")?.value || this.state.selectedDeckId || "all";
    const layout = document.getElementById("export-pdf-layout")?.value || "cards";
    const sortBy = document.getElementById("export-pdf-sort")?.value || "added";
    const includeExamples = document.getElementById("export-inc-examples")?.checked ?? true;
    const includeSynonyms = document.getElementById("export-inc-synonyms")?.checked ?? true;

    const { title, subtitle, words } = this.getWordsAndMetaForScope(scopeId);
    if (!words.length) {
      this.toast("⚠️ Seçtiğiniz defterde dışa aktarılacak kelime bulunmuyor.");
      return;
    }

    const sortedWords = [...words];
    if (sortBy === "az") {
      sortedWords.sort((a, b) => (a.term || "").localeCompare(b.term || ""));
    } else if (sortBy === "status") {
      const rank = { learning: 0, new: 1, familiar: 2, mastered: 3 };
      sortedWords.sort((a, b) => (rank[a.status || "new"] ?? 1) - (rank[b.status || "new"] ?? 1));
    }

    const htmlDoc = this.buildPrintableDeckHtml({
      title,
      subtitle,
      words: sortedWords,
      layout,
      includeExamples,
      includeSynonyms
    });

    if (previewOnly) {
      const win = window.open("", "_blank");
      if (win) {
        win.document.open();
        win.document.write(htmlDoc);
        win.document.close();
        setTimeout(() => {
          win.focus();
          win.print();
        }, 350);
      }
      return;
    }

    const btn = document.getElementById("export-pdf-btn");
    const origText = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = "⏳ Yüksek Kaliteli PDF Hazırlanıyor...";
    }

    const safeFileName = title
      .replace(/[^\w\sğüşıöçĞÜŞİÖÇ-]/g, "")
      .trim()
      .replace(/\s+/g, "_") || "Kelime_Defteri";

    try {
      const res = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: htmlDoc })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `LexiMind_${safeFileName}_${this.getTodayStr()}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        this.closeModal("backup-modal");
        this.toast(`📄 "${title}" PDF kitapçığı olarak indirildi!`);
        return;
      }
    } catch (_) {} finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    }

    // Yedek yöntem: Sunucu kapalıysa doğrudan yazdırma penceresini aç
    this.exportDeckPDF(true);
  },

  exportJSON() {
    const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `LexiMind_Kelime_Defterim_${this.getTodayStr()}.json`;
    a.click();
    this.toast("📥 JSON yedeği indirildi.");
  },

  exportCSV() {
    const scopeId = document.getElementById("export-deck-select")?.value || this.state.selectedDeckId || "all";
    const { title, words } = this.getWordsAndMetaForScope(scopeId);
    const headers = ["Defter", "İngilizce", "Türkçe Anlamı", "Okunuş", "Tür", "Örnek Cümle", "Örnek Çevirisi", "İpucu", "Durum"];
    const deckMap = {};
    this.state.decks.forEach(d => (deckMap[d.id] = d.name));
    const rows = words.map(w =>
      [deckMap[w.deckId] || "Genel", w.term, w.meaning, w.phonetic, w.pos, w.example, w.exampleTr, w.mnemonic, w.status]
        .map(v => `"${String(v || "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const safeFileName = title.replace(/[^\w\sğüşıöçĞÜŞİÖÇ-]/g, "").trim().replace(/\s+/g, "_") || "Kelimeler";
    a.download = `LexiMind_${safeFileName}_${this.getTodayStr()}.csv`;
    a.click();
    this.toast("📊 Excel uyumlu CSV dosyası indirildi.");
  },

  importJSONFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed && Array.isArray(parsed.words)) {
          this.state = Object.assign({}, this.state, parsed);
          this.ensureDefaultAndDailyDecks();
          this.saveState();
          this.populateDeckSelectors();
          this.renderDashboard();
          this.renderNotebook();
          this.closeModal("backup-modal");
          this.toast(`🎉 ${parsed.words.length} kelime başarıyla geri yüklendi!`);
        }
      } catch (_) {
        this.toast("❌ Geçersiz JSON dosyası.");
      }
    };
    reader.readAsText(file);
  },

  closeModal(id) {
    document.getElementById(id)?.classList.remove("open");
  },

  setupKeyboardShortcuts() {
    window.addEventListener("keydown", e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("top-dict-input")?.focus();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        this.openDeckSwitcher();
        return;
      }
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-backdrop.open").forEach(m => m.classList.remove("open"));
        document.getElementById("top-dict-dropdown")?.classList.remove("open");
        return;
      }

      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const activeId = document.querySelector(".view-section.active")?.id;
      if (activeId === "view-flashcards") {
        if (e.code === "Space") {
          e.preventDefault();
          this.flipFlashcard();
        } else if (e.key === "ArrowRight") {
          this.nextFlashcard();
        } else if (e.key === "ArrowLeft") {
          this.prevFlashcard();
        } else if (e.key === "1") {
          this.markFlashcard(false);
        } else if (e.key === "2") {
          this.markFlashcard(true);
        } else if (e.key.toLowerCase() === "s") {
          const w = this.fcList[this.fcIndex];
          if (w) this.speak(w.term);
        }
      } else if (activeId === "view-srs") {
        if (e.code === "Space") {
          e.preventDefault();
          this.flipSRSCard();
        } else if (["1", "2", "3", "4"].includes(e.key) && this.srsQueue.length > this.srsIndex) {
          this.rateSRSCard(parseInt(e.key, 10) - 1);
        } else if (e.key.toLowerCase() === "s") {
          const w = this.srsQueue[this.srsIndex];
          if (w) this.speak(w.term);
        }
      } else if (activeId === "view-cloze") {
        if (["1", "2", "3", "4"].includes(e.key)) {
          const btns = document.querySelectorAll("#cloze-options .option-btn");
          const idx = parseInt(e.key, 10) - 1;
          if (btns[idx] && !btns[idx].disabled) btns[idx].click();
        } else if (e.key === "Enter" && this.clozeAnswered) {
          this.nextCloze();
        }
      } else if (activeId === "view-quiz" && ["1", "2", "3", "4"].includes(e.key)) {
        const btns = document.querySelectorAll("#quiz-options .option-btn");
        const idx = parseInt(e.key, 10) - 1;
        if (btns[idx] && !btns[idx].disabled) btns[idx].click();
      } else if (activeId === "view-learn") {
        if (["1", "2", "3", "4"].includes(e.key)) {
          const btns = document.querySelectorAll("#learn-options .option-btn");
          const idx = parseInt(e.key, 10) - 1;
          if (btns[idx] && !btns[idx].disabled) btns[idx].click();
        } else if (e.key === "Enter" && this.learnAnswered) {
          this.nextLearnStep();
        }
      }
    });
  },

  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  escapeAttr(str) {
    return String(str ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/"/g, "&quot;");
  },

  toast(msg) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  }
};

window.addEventListener("DOMContentLoaded", () => App.init());
