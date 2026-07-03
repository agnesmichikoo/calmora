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
     CHATBOT COMPANION ENGINE
     Simulasi berbasis pola kata kunci + variasi respons + memori
     percakapan ringan, supaya terasa lebih natural (bukan AI
     sungguhan — lihat catatan di README soal menyambungkan API asli).
     --------------------------------------------------------- */

  // Sapaan pembuka / basa-basi ringan
  const GREETING_PATTERNS = ['halo', 'hai', 'hi', 'hey', 'pagi', 'siang', 'sore', 'malam', 'permisi'];
  const GREETING_RESPONSES = [
    'Hai juga 🌿 Senang kamu mampir. Lagi ada yang kamu rasakan hari ini, atau cuma pengen ngobrol santai dulu?',
    'Halo! Aku di sini kok. Gimana harimu sejauh ini?',
    'Hai, makasih udah mampir. Boleh cerita apa aja yang lagi ada di kepala atau hatimu sekarang.',
  ];

  // Ucapan terima kasih / mau mengakhiri obrolan
  const CLOSING_PATTERNS = ['makasih', 'terima kasih', 'thanks', 'thank you', 'oke deh', 'udah dulu ya', 'segitu aja'];
  const CLOSING_RESPONSES = [
    'Sama-sama. Aku senang bisa nemenin kamu ngobrol. Pintu ini selalu terbuka kalau kamu mau cerita lagi.',
    'Dengan senang hati. Jaga diri kamu ya, dan kembali lagi kapan pun kamu butuh teman cerita.',
    'Terima kasih juga sudah mau terbuka. Sampai ketemu lagi di sini kalau kamu butuh 🌿',
  ];

  // Kategori emosi: tiap kategori punya beberapa variasi validasi + saran,
  // dan beberapa pertanyaan lanjutan yang open-ended.
  const EMOTION_CATEGORIES = [
    {
      name: 'cemas',
      keywords: ['cemas', 'khawatir', 'anxious', 'panik', 'gelisah', 'was-was', 'waswas', 'deg-degan'],
      responses: [
        'Rasa cemas itu berat ya, dan wajar banget buat dirasain. Kalau kamu mau, coba tarik napas perlahan 4 detik, tahan 4 detik, lalu buang perlahan 4 detik — kita bisa coba bareng.',
        'Aku dengar kamu lagi cemas. Kadang pikiran jadi lompat-lompat kalau lagi kayak gini, dan itu nggak apa-apa.',
        'Cemas biasanya muncul kalau ada sesuatu yang terasa nggak pasti. Boleh cerita, ada hal spesifik yang bikin kamu merasa begini?',
      ],
      followups: [
        'Kira-kira sejak kapan perasaan ini mulai muncul?',
        'Ada hal spesifik yang bikin kamu ngerasa begini, atau lebih ke perasaan umum aja?',
        'Kalau boleh tau, biasanya apa yang bikin kamu ngerasa sedikit lebih tenang?',
      ],
    },
    {
      name: 'sedih',
      keywords: ['sedih', 'kecewa', 'nangis', 'menangis', 'hampa', 'kosong', 'patah hati', 'galau'],
      responses: [
        'Aku dengar kamu sedang sedih. Nggak apa-apa untuk merasakannya sepenuhnya, nggak perlu buru-buru baik-baik aja.',
        'Kedengarannya ini berat buat kamu. Aku di sini, ceritakan aja sepelan atau sebanyak yang kamu mau.',
        'Sedih itu bagian yang wajar dari hidup, walau nggak pernah terasa ringan pas ngalamin. Terima kasih udah mau cerita ke aku.',
      ],
      followups: [
        'Ada kejadian tertentu yang bikin kamu ngerasa sesedih ini?',
        'Apa udah ada orang lain yang tahu perasaanmu ini?',
        'Kira-kira apa yang paling kamu butuhkan sekarang — didengerin, dialihin, atau saran?',
      ],
    },
    {
      name: 'capek',
      keywords: ['capek', 'lelah', 'cape', 'penat', 'burnout', 'kecapean', 'ngantuk banget'],
      responses: [
        'Kedengarannya kamu udah kerja keras banget belakangan ini. Kamu boleh kok istirahat, bahkan cuma 10 menit tanpa layar bisa bantu banget.',
        'Capek fisik dan capek pikiran itu beda tapi sama-sama valid buat diakui. Sudah berapa lama kamu ngerasa kayak gini?',
        'Aku dengar kamu lelah. Kadang tubuh dan pikiran kita butuh dikasih jeda dulu sebelum lanjut lagi.',
      ],
      followups: [
        'Kira-kira apa yang paling menguras energi kamu belakangan ini?',
        'Kapan terakhir kali kamu benar-benar istirahat tanpa mikirin hal lain?',
        'Ada waktu buat kamu istirahat sebentar hari ini?',
      ],
    },
    {
      name: 'takut',
      keywords: ['takut', 'ngeri', 'serem', 'phobia', 'trauma'],
      responses: [
        'Rasa takut itu berat, dan aku menghargai kamu mau cerita soal ini. Coba teknik grounding: sebutkan 5 benda yang kamu lihat, 4 yang bisa kamu sentuh, 3 yang bisa kamu dengar sekarang.',
        'Aku dengar kamu lagi takut. Kamu nggak sendirian ngerasain ini, dan boleh banget pelan-pelan aja ceritanya.',
        'Ketakutan sering muncul buat ngelindungin kita dari sesuatu. Boleh cerita, ini soal hal yang udah terjadi atau yang mungkin terjadi?',
      ],
      followups: [
        'Apa yang bikin kamu ngerasa paling takut dari situasi ini?',
        'Ada seseorang yang bisa kamu ajak bicara soal ini juga?',
        'Kira-kira hal kecil apa yang bisa bikin kamu ngerasa sedikit lebih aman sekarang?',
      ],
    },
    {
      name: 'marah',
      keywords: ['marah', 'kesal', 'jengkel', 'emosi', 'bete', 'sebel'],
      responses: [
        'Kedengarannya kamu lagi kesal banget. Wajar kok marah, itu tanda ada sesuatu yang penting buat kamu yang terasa dilanggar.',
        'Aku dengar kamu marah. Boleh cerita apa yang bikin kamu ngerasa begini?',
        'Rasa marah itu sering nyimpen pesan penting di baliknya. Pelan-pelan aja ceritain kalau kamu mau.',
      ],
      followups: [
        'Apa yang jadi pemicu utama perasaan ini?',
        'Udah sempat kamu sampaikan perasaan ini ke orang yang terlibat?',
        'Biasanya apa yang bantu kamu buat lebih tenang saat marah?',
      ],
    },
    {
      name: 'kesepian',
      keywords: ['kesepian', 'sendirian', 'sendiri banget', 'nggak ada teman', 'ga ada temen'],
      responses: [
        'Rasa kesepian itu berat, dan aku senang kamu memilih cerita ke sini. Kamu nggak benar-benar sendirian sekarang.',
        'Aku dengar kamu ngerasa sendirian. Perasaan itu valid, meskipun kadang susah dijelasin ke orang lain.',
      ],
      followups: [
        'Ada orang yang biasanya bikin kamu ngerasa terhubung, meski cuma sedikit?',
        'Sejak kapan perasaan ini mulai terasa lebih berat?',
      ],
    },
    {
      name: 'senang',
      keywords: ['senang', 'bahagia', 'happy', 'seru', 'bersyukur', 'excited', 'lega'],
      responses: [
        'Wah, senang dengarnya! Aku ikut senang buat kamu. Mau cerita apa yang bikin harimu jadi begini?',
        'Itu kabar baik. Momen-momen kayak gini layak banget dirayain, sekecil apa pun.',
        'Aku suka dengar ini. Semoga perasaan baik ini bisa bertahan lebih lama ya.',
      ],
      followups: [
        'Apa hal yang paling bikin kamu ngerasa begini hari ini?',
        'Ada rencana buat rayain momen ini?',
      ],
    },
  ];

  // Fallback reflektif kalau tidak ada kata kunci yang cocok —
  // dipecah jadi dua bagian lalu dikombinasikan biar variasinya banyak.
  const REFLECTIVE_OPENERS = [
    'Aku dengar apa yang kamu ceritain.',
    'Makasih udah mau terbuka soal ini.',
    'Kedengarannya ini cukup berarti buat kamu.',
    'Aku menghargai kamu mau berbagi cerita ini.',
    'Terima kasih sudah percaya cerita ini ke aku.',
  ];
  const REFLECTIVE_QUESTIONS = [
    'Mau cerita lebih lanjut soal itu?',
    'Kira-kira gimana perasaanmu soal itu sekarang?',
    'Ada bagian dari itu yang paling berat buat kamu?',
    'Apa yang biasanya bantu kamu ngerasa lebih baik dalam situasi kayak gini?',
    'Boleh diceritain lebih detail, aku dengerin kok.',
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

  // Memori ringan percakapan: topik terakhir & respons terakhir,
  // supaya bot tidak mengulang kalimat yang sama persis dua kali berturut-turut.
  const chatMemory = {
    lastTopic: null,
    lastResponse: null,
    turnCount: 0,
  };

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

  function pickVariant(arr, avoid) {
    if (arr.length === 1) return arr[0];
    let choice = arr[Math.floor(Math.random() * arr.length)];
    let attempts = 0;
    while (choice === avoid && attempts < 5) {
      choice = arr[Math.floor(Math.random() * arr.length)];
      attempts++;
    }
    return choice;
  }

  function matchEmotionCategory(text) {
    for (const cat of EMOTION_CATEGORIES) {
      if (cat.keywords.some((kw) => text.includes(kw))) return cat;
    }
    return null;
  }

  function getBotResponse(userTextRaw) {
    const text = userTextRaw.toLowerCase().trim();
    chatMemory.turnCount++;

    // 1. Sapaan
    if (GREETING_PATTERNS.some((kw) => text === kw || text.startsWith(kw + ' ') || text.startsWith(kw + ','))) {
      const reply = pickVariant(GREETING_RESPONSES, chatMemory.lastResponse);
      chatMemory.lastResponse = reply;
      chatMemory.lastTopic = 'greeting';
      return reply;
    }

    // 2. Penutup / ucapan terima kasih
    if (CLOSING_PATTERNS.some((kw) => text.includes(kw))) {
      const reply = pickVariant(CLOSING_RESPONSES, chatMemory.lastResponse);
      chatMemory.lastResponse = reply;
      chatMemory.lastTopic = 'closing';
      return reply;
    }

    // 3. Kategori emosi yang cocok
    const category = matchEmotionCategory(text);
    if (category) {
      // Kalau topik sama dengan pesan sebelumnya, condong ke pertanyaan lanjutan
      // supaya obrolan terasa berkembang, bukan mengulang validasi yang sama.
      const sameTopicAsBefore = chatMemory.lastTopic === category.name;
      let reply;
      if (sameTopicAsBefore && Math.random() < 0.6) {
        reply = pickVariant(category.followups, chatMemory.lastResponse);
      } else {
        const base = pickVariant(category.responses, chatMemory.lastResponse);
        const addFollowup = category.followups && Math.random() < 0.5;
        reply = addFollowup ? `${base} ${pickVariant(category.followups)}` : base;
      }
      chatMemory.lastResponse = reply;
      chatMemory.lastTopic = category.name;
      return reply;
    }

    // 4. Fallback reflektif (tidak ada kata kunci yang cocok)
    const opener = pickVariant(REFLECTIVE_OPENERS, chatMemory.lastResponse);
    const question = pickVariant(REFLECTIVE_QUESTIONS);
    const reply = `${opener} ${question}`;
    chatMemory.lastResponse = reply;
    chatMemory.lastTopic = 'general';
    return reply;
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
