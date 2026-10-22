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
    studyHistory: {}
  },

  // Hızlı ekleme geçici verisi
  quickEntryMeta: null,

  // Aktif mod durumları
  dictDirection: "en-tr",
  lastDictResult: null,

  srsQueue: [],
  srsIndex: 0,
  srsFlipped: false,

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
  writeAnswered: false,

  quizList: [],
  quizIndex: 0,
  quizScore: 0,
  quizWrongWords: [],
  quizDir: "en-tr",
  quizAnswered: false,

  matchTiles: [],
  matchSelected: null,
  matchMatchedCount: 0,
  matchStartTime: 0,
  matchTimerId: null,

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
    let loaded = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) loaded = JSON.parse(raw);
    } catch (e) {
      console.warn("LocalStorage okunamadı:", e);
    }

    if (!loaded) {
      try {
        const res = await fetch("/api/storage");
        if (res.ok) {
          const json = await res.json();
          if (json && json.ok && json.data && Array.isArray(json.data.words)) {
            loaded = json.data;
          }
        }
      } catch (_) {}
    }

    if (loaded && Array.isArray(loaded.decks)) {
      this.state = Object.assign({}, this.state, loaded);
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

  ensureDefaultAndDailyDecks() {
    // Mevcut setlere tür (type) etiketi ekle
    this.state.decks.forEach(d => {
      if (!d.type) {
        d.type = d.id.startsWith("deck-daily-") ? "daily" : "custom";
      }
    });

    // Bugünün Günlük Defteri yoksa otomatik oluştur
    const todayIso = this.getTodayStr();
    const todayDeckId = this.getTodayDailyDeckId();
    let todayDeck = this.state.decks.find(d => d.id === todayDeckId);
    if (!todayDeck) {
      todayDeck = {
        id: todayDeckId,
        name: `${this.formatTurkishDate(todayIso)} — Günlük Defter`,
        description: `${this.formatTurkishDate(todayIso)} tarihinde eklediğiniz günlük kelimeler (diğer kelimeler karışmadan çalışılır).`,
        icon: "📅",
        color: "#10b981",
        type: "daily",
        date: todayIso
      };
      this.state.decks.unshift(todayDeck);
      this.saveState();
    }
  },

  saveState() {
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

  checkStreak() {
    const today = this.getTodayStr();
    if (!this.state.lastStudyDate) {
      this.state.lastStudyDate = today;
      this.state.streak = 1;
      return;
    }
    if (this.state.lastStudyDate !== today) {
      const last = new Date(this.state.lastStudyDate);
      const curr = new Date(today);
      const diffDays = Math.round((curr - last) / 86400000);
      if (diffDays > 1) {
        this.state.streak = 1;
      }
      this.state.dailyProgress = 0;
      this.state.lastStudyDate = today;
      this.saveState();
    }
  },

  recordStudyAction() {
    const today = this.getTodayStr();
    if (this.state.lastStudyDate !== today) {
      this.state.streak = (this.state.streak || 1) + 1;
      this.state.lastStudyDate = today;
      this.state.dailyProgress = 0;
    }
    this.state.dailyProgress = (this.state.dailyProgress || 0) + 1;
    if (!this.state.studyHistory) this.state.studyHistory = {};
    this.state.studyHistory[today] = (this.state.studyHistory[today] || 0) + 1;

    if (this.state.dailyProgress === this.state.dailyGoal) {
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
    if (this.state.selectedDeckId === "all") {
      return {
        id: "all",
        name: "Genel Kelime Paketi (Tüm Kelimelerim)",
        description: "Günlük ve özel tüm defterlerinizdeki kelimelerin birleşik genel paketi.",
        icon: "🌍",
        type: "general"
      };
    }
    return this.state.decks.find(d => d.id === this.state.selectedDeckId) || {
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

    if (iconEl) iconEl.textContent = deck.icon || "📓";
    if (nameEl) nameEl.textContent = `${deck.name} (${wordsCount} Kelime)`;
    if (badgeEl) {
      if (deck.id === "all") {
        badgeEl.textContent = "🌍 Genel Paket Modu";
        badgeEl.style.background = "var(--info-soft)";
        badgeEl.style.color = "var(--info)";
      } else if (deck.type === "daily") {
        badgeEl.textContent = "📅 Günlük İzole Mod (Diğer Kelimeler Karışmaz)";
        badgeEl.style.background = "var(--success-soft)";
        badgeEl.style.color = "var(--success)";
      } else {
        badgeEl.textContent = "📂 Özel Defter Modu (Sadece Bu Defter)";
        badgeEl.style.background = "var(--accent-soft)";
        badgeEl.style.color = "var(--accent)";
      }
    }
    if (descEl) {
      descEl.textContent = deck.id === "all"
        ? `Tüm defterlerinizdeki toplam ${wordsCount} kelime bir arada (${dueCount} tekrar bekliyor).`
        : `Şu an sadece "${deck.name}" içindeki ${wordsCount} kelimeye odaklandınız. Kartlar, Test ve Yazma modlarında başka defterlerden kelime sorulmaz.`;
    }
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
    }
  },

  getActiveWords() {
    if (this.state.selectedDeckId === "all") {
      return this.state.words;
    }
    return this.state.words.filter(w => w.deckId === this.state.selectedDeckId);
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

  getDueWords(wordsPool = null) {
    const pool = wordsPool || this.getActiveWords();
    const now = Date.now();
    return pool.filter(w => !w.nextReview || w.nextReview <= now);
  },

  onGlobalDeckChange(deckId) {
    this.selectDeck(deckId, false);
  },

  populateDeckSelectors() {
    const globalSel = document.getElementById("global-deck-select");
    const wmSel = document.getElementById("wm-deck");
    const bulkSel = document.getElementById("bulk-deck-select");
    const sidebarList = document.getElementById("sidebar-decks-list");

    const dailyDecks = this.state.decks.filter(d => d.type === "daily");
    const customDecks = this.state.decks.filter(d => d.type !== "daily");

    if (globalSel) {
      const current = this.state.selectedDeckId || "all";
      let html = `<option value="all">🌍 Genel Kelime Paketi (Tümü: ${this.state.words.length})</option>`;
      if (dailyDecks.length > 0) {
        html += `<optgroup label="📅 Gün Gün Kelime Defterlerim">`;
        dailyDecks.forEach(d => {
          const c = this.state.words.filter(w => w.deckId === d.id).length;
          html += `<option value="${d.id}">${d.icon || "📅"} ${this.escapeHtml(d.name)} (${c})</option>`;
        });
        html += `</optgroup>`;
      }
      if (customDecks.length > 0) {
        html += `<optgroup label="📂 Özel Kelime Defterlerim">`;
        customDecks.forEach(d => {
          const c = this.state.words.filter(w => w.deckId === d.id).length;
          html += `<option value="${d.id}">${d.icon || "📘"} ${this.escapeHtml(d.name)} (${c})</option>`;
        });
        html += `</optgroup>`;
      }
      globalSel.innerHTML = html;
      globalSel.value = current;
    }

    const deckOptions = [
      ...dailyDecks.map(d => `<option value="${d.id}">📅 ${this.escapeHtml(d.name)}</option>`),
      ...customDecks.map(d => `<option value="${d.id}">${d.icon || "📘"} ${this.escapeHtml(d.name)}</option>`)
    ].join("");

    if (wmSel) {
      wmSel.innerHTML = deckOptions;
      if (this.state.selectedDeckId !== "all") wmSel.value = this.state.selectedDeckId;
    }
    if (bulkSel) {
      bulkSel.innerHTML = deckOptions;
      if (this.state.selectedDeckId !== "all") bulkSel.value = this.state.selectedDeckId;
    }

    // Sol menüdeki hızlı defter geçiş listesi
    if (sidebarList) {
      const allActive = this.state.selectedDeckId === "all";
      let sHtml = `
        <li class="sidebar-deck-item ${allActive ? "active" : ""}" onclick="App.selectDeck('all', true)">
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">🌍 Genel Paket (Tümü)</span>
          <span style="font-size:11px; opacity:0.8;">${this.state.words.length}</span>
        </li>
      `;
      this.state.decks.forEach(d => {
        const c = this.state.words.filter(w => w.deckId === d.id).length;
        const isAct = this.state.selectedDeckId === d.id;
        sHtml += `
          <li class="sidebar-deck-item ${isAct ? "active" : ""}" onclick="App.selectDeck('${d.id}', true)">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${d.icon || "📘"} ${this.escapeHtml(d.name)}</span>
            <span style="font-size:11px; opacity:0.8;">${c}</span>
          </li>
        `;
      });
      sidebarList.innerHTML = sHtml;
    }
  },

  updateTopCounters() {
    const activeWords = this.getActiveWords();
    const totalWords = this.state.words.length;
    const todayDeckId = this.getTodayDailyDeckId();
    const todayWordsCount = this.state.words.filter(w => w.deckId === todayDeckId).length;
    const dueWords = this.getDueWords(activeWords).length;
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
    setEl("nav-due-count", dueWords);
    setEl("stat-total", activeWords.length);
    setEl("stat-due", dueWords);
    setEl("stat-mastered", masteredWords);
    setEl("stat-accuracy", `%${accuracy}`);
    setEl("streak-count", this.state.streak || 1);

    const prog = Math.min(this.state.dailyProgress || 0, this.state.dailyGoal || 15);
    const goal = this.state.dailyGoal || 15;
    setEl("daily-goal-text", `${this.state.dailyProgress || 0} / ${goal} pratik`);
    const bar = document.getElementById("daily-goal-bar");
    if (bar) bar.style.width = `${Math.min(100, Math.round((prog / goal) * 100))}%`;
  },

  // 1. ANA PANEL (DASHBOARD)
  renderDashboard() {
    this.updateTopCounters();
    this.populateDeckSelectors();

    const dailyGrid = document.getElementById("dashboard-daily-decks-grid");
    const customGrid = document.getElementById("dashboard-decks-grid");

    const dailyDecks = this.state.decks.filter(d => d.type === "daily");
    const customDecks = this.state.decks.filter(d => d.type !== "daily");

    if (dailyGrid) {
      dailyGrid.innerHTML = dailyDecks.map(d => this.renderDeckCardHtml(d, true)).join("");
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

    const dailyDecks = this.state.decks.filter(d => d.type === "daily");
    const customDecks = this.state.decks.filter(d => d.type !== "daily");

    let html = `
      <button class="notebook-tab ${this.state.selectedDeckId === "all" ? "active" : ""}" onclick="App.selectDeck('all', true)">
        <span>🌍 Genel Paket (Tümü)</span>
        <span class="tab-count">${this.state.words.length}</span>
      </button>
    `;

    dailyDecks.forEach(d => {
      const c = this.state.words.filter(w => w.deckId === d.id).length;
      const act = this.state.selectedDeckId === d.id;
      html += `
        <button class="notebook-tab ${act ? "active" : ""}" onclick="App.selectDeck('${d.id}', true)">
          <span>${d.icon || "📅"} ${this.escapeHtml(d.name)}</span>
          <span class="tab-count">${c}</span>
        </button>
      `;
    });

    customDecks.forEach(d => {
      const c = this.state.words.filter(w => w.deckId === d.id).length;
      const act = this.state.selectedDeckId === d.id;
      html += `
        <button class="notebook-tab ${act ? "active" : ""}" onclick="App.selectDeck('${d.id}', true)">
          <span>${d.icon || "📘"} ${this.escapeHtml(d.name)}</span>
          <span class="tab-count">${c}</span>
        </button>
      `;
    });

    html += `
      <button class="notebook-tab" onclick="App.openDeckModal('daily')" style="border-style:dashed; color:var(--success);">
        ➕ Yeni Günlük Defter
      </button>
      <button class="notebook-tab" onclick="App.openDeckModal('custom')" style="border-style:dashed; color:var(--accent);">
        ➕ Yeni Özel Defter
      </button>
    `;

    bar.innerHTML = html;
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

    // Hangi deftere kaydedilecek? Eğer "all" (Genel Paket) seçiliyse bugünün günlük defterine veya ilk sete kaydet
    const targetDeckId = this.state.selectedDeckId === "all"
      ? this.getTodayDailyDeckId()
      : this.state.selectedDeckId;

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
      const targetName = deck.id === "all"
        ? `Bugünün Günlük Defteri (${this.formatTurkishDate(this.getTodayStr())})`
        : deck.name;
      targetLabel.textContent = `⚡ Hızlı Kelime Yaz — Hedef Defter: ${targetName}`;
    }
    if (delBtn) delBtn.style.display = deck.id === "all" ? "none" : "inline-flex";
    if (editBtn) editBtn.style.display = deck.id === "all" ? "none" : "inline-flex";

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

  // 4. SM-2 ARALIKLI TEKRAR SİSTEMİ
  startSRS(forceAll = false) {
    const pool = this.getActiveWords();
    if (pool.length === 0) {
      const container = document.getElementById("srs-stage-container");
      if (container) container.innerHTML = this.getEmptyDeckStudyHtml();
      return;
    }
    const due = forceAll ? [...pool] : this.getDueWords(pool);
    this.srsQueue = this.shuffleArray(due);
    this.srsIndex = 0;
    this.srsFlipped = false;
    this.renderSRSCard();
  },

  renderSRSCard() {
    const container = document.getElementById("srs-stage-container");
    const badge = document.getElementById("srs-counter-badge");
    if (!container) return;

    if (this.getActiveWords().length === 0) {
      container.innerHTML = this.getEmptyDeckStudyHtml();
      return;
    }

    const remaining = this.srsQueue.length - this.srsIndex;
    if (badge) badge.textContent = `${Math.max(0, remaining)} Kelime Kaldı`;

    if (this.srsIndex >= this.srsQueue.length) {
      const deck = this.getSelectedDeckObject();
      container.innerHTML = `
        <div class="study-box" style="text-align:center; padding:48px 28px;">
          <div style="font-size:54px; margin-bottom:12px;">🎉</div>
          <h2 style="margin-bottom:8px;">"${this.escapeHtml(deck.name)}" İçin Bekleyen Tüm Tekrarları Bitirdin!</h2>
          <p style="color:var(--text-secondary); max-width:500px; margin:0 auto 24px;">
            İstersen bu defterdeki tüm kelimelerle tekrar turu başlatabilir veya diğer öğrenme modlarına geçebilirsin.
          </p>
          <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="App.startSRS(true)">🔄 Bu Defterdeki Tüm Kelimelerle Çalış</button>
            <button class="btn btn-secondary" onclick="App.navigate('cloze')">🧩 Cümle Tamamlama Moduna Geç</button>
            <button class="btn btn-secondary" onclick="App.navigate('write')">✍️ Yazarak Çalış</button>
          </div>
        </div>
      `;
      return;
    }

    const w = this.srsQueue[this.srsIndex];
    const safeTerm = this.escapeAttr(w.term);

    const nextHard = Math.max(1, Math.round((w.interval || 1) * 1.2));
    const nextGood = w.repetitions === 0 ? 1 : w.repetitions === 1 ? 3 : Math.round((w.interval || 3) * (w.easeFactor || 2.5));
    const nextEasy = w.repetitions === 0 ? 4 : Math.round((w.interval || 4) * (w.easeFactor || 2.5) * 1.3);

    container.innerHTML = `
      <div class="flashcard-stage">
        <div class="flashcard-scene" onclick="App.flipSRSCard()">
          <div class="flashcard-3d ${this.srsFlipped ? "is-flipped" : ""}" id="srs-card-3d">
            <div class="flashcard-face">
              <span class="card-face-label">🇬🇧 İNGİLİZCE KELİME (SM-2 AKILLI TEKRAR)</span>
              <div class="card-face-actions" onclick="event.stopPropagation()">
                <button class="btn-icon" onclick="App.speak('${safeTerm}')" title="Telaffuzu Dinle">🔊</button>
              </div>
              <div class="card-main-word">${this.escapeHtml(w.term)}</div>
              ${w.phonetic ? `<div class="card-phonetic">${this.escapeHtml(w.phonetic)}</div>` : ""}
              ${w.pos ? `<span class="pos-badge" style="font-size:13px;">${this.escapeHtml(w.pos)}</span>` : ""}
              <span class="card-flip-hint">👆 Cevabı ve örnek cümleyi görmek için tıkla veya Boşluk (Space) tuşuna bas</span>
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
            <span class="srs-time">&lt; 10 dk</span>
            <span class="srs-label">🔴 Hatırlamadım</span>
          </button>
          <button class="srs-btn hard" onclick="App.rateSRSCard(1)">
            <span class="srs-time">${nextHard} gün</span>
            <span class="srs-label">🟠 Zorlandım</span>
          </button>
          <button class="srs-btn good" onclick="App.rateSRSCard(2)">
            <span class="srs-time">${nextGood} gün</span>
            <span class="srs-label">🟢 İyi Hatırladım</span>
          </button>
          <button class="srs-btn easy" onclick="App.rateSRSCard(3)">
            <span class="srs-time">${nextEasy} gün</span>
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

  // 5. 3B KELİME KARTLARI
  initFlashcards() {
    this.fcList = [...this.getActiveWords()];
    this.fcIndex = 0;
    this.fcFlipped = false;
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

    const w = this.fcList[this.fcIndex];
    const safeTerm = this.escapeAttr(w.term);
    const frontIsEn = this.fcFrontLang === "en";

    stage.innerHTML = `
      <div style="width:100%; display:flex; justify-content:space-between; align-items:center; font-size:13.5px; color:var(--text-secondary);">
        <span>Kart <b>${this.fcIndex + 1} / ${this.fcList.length}</b></span>
        <span>${this.escapeHtml(w.pos || "")}</span>
      </div>

      <div class="flashcard-scene" onclick="App.flipFlashcard()">
        <div class="flashcard-3d ${this.fcFlipped ? "is-flipped" : ""}" id="fc-card-3d">
          <div class="flashcard-face">
            <span class="card-face-label">${frontIsEn ? "🇬🇧 İNGİLİZCE" : "🇹🇷 TÜRKÇE"}</span>
            <div class="card-face-actions" onclick="event.stopPropagation()">
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

      <div style="display:flex; gap:14px; align-items:center; justify-content:center; width:100%;">
        <button class="btn btn-secondary" onclick="App.prevFlashcard()">⬅️ Önceki</button>
        <button class="btn btn-danger" onclick="App.markFlashcard(false)">🤔 Tekrar Çalışacağım</button>
        <button class="btn btn-success" onclick="App.markFlashcard(true)">✅ Biliyorum</button>
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
    this.fcIndex = (this.fcIndex + 1) % this.fcList.length;
    this.fcFlipped = false;
    this.renderFlashcard();
  },

  prevFlashcard() {
    if (!this.fcList.length) return;
    this.fcIndex = (this.fcIndex - 1 + this.fcList.length) % this.fcList.length;
    this.fcFlipped = false;
    this.renderFlashcard();
  },

  markFlashcard(known) {
    const w = this.fcList[this.fcIndex];
    if (w) {
      if (known) {
        w.correctCount = (w.correctCount || 0) + 1;
        w.status = "familiar";
      } else {
        w.wrongCount = (w.wrongCount || 0) + 1;
        w.status = "learning";
        w.nextReview = Date.now();
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
    if (!sentence) return "_______";
    const base = term.trim().split(/\s+/)[0];
    const regex = new RegExp(base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\w*", "gi");
    if (regex.test(sentence)) {
      return sentence.replace(regex, "_______");
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
      container.innerHTML = `
        <div class="study-box" style="text-align:center;">
          <div style="font-size:48px; margin-bottom:10px;">✍️</div>
          <h2>Seçili Defter İçin Yazma Çalışması Tamamlandı!</h2>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="App.initWriteMode()">🔄 Tekrar Çalış</button>
        </div>
      `;
      return;
    }

    const w = this.writeList[this.writeIndex];
    const safeTerm = this.escapeAttr(w.term);

    container.innerHTML = `
      <div class="study-box" style="text-align:center;">
        <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-muted); margin-bottom:14px;">
          <span>Kelime ${this.writeIndex + 1} / ${this.writeList.length}</span>
          <span>Harf Sayısı: ${w.term.length}</span>
        </div>

        ${this.writeDictationOnly ? `
          <div style="padding:20px;">
            <button class="btn btn-primary" onclick="App.speak('${safeTerm}')">🔊 Kelimeyi Tekrar Dinle</button>
            <p style="font-size:13px; color:var(--text-secondary); margin-top:10px;">Duyduğun İngilizce kelimeyi aşağıya yaz:</p>
          </div>
        ` : `
          <div style="font-size:26px; font-weight:800; color:var(--success); margin-bottom:8px;">
            🇹🇷 ${this.escapeHtml(w.meaning)}
          </div>
          <div style="margin-bottom:8px;">
            <span class="pos-badge">${this.escapeHtml(w.pos || "")}</span>
            <button class="btn-icon" style="margin-left:8px;" onclick="App.speak('${safeTerm}')" title="Telaffuz İpucu Dinle">🔊</button>
          </div>
        `}

        <div id="write-hint-display" style="font-family:monospace; font-size:16px; color:var(--warning); min-height:24px;"></div>

        <input
          type="text"
          id="write-user-input"
          class="write-input"
          placeholder="İngilizce karşılığını yazıp Enter'a basın..."
          autocomplete="off"
          onkeydown="if(event.key==='Enter') App.checkWriteAnswer()"
        />

        <div style="display:flex; justify-content:center; gap:10px; margin-top:16px;">
          <button class="btn btn-secondary" onclick="App.giveWriteHint()">💡 Harf İpucu Ver</button>
          <button class="btn btn-primary" onclick="App.checkWriteAnswer()">✅ Kontrol Et</button>
          <button class="btn btn-secondary" onclick="App.nextWriteCard()">Atla ➡️</button>
        </div>

        <div id="write-feedback" style="margin-top:18px;"></div>
      </div>
    `;

    if (this.writeDictationOnly) {
      this.speak(w.term);
    }
    setTimeout(() => document.getElementById("write-user-input")?.focus(), 50);
  },

  giveWriteHint() {
    const w = this.writeList[this.writeIndex];
    if (!w) return;
    this.writeHintLen = Math.min(w.term.length, this.writeHintLen + 1);
    const revealed = w.term.slice(0, this.writeHintLen) + "_".repeat(Math.max(0, w.term.length - this.writeHintLen));
    const el = document.getElementById("write-hint-display");
    if (el) el.textContent = `İpucu: ${revealed}`;
    const input = document.getElementById("write-user-input");
    if (input && !input.value) input.value = w.term.slice(0, this.writeHintLen);
    input?.focus();
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

    const isCorrect = userVal.toLowerCase() === w.term.trim().toLowerCase();
    this.writeAnswered = true;
    this.speak(w.term);
    this.recordStudyAction();

    if (isCorrect) {
      w.correctCount = (w.correctCount || 0) + 1;
      w.status = "familiar";
    } else {
      w.wrongCount = (w.wrongCount || 0) + 1;
    }

    const fb = document.getElementById("write-feedback");
    if (fb) {
      fb.innerHTML = `
        <div style="padding:14px; border-radius:var(--radius-md); background:${isCorrect ? "var(--success-soft)" : "var(--danger-soft)"};">
          <div style="font-size:16px; font-weight:700; color:${isCorrect ? "var(--success)" : "var(--danger)"};">
            ${isCorrect ? "🎉 Mükemmel! Doğru yazdın!" : `❌ Doğru yazılışı: "${this.escapeHtml(w.term)}"`}
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
  initQuizMode() {
    this.quizList = this.shuffleArray([...this.getActiveWords()]);
    this.quizIndex = 0;
    this.quizScore = 0;
    this.quizWrongWords = [];
    this.quizAnswered = false;
    this.renderQuizQuestion();
  },

  toggleQuizDirection() {
    this.quizDir = this.quizDir === "en-tr" ? "tr-en" : "en-tr";
    const btn = document.getElementById("quiz-dir-btn");
    if (btn) btn.textContent = this.quizDir === "en-tr" ? "Yön: 🇬🇧 İng ➔ 🇹🇷 Tr" : "Yön: 🇹🇷 Tr ➔ 🇬🇧 İng";
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
              <h4 style="color:var(--danger); margin-bottom:8px;">📌 Tekrar Etmen Gereken Kelimeler:</h4>
              ${this.quizWrongWords.map(w => `
                <div style="padding:6px 0; border-bottom:1px solid var(--border-color); font-size:14px;">
                  <b>${this.escapeHtml(w.term)}</b> — ${this.escapeHtml(w.meaning)}
                </div>
              `).join("")}
            </div>
          ` : `<p style="color:var(--success); margin:12px 0;">Seçili defterdeki tüm soruları hatasız bildin!</p>`}
          <button class="btn btn-primary" onclick="App.initQuizMode()">🔄 Yeni Test Başlat</button>
        </div>
      `;
      return;
    }

    const current = this.quizList[this.quizIndex];
    const distractors = this.getDistractorsForWord(current, 3);
    const options = this.shuffleArray([current, ...distractors]);
    const isEnToTr = this.quizDir === "en-tr";

    container.innerHTML = `
      <div class="study-box">
        <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-muted); margin-bottom:12px;">
          <span>Soru ${this.quizIndex + 1} / ${this.quizList.length}</span>
          <span>Puan: ${this.quizScore}</span>
        </div>

        <div style="text-align:center; padding:18px 0;">
          <div style="font-size:32px; font-weight:800;">
            ${this.escapeHtml(isEnToTr ? current.term : current.meaning)}
          </div>
          ${isEnToTr && current.phonetic ? `<div class="word-phonetic" style="margin-top:4px;">${this.escapeHtml(current.phonetic)}</div>` : ""}
        </div>

        <div class="options-grid" id="quiz-options">
          ${options.map((opt, i) => `
            <button class="option-btn" data-word-id="${opt.id}" onclick="App.answerQuiz('${opt.id}', this)">
              <span style="color:var(--accent); font-weight:800;">${String.fromCharCode(65 + i)})</span>
              <span>${this.escapeHtml(isEnToTr ? opt.meaning : opt.term)}</span>
            </button>
          `).join("")}
        </div>
      </div>
    `;

    if (isEnToTr) this.speak(current.term);
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
  initMatchGame() {
    if (this.matchTimerId) clearInterval(this.matchTimerId);
    const active = this.getActiveWords();
    const container = document.getElementById("match-container");
    if (active.length === 0) {
      if (container) container.innerHTML = this.getEmptyDeckStudyHtml();
      return;
    }

    const pool = this.shuffleArray([...active]).slice(0, 6);
    const tiles = [];
    pool.forEach(w => {
      tiles.push({ uid: `en-${w.id}`, wordId: w.id, text: w.term, type: "en" });
      tiles.push({ uid: `tr-${w.id}`, wordId: w.id, text: w.meaning, type: "tr" });
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
        <h3 style="margin-bottom:14px;">📂 Tüm Günlük & Özel Defterlerin İlerleme Durumu</h3>
        <div style="display:grid; gap:10px;">
          ${this.state.decks.map(d => {
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

  openBackupModal() {
    document.getElementById("backup-modal")?.classList.add("open");
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
    const headers = ["Deck", "Term", "Meaning", "Phonetic", "POS", "Example", "ExampleTR", "Mnemonic", "Status"];
    const deckMap = {};
    this.state.decks.forEach(d => (deckMap[d.id] = d.name));
    const rows = this.state.words.map(w =>
      [deckMap[w.deckId] || "Genel", w.term, w.meaning, w.phonetic, w.pos, w.example, w.exampleTr, w.mnemonic, w.status]
        .map(v => `"${String(v || "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `LexiMind_Kelimeler_${this.getTodayStr()}.csv`;
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
        }
      } else if (activeId === "view-cloze" && ["1", "2", "3", "4"].includes(e.key)) {
        const btns = document.querySelectorAll("#cloze-options .option-btn");
        const idx = parseInt(e.key, 10) - 1;
        if (btns[idx] && !btns[idx].disabled) btns[idx].click();
      } else if (activeId === "view-quiz" && ["1", "2", "3", "4"].includes(e.key)) {
        const btns = document.querySelectorAll("#quiz-options .option-btn");
        const idx = parseInt(e.key, 10) - 1;
        if (btns[idx] && !btns[idx].disabled) btns[idx].click();
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
