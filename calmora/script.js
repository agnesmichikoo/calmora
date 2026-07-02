/* =========================================================
   CALMORA — script.js
   Prototype logic: navigation, mood check-in, anxiety screening,
   scoring, chatbot simulation, localStorage persistence.
   Bukan alat diagnosis. Semua data disimpan lokal di browser.
   ========================================================= */

(function () {
  'use strict';

  /* ---------------------------------------------------------
     STATE
     --------------------------------------------------------- */
  const state = {
    selectedMood: null,
    selectedEmoji: null,
    currentQuestion: 0,
    answers: new Array(7).fill(null),
  };

  const STORAGE_KEY = 'calmora_lastCheckin';

  /* ---------------------------------------------------------
     ANXIETY SCREENING DATA (konsep GAD-7, disederhanakan)
     --------------------------------------------------------- */
  const QUESTIONS = [
    'Merasa gugup, cemas, atau tegang',
    'Tidak mampu menghentikan atau mengendalikan rasa khawatir',
    'Terlalu banyak khawatir tentang berbagai hal',
    'Sulit untuk rileks',
    'Begitu gelisah sehingga sulit untuk duduk diam',
    'Mudah merasa kesal atau tersinggung',
    'Merasa takut seolah sesuatu yang buruk akan terjadi',
  ];

  const OPTIONS = [
    { label: 'Tidak sama sekali', value: 0 },
    { label: 'Beberapa hari', value: 1 },
    { label: 'Lebih dari separuh hari', value: 2 },
    { label: 'Hampir setiap hari', value: 3 },
  ];

  const CATEGORIES = [
    {
      max: 4,
      name: 'Minimal anxiety',
      explanation:
        'Hasil ini menunjukkan gejala kecemasan pada tingkat yang minimal. Sepertinya kondisimu cukup stabil belakangan ini.',
      recommendations: [
        'Pertahankan rutinitas tidur dan istirahat yang cukup',
        'Luangkan waktu untuk aktivitas yang kamu nikmati',
        'Sesekali cek-in dengan dirimu sendiri seperti hari ini',
      ],
    },
    {
      max: 9,
      name: 'Mild anxiety',
      explanation:
        'Hasil ini menunjukkan gejala kecemasan pada tingkat ringan. Wajar untuk sesekali merasa begini, terutama saat banyak hal terjadi.',
      recommendations: [
        'Coba latihan pernapasan 4-4-4 selama beberapa menit',
        'Tuliskan apa yang kamu khawatirkan di jurnal',
        'Kurangi paparan berita atau media yang memicu stres',
      ],
    },
    {
      max: 14,
      name: 'Moderate anxiety',
      explanation:
        'Hasil ini menunjukkan gejala kecemasan pada tingkat sedang. Perasaan ini mungkin mulai terasa cukup mengganggu aktivitasmu.',
      recommendations: [
        'Coba teknik grounding 5-4-3-2-1 saat kecemasan muncul',
        'Bicarakan perasaanmu dengan orang yang kamu percaya',
        'Beri jeda dari tugas atau tanggung jawab yang menumpuk',
        'Pertimbangkan konsultasi ringan dengan konselor kampus/kantor jika tersedia',
      ],
    },
    {
      max: 21,
      name: 'Severe anxiety',
      explanation:
        'Hasil ini menunjukkan gejala kecemasan pada tingkat yang cukup berat. Penting untuk tidak menghadapi ini sendirian.',
      recommendations: [
        'Hubungi orang terdekat yang kamu percaya untuk bercerita',
        'Coba teknik pernapasan lambat sambil duduk di tempat yang tenang',
        'Kurangi dulu beban atau keputusan besar dalam waktu dekat',
        'Pertimbangkan menjadwalkan sesi dengan tenaga profesional kesehatan mental',
      ],
    },
  ];

  function getCategory(score) {
    return CATEGORIES.find((c) => score <= c.max);
  }

  /* ---------------------------------------------------------
     CHATBOT KEYWORD RESPONSES
     --------------------------------------------------------- */
  const CHAT_RULES = [
    {
      keywords: ['cemas', 'khawatir', 'anxious', 'panik'],
      responses: [
        'Wajar kok merasa cemas, perasaanmu valid. Yuk coba tarik napas perlahan selama 4 detik, tahan 4 detik, lalu buang napas 4 detik. Ulangi beberapa kali, aku temani di sini.',
      ],
    },
    {
      keywords: ['sedih', 'kecewa', 'nangis', 'menangis'],
      responses: [
        'Aku dengar kamu sedang sedih. Tidak apa-apa untuk merasakan itu sepenuhnya. Aku di sini menemanimu, ceritakan saja kalau kamu mau.',
      ],
    },
    {
      keywords: ['capek', 'lelah', 'cape', 'penat', 'burnout'],
      responses: [
        'Kedengarannya kamu sudah bekerja keras belakangan ini. Coba beri dirimu izin untuk istirahat sejenak, bahkan 10 menit tanpa layar bisa membantu.',
      ],
    },
    {
      keywords: ['takut', 'ngeri', 'was-was', 'waswas'],
      responses: [
        'Rasa takut itu berat ya. Coba teknik grounding: sebutkan 5 benda yang kamu lihat, 4 yang bisa kamu sentuh, 3 yang bisa kamu dengar. Ini bisa membantumu kembali merasa hadir di sini.',
      ],
    },
  ];

  const DEFAULT_RESPONSES = [
    'Terima kasih sudah cerita. Aku di sini mendengarkan, tanpa menghakimi.',
    'Aku menghargai kamu mau membagikan ini. Ceritakan lebih lanjut kalau kamu mau.',
    'Perasaanmu valid, apa pun itu. Aku menemanimu di sini.',
  ];

  /* ---------------------------------------------------------
     DOM HELPERS
     --------------------------------------------------------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function showPage(id) {
    $$('.page').forEach((p) => p.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    $$('.nav-link').forEach((link) => {
      link.classList.toggle('active', link.dataset.target === id);
    });
  }

  function showNavbar() {
    $('#navbar').classList.remove('hidden');
  }

  /* ---------------------------------------------------------
     1. LANDING -> DISCLAIMER
     --------------------------------------------------------- */
  $('#start-btn').addEventListener('click', () => {
    showPage('disclaimer-page');
  });

  /* ---------------------------------------------------------
     2. DISCLAIMER
     --------------------------------------------------------- */
  const agreeCheckbox = $('#agree-checkbox');
  const continueBtn = $('#continue-btn');

  agreeCheckbox.addEventListener('change', () => {
    continueBtn.disabled = !agreeCheckbox.checked;
  });

  continueBtn.addEventListener('click', () => {
    showNavbar();
    renderDashboard();
    showPage('dashboard-page');
  });

  /* ---------------------------------------------------------
     3. NAVBAR LINKS
     --------------------------------------------------------- */
  $$('.nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      const target = link.dataset.target;
      if (target === 'mood-page') resetMoodAndScreening();
      if (target === 'dashboard-page') renderDashboard();
      showPage(target);
    });
  });

  /* ---------------------------------------------------------
     DASHBOARD
     --------------------------------------------------------- */
  function renderDashboard() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const emptyEl = $('#checkin-empty');
    const filledEl = $('#checkin-filled');

    if (!saved) {
      emptyEl.classList.remove('hidden');
      filledEl.classList.add('hidden');
      return;
    }

    try {
      const data = JSON.parse(saved);
      emptyEl.classList.add('hidden');
      filledEl.classList.remove('hidden');

      $('#ci-mood-emoji').textContent = data.emoji || '🙂';
      $('#ci-mood-label').textContent = data.mood || '—';
      $('#ci-date').textContent = formatDate(data.date);
      $('#ci-score-badge').textContent = data.score;
      $('#ci-category').textContent = data.category;
    } catch (e) {
      emptyEl.classList.remove('hidden');
      filledEl.classList.add('hidden');
    }
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  $('#dash-checkin-btn').addEventListener('click', () => {
    resetMoodAndScreening();
    showPage('mood-page');
  });
  $('#dash-chat-btn').addEventListener('click', () => showPage('chat-page'));

  /* ---------------------------------------------------------
     4. MOOD CHECK-IN
     --------------------------------------------------------- */
  function resetMoodAndScreening() {
    state.selectedMood = null;
    state.selectedEmoji = null;
    state.currentQuestion = 0;
    state.answers = new Array(7).fill(null);
    $$('.mood-option').forEach((btn) => btn.classList.remove('selected'));
    $('#mood-next-btn').disabled = true;
  }

  $$('.mood-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.mood-option').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedMood = btn.dataset.mood;
      state.selectedEmoji = btn.dataset.emoji;
      $('#mood-next-btn').disabled = false;
    });
  });

  $('#mood-next-btn').addEventListener('click', () => {
    state.currentQuestion = 0;
    renderQuestion();
    showPage('screening-page');
  });

  /* ---------------------------------------------------------
     5. ANXIETY SCREENING
     --------------------------------------------------------- */
  function renderQuestion() {
    const idx = state.currentQuestion;
    $('#question-text').textContent = QUESTIONS[idx];
    $('#progress-label').textContent = `Pertanyaan ${idx + 1} dari 7`;
    $('#progress-fill').style.width = `${((idx + 1) / 7) * 100}%`;

    const list = $('#option-list');
    list.innerHTML = '';

    OPTIONS.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option-item';
      btn.textContent = opt.label;
      if (state.answers[idx] === opt.value) btn.classList.add('selected');

      btn.addEventListener('click', () => {
        state.answers[idx] = opt.value;
        list.querySelectorAll('.option-item').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');

        // Auto-advance after a short pause for a smoother feel
        setTimeout(() => {
          if (state.currentQuestion < 6) {
            state.currentQuestion++;
            renderQuestion();
          } else {
            finishScreening();
          }
        }, 220);
      });

      list.appendChild(btn);
    });

    $('#question-back-btn').style.visibility = idx === 0 ? 'hidden' : 'visible';
  }

  $('#question-back-btn').addEventListener('click', () => {
    if (state.currentQuestion > 0) {
      state.currentQuestion--;
      renderQuestion();
    } else {
      showPage('mood-page');
    }
  });

  function finishScreening() {
    const score = state.answers.reduce((sum, v) => sum + (v || 0), 0);
    const category = getCategory(score);
    renderResult(score, category);
    saveCheckin(score, category);
    showPage('result-page');
  }

  /* ---------------------------------------------------------
     6. RESULT PAGE
     --------------------------------------------------------- */
  function renderResult(score, category) {
    $('#result-score-number').textContent = score;
    $('#result-category').textContent = category.name;
    $('#result-explanation').textContent = category.explanation;

    const list = $('#result-recommend-list');
    list.innerHTML = '';
    category.recommendations.forEach((rec) => {
      const li = document.createElement('li');
      li.textContent = rec;
      list.appendChild(li);
    });

    $('#result-crisis').classList.toggle('hidden', category.name !== 'Severe anxiety');
  }

  function saveCheckin(score, category) {
    const data = {
      mood: state.selectedMood,
      emoji: state.selectedEmoji,
      score,
      category: category.name,
      date: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  $('#result-dashboard-btn').addEventListener('click', () => {
    renderDashboard();
    showPage('dashboard-page');
  });
  $('#result-chat-btn').addEventListener('click', () => showPage('chat-page'));

  /* ---------------------------------------------------------
     7. CHATBOT COMPANION (keyword-based simulation)
     --------------------------------------------------------- */
  const chatWindow = $('#chat-window');
  const chatForm = $('#chat-form');
  const chatInput = $('#chat-input');
  let greeted = false;

  function addBubble(text, sender) {
    const bubble = document.createElement('div');
    bubble.className = `bubble ${sender === 'bot' ? 'bubble-bot' : 'bubble-user'}`;
    bubble.textContent = text;
    chatWindow.appendChild(bubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function greetIfNeeded() {
    if (greeted) return;
    greeted = true;
    addBubble(
      'Hai, aku Companion Calmora 🌿 Ceritakan apa pun yang kamu rasakan hari ini, aku di sini untuk mendengarkan.',
      'bot'
    );
  }

  function getBotResponse(userText) {
    const text = userText.toLowerCase();
    for (const rule of CHAT_RULES) {
      if (rule.keywords.some((kw) => text.includes(kw))) {
        return rule.responses[Math.floor(Math.random() * rule.responses.length)];
      }
    }
    return DEFAULT_RESPONSES[Math.floor(Math.random() * DEFAULT_RESPONSES.length)];
  }

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = chatInput.value.trim();
    if (!value) return;

    addBubble(value, 'user');
    chatInput.value = '';

    setTimeout(() => {
      addBubble(getBotResponse(value), 'bot');
    }, 450);
  });

  // Greet the first time the chat page becomes visible
  const chatNavLink = document.querySelector('.nav-link[data-target="chat-page"]');
  if (chatNavLink) chatNavLink.addEventListener('click', greetIfNeeded);
  $('#dash-chat-btn').addEventListener('click', greetIfNeeded);
  $('#result-chat-btn').addEventListener('click', greetIfNeeded);

  /* ---------------------------------------------------------
     INIT
     --------------------------------------------------------- */
  renderDashboard();
})();
