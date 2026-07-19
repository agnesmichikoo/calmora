/* =========================================================
   CALMORA — script.js
   Prototype logic: navigation, mood check-in, general mental health
   screening (GHQ-12), scoring, chatbot simulation, localStorage
   persistence. Bukan alat diagnosis. Semua data disimpan lokal di browser.
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
    answers: new Array(12).fill(null),
  };

  const STORAGE_KEY = 'calmora_lastCheckin';

  /* ---------------------------------------------------------
     GENERAL MENTAL HEALTH SCREENING DATA (GHQ-12)
     General Health Questionnaire — 12 item, dikembangkan Goldberg (1978).
     6 item berupa pernyataan positif dan skornya dibalik (reverse-scored)
     saat dihitung total, karena makin sering dirasakan justru makin baik.
     --------------------------------------------------------- */
  const QUESTIONS = [
    { text: 'Dapat berkonsentrasi pada apapun yang Anda kerjakan?', reverse: true },
    { text: 'Sulit tidur karena khawatir?', reverse: false },
    { text: 'Merasa bahwa Anda berperan dalam berbagai hal secara bermanfaat?', reverse: true },
    { text: 'Merasa mampu untuk membuat suatu keputusan?', reverse: true },
    { text: 'Merasa terus-menerus di bawah tekanan?', reverse: false },
    { text: 'Merasa tidak sanggup untuk mengatasi kesulitan-kesulitan Anda?', reverse: false },
    { text: 'Dapat menikmati aktivitas sehari-hari?', reverse: true },
    { text: 'Mampu menanggung masalah-masalah Anda?', reverse: true },
    { text: 'Merasa tidak bahagia dan tertekan?', reverse: false },
    { text: 'Kehilangan kepercayaan diri?', reverse: false },
    { text: 'Berpikir bahwa diri Anda tidak berguna?', reverse: false },
    { text: 'Setelah mempertimbangkan segala hal, merasa cukup bahagia?', reverse: true },
  ];

  const OPTIONS = [
    { label: 'Tidak sama sekali', value: 0 },
    { label: 'Kadang-kadang', value: 1 },
    { label: 'Sering', value: 2 },
    { label: 'Hampir setiap hari', value: 3 },
  ];

  const CATEGORIES = [
    {
      max: 18,
      name: 'Baik',
      explanation: 'Kondisi psikologis Anda dalam batas yang baik.',
      recommendations: [
        'Pertahankan rutinitas tidur dan istirahat yang cukup',
        'Luangkan waktu untuk aktivitas yang kamu nikmati',
        'Sesekali cek-in dengan dirimu sendiri seperti hari ini',
      ],
    },
    {
      max: 36,
      name: 'Perlu Perhatian Lebih',
      explanation:
        'Kondisi psikologis Anda perlu mendapat perhatian lebih. Pertimbangkan untuk berkonsultasi dengan profesional kesehatan mental.',
      recommendations: [
        'Coba teknik pernapasan kotak (4-4-4-4): tarik napas selama 4 detik, tahan napas 4 detik, embuskan napas perlahan selama 4 detik, lalu tahan lagi 4 detik sebelum menarik napas berikutnya. Ulangi selama beberapa menit',
        'Coba teknik grounding 5-4-3-2-1: sebutkan dalam hati 5 benda yang kamu lihat, 4 benda yang bisa kamu sentuh, 3 suara yang kamu dengar, 2 aroma yang bisa kamu cium, dan 1 rasa yang bisa kamu kecap',
        'Bicarakan perasaanmu dengan orang yang kamu percaya',
        'Pertimbangkan untuk berkonsultasi dengan profesional kesehatan mental',
      ],
    },
  ];

  function getCategory(score) {
    return CATEGORIES.find((c) => score <= c.max);
  }

  /* ---------------------------------------------------------
     CHATBOT COMPANION ENGINE
     Simulasi berbasis pola kata kunci + variasi respons + memori
     percakapan ringan, dibuat dengan gaya ngobrol santai kayak
     ke temen deket (bukan AI sungguhan — lihat catatan soal
     menyambungkan API asli).
     --------------------------------------------------------- */

  // Sapaan pembuka / basa-basi ringan
  const GREETING_PATTERNS = ['halo', 'hai', 'hi', 'hey', 'pagi', 'siang', 'sore', 'malam', 'permisi'];
  const GREETING_RESPONSES = [
    'Haii 🌿 Gimana kabarnya hari ini?',
    'Halo juga! Lagi mau cerita apa nih, atau cuma pengen ngobrol santai dulu juga gapapa.',
    'Hai, seneng deh kamu mampir. Ada apa nih?',
  ];

  // Ucapan terima kasih / mau mengakhiri obrolan
  const CLOSING_PATTERNS = ['makasih', 'terima kasih', 'thanks', 'thank you', 'oke deh', 'udah dulu ya', 'segitu aja'];
  const CLOSING_RESPONSES = [
    'Sama-sama! Seneng bisa nemenin kamu ngobrol. Balik lagi aja kapan-kapan kalau mau cerita lagi ya.',
    'Santai aja, aku di sini kok kalau kamu butuh. Jaga diri ya 🌿',
    'Iya, semangat terus ya. Aku ada di sini kalau kamu butuh temen cerita lagi.',
  ];

  // Balasan super singkat (iya, hmm, oke) yang butuh dorongan lanjutan
  const SHORT_REPLY_PATTERNS = ['iya', 'ya', 'hmm', 'hm', 'oke', 'ok', 'oh', 'gitu', 'lah', 'terus', 'trus', 'nggak tau', 'ga tau', 'gatau', 'biasa aja', 'gapapa', 'gak papa'];
  const SHORT_REPLY_RESPONSES = [
    'Terus gimana?',
    'Cerita dong, aku dengerin kok.',
    'Nah, lanjutin aja, aku masih di sini.',
    'Hmm oke, ada lagi yang mau kamu ceritain?',
    'Boleh diperjelas dikit lagi? Aku pengen ngerti lebih dalem.',
  ];

  // Pengen cerita / curhat tapi belum masuk topik spesifik
  const INVITATION_PATTERNS = ['mau cerita', 'pengen cerita', 'boleh cerita', 'mau curhat', 'pengen curhat', 'aku mau', 'ada yang mau aku ceritain', 'belum cerita'];
  const INVITATION_RESPONSES = [
    'Boleh banget. Cerita aja pelan-pelan, nggak perlu buru-buru, aku dengerin sampai selesai.',
    'Aku siap dengerin. Mau mulai dari mana aja gapapa kok.',
    'Silakan, aku di sini kok, nggak akan motong ceritamu.',
  ];

  // Kategori emosi: tiap kategori punya beberapa variasi validasi + saran,
  // dan beberapa pertanyaan lanjutan yang open-ended, gaya santai.
  const EMOTION_CATEGORIES = [
    {
      name: 'cemas',
      keywords: ['cemas', 'khawatir', 'anxious', 'panik', 'gelisah', 'was-was', 'waswas', 'deg-degan'],
      responses: [
        'Duh, cemas emang nggak enak banget ya. Coba deh teknik pernapasan kotak: tarik napas pelan 4 detik, tahan 4 detik, buang napas perlahan 4 detik, terus tahan lagi 4 detik sebelum tarik napas berikutnya. Yuk kita coba bareng, ulangi beberapa kali.',
        'Wajar kok ngerasa cemas gitu. Kadang pikiran emang suka lompat-lompat kalau lagi kayak gini.',
        'Cemas biasanya muncul kalau ada yang berasa nggak pasti nih. Ada hal spesifik yang bikin kamu gini?',
      ],
      followups: [
        'Ini mulai kerasa dari kapan sih?',
        'Ada penyebab spesifiknya, atau cuma perasaan umum aja?',
        'Biasanya apa sih yang bikin kamu agak tenangan?',
      ],
    },
    {
      name: 'sedih',
      keywords: ['sedih', 'kecewa', 'nangis', 'menangis', 'hampa', 'kosong', 'patah hati', 'galau'],
      responses: [
        'Duh, aku ikut sedih dengernya. Gapapa kok kalau mau sedih dulu, nggak usah maksa baik-baik aja.',
        'Kedengerannya ini berat banget ya buat kamu. Cerita aja pelan-pelan, aku dengerin.',
        'Sedih emang bagian dari hidup sih, walau tetep aja nggak enak ngerasainnya. Makasih udah mau cerita ke aku.',
      ],
      followups: [
        'Ada kejadian tertentu yang bikin kamu sesedih ini?',
        'Udah ada yang tau perasaan kamu ini selain aku?',
        'Kamu butuhnya didengerin aja, dialihin, apa mau dikasih saran nih?',
      ],
    },
    {
      name: 'capek',
      keywords: ['capek', 'lelah', 'cape', 'penat', 'burnout', 'kecapean', 'ngantuk banget'],
      responses: [
        'Kayaknya kamu udah kerja keras banget belakangan ya. Istirahat dulu gapapa kok, 10 menit tanpa layar aja udah lumayan banget.',
        'Capek fisik sama capek pikiran itu beda tapi sama-sama valid buat diakuin. Udah berapa lama nih ngerasa gini?',
        'Duh, capek ya. Kadang badan sama otak emang butuh jeda dulu sebelum lanjut lagi.',
      ],
      followups: [
        'Kira-kira apa yang paling nguras energi kamu belakangan ini?',
        'Kapan terakhir kali bener-bener istirahat tanpa mikirin apa-apa?',
        'Ada waktu buat istirahat bentar hari ini?',
      ],
    },
    {
      name: 'takut',
      keywords: ['takut', 'ngeri', 'serem', 'phobia', 'trauma'],
      responses: [
        'Takut itu emang berat ya, makasih udah mau cerita. Coba deh teknik grounding 5-4-3-2-1: sebutin dalam hati 5 benda yang kamu liat, 4 benda yang bisa disentuh, 3 suara yang kamu denger, 2 aroma yang bisa kamu cium, dan 1 rasa yang bisa kamu kecap. Ini bantu kamu balik fokus ke saat ini.',
        'Aku denger kamu lagi takut. Kamu nggak sendirian kok ngerasain ini, pelan-pelan aja ceritanya.',
        'Rasa takut biasanya muncul buat ngelindungin kita. Ini soal yang udah kejadian, atau yang mungkin bakal kejadian?',
      ],
      followups: [
        'Apa yang paling bikin kamu takut dari situasi ini?',
        'Ada orang yang bisa kamu ajak ngobrol soal ini juga?',
        'Kira-kira hal kecil apa yang bisa bikin kamu ngerasa agak aman sekarang?',
      ],
    },
    {
      name: 'marah',
      keywords: ['marah', 'kesal', 'jengkel', 'emosi', 'bete', 'sebel'],
      responses: [
        'Wah, kedengerannya kamu kesel banget ya. Wajar kok marah, biasanya itu tanda ada hal penting yang berasa dilanggar.',
        'Aku denger kamu lagi marah nih. Cerita dong, apa yang bikin gini?',
        'Marah tuh sering nyimpen pesan penting di baliknya. Pelan-pelan aja ceritain kalau mau.',
      ],
      followups: [
        'Apa sih pemicu utamanya?',
        'Udah sempet kamu omongin perasaan ini ke orangnya?',
        'Biasanya apa yang bikin kamu agak tenangan kalau lagi marah?',
      ],
    },
    {
      name: 'kesepian',
      keywords: ['kesepian', 'sendirian', 'sendiri banget', 'nggak ada teman', 'ga ada temen'],
      responses: [
        'Duh, kesepian emang berat ya. Seneng deh kamu mau cerita ke sini, at least sekarang kamu nggak sendirian.',
        'Aku denger kamu ngerasa sendirian. Itu valid banget kok, walau kadang susah dijelasin ke orang lain.',
      ],
      followups: [
        'Ada orang yang biasanya bikin kamu ngerasa terhubung dikit, siapa pun itu?',
        'Ini mulai kerasa berat sejak kapan?',
      ],
    },
    {
      name: 'senang',
      keywords: ['senang', 'bahagia', 'happy', 'seru', 'bersyukur', 'excited', 'lega'],
      responses: [
        'Wah asik banget! Aku ikut seneng dengernya. Cerita dong apa yang bikin harimu jadi bagus gini?',
        'Itu kabar bagus tuh. Momen kayak gini layak dirayain, sekecil apa pun itu.',
        'Suka deh denger ini. Semoga mood baiknya bisa awet ya.',
      ],
      followups: [
        'Apa nih yang paling bikin kamu ngerasa gini hari ini?',
        'Ada rencana buat rayain momen ini?',
      ],
    },
    {
      name: 'minder',
      keywords: ['minder', 'gak percaya diri', 'nggak percaya diri', 'tidak percaya diri', 'gak berharga', 'nggak berharga', 'tidak berharga', 'gak berguna', 'nggak berguna', 'tidak berguna', 'insecure', 'rendah diri', 'gak pede', 'nggak pede'],
      responses: [
        'Duh, makasih udah mau cerita soal ini. Ngerasa kurang percaya diri itu berat, tapi itu nggak berarti kamu beneran nggak berharga kok.',
        'Aku denger kamu lagi ngerasa gak yakin sama diri sendiri. Itu perasaan yang valid, meskipun sering nggak sesuai sama kenyataan.',
        'Kadang pikiran kita suka lebih keras nge-judge diri sendiri daripada orang lain. Cerita dong, ini mulai kerasa dari kapan?',
      ],
      followups: [
        'Ada kejadian tertentu yang bikin kamu ngerasa gini?',
        'Kalau temen kamu yang ngerasa kayak gini, kira-kira apa yang bakal kamu bilang ke dia?',
        'Ada hal kecil yang menurut kamu udah kamu lakuin dengan baik belakangan ini?',
      ],
    },
    {
      name: 'kewalahan',
      keywords: ['kewalahan', 'overwhelmed', 'gak sanggup', 'nggak sanggup', 'tidak sanggup', 'numpuk', 'banyak banget', 'gak kuat', 'nggak kuat', 'stres', 'stress'],
      responses: [
        'Kedengerannya banyak banget yang lagi kamu tanggung sekaligus ya. Wajar kok kalau ngerasa kewalahan.',
        'Aku denger kamu lagi ngerasa gak sanggup nih. Coba pelan-pelan, kita breakdown satu-satu aja yuk apa yang paling berat.',
        'Kalau semuanya numpuk barengan emang berasa berat banget. Nggak apa-apa buat berhenti sejenak dulu.',
      ],
      followups: [
        'Dari semua yang numpuk itu, mana yang paling mendesak?',
        'Ada yang bisa kamu tunda atau minta bantuan orang lain buat nanganin?',
        'Udah berapa lama ngerasa kewalahan kayak gini?',
      ],
    },
    {
      name: 'fokus',
      keywords: ['susah fokus', 'sulit fokus', 'gak bisa konsen', 'nggak bisa konsen', 'susah konsentrasi', 'sulit konsentrasi', 'gak konsen', 'buyar'],
      responses: [
        'Susah fokus emang ganggu banget ya buat ngerjain apapun. Biasanya itu tandanya kepala lagi penuh sama hal lain.',
        'Aku denger kamu lagi susah konsentrasi. Coba istirahat bentar dulu, kadang otak butuh jeda sebelum bisa fokus lagi.',
        'Pikiran yang buyar biasanya bukan soal males, tapi ada beban lain yang lagi numpuk di kepala. Ada yang lagi kepikiran?',
      ],
      followups: [
        'Kira-kira apa yang bikin pikiran kamu gampang teralihkan belakangan ini?',
        'Udah coba istirahat sejenak dari layar sebelum lanjut kerja/belajar?',
      ],
    },
  ];

  // Fallback reflektif kalau tidak ada kata kunci yang cocok —
  // dipecah jadi dua bagian lalu dikombinasikan biar variasinya banyak.
  // Sengaja dibuat netral supaya tetap masuk akal walau user ngetik apa pun.
  const REFLECTIVE_OPENERS = [
    'Oke, aku dengerin kok.',
    'Makasih udah cerita ke aku.',
    'Aku di sini nemenin kamu.',
    'Hmm, aku denger kamu.',
    'Boleh banget cerita ke aku.',
    'Aku ada di sini buat kamu.',
  ];
  const REFLECTIVE_QUESTIONS = [
    'Gimana perasaanmu hari ini?',
    'Ada yang lagi kamu rasain dan pengen diceritain?',
    'Lagi ada di pikiranmu apa nih?',
    'Cerita aja pelan-pelan, aku dengerin.',
    'Mau cerita lebih lanjut soal harimu?',
    'Ada yang bisa aku bantu dengerin hari ini?',
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

  // Setiap kombinasi mood + kategori hasil screening dapat penjelasan
  // kontekstualnya sendiri — bukan cuma ditampilkan saat nggak sejalan,
  // tapi selalu ada catatan yang relevan di dashboard.
  function getMoodValence(mood) {
    if (['Senang', 'Baik'].includes(mood)) return 'positive';
    if (['Sedih', 'Cemas', 'Lelah'].includes(mood)) return 'negative';
    return 'neutral';
  }

  function getConcernLevel(categoryName) {
    return categoryName === 'Perlu Perhatian Lebih' ? 'high' : 'low';
  }

  function getMismatchNote(mood, categoryName) {
    const valence = getMoodValence(mood);
    const concern = getConcernLevel(categoryName);
    const opener = 'Terima kasih sudah jujur dengan apa yang kamu rasakan.';
    const invite = 'Kalau kamu mau, Calmora siap menemanimu memahami perasaanmu, pelan-pelan.';

    if (valence === 'positive' && concern === 'low') {
      return {
        tone: 'positive',
        text: `${opener}\n\nKamu memilih mood "${mood}", dan hasil screening juga menunjukkan kondisi psikologis yang baik — keduanya sejalan.\n\nPertahankan kebiasaan baik yang udah kamu jalani ya.`,
      };
    }
    if (valence === 'positive' && concern === 'high') {
      return {
        tone: 'concern',
        text: `${opener}\n\nMeski kamu memilih mood "${mood}", hasil screening menunjukkan kondisi psikologis yang perlu mendapat perhatian lebih.\n\n${invite}`,
      };
    }
    if (valence === 'neutral' && concern === 'low') {
      return {
        tone: 'positive',
        text: `${opener}\n\nKamu memilih mood "Biasa", dan hasil screening menunjukkan kondisi psikologis yang baik. Harimu sepertinya berjalan cukup stabil.\n\nTetap semangat menjalani hari-harimu ya.`,
      };
    }
    if (valence === 'neutral' && concern === 'high') {
      return {
        tone: 'concern',
        text: `${opener}\n\nMeski kamu memilih mood "Biasa", hasil screening menunjukkan kondisi psikologis yang perlu mendapat perhatian lebih.\n\n${invite}`,
      };
    }
    if (valence === 'negative' && concern === 'low') {
      return {
        tone: 'neutral',
        text: `${opener}\n\nMeski kamu memilih mood "${mood}", hasil screening menunjukkan kondisi psikologis yang masih baik. Perasaan itu nggak selalu sejalan langsung dengan hasil skrining, dan itu wajar.\n\nKalau kamu mau cerita lebih lanjut, Calmora siap mendengarkan.`,
      };
    }
    // negative && high — mood dan hasil sama-sama menunjukkan ada yang berat
    return {
      tone: 'concern',
      text: `${opener}\n\nKamu memilih mood "${mood}", dan hasil screening juga menunjukkan kondisi psikologis yang perlu mendapat perhatian lebih.\n\n${invite}`,
    };
  }

  function renderDashboard() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const emptyEl = $('#checkin-empty');
    const filledEl = $('#checkin-filled');
    const mismatchEl = $('#checkin-mismatch');

    if (!saved) {
      emptyEl.classList.remove('hidden');
      filledEl.classList.add('hidden');
      mismatchEl.classList.add('hidden');
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

      const mismatch = getMismatchNote(data.mood, data.category);
      $('#mismatch-text').textContent = mismatch.text;
      mismatchEl.classList.remove('hidden', 'tone-positive', 'tone-neutral', 'tone-concern');
      mismatchEl.classList.add(`tone-${mismatch.tone}`);
    } catch (e) {
      emptyEl.classList.remove('hidden');
      filledEl.classList.add('hidden');
      mismatchEl.classList.add('hidden');
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
  $('#mismatch-chat-btn').addEventListener('click', () => showPage('chat-page'));

  /* ---------------------------------------------------------
     4. MOOD CHECK-IN
     --------------------------------------------------------- */
  function resetMoodAndScreening() {
    state.selectedMood = null;
    state.selectedEmoji = null;
    state.currentQuestion = 0;
    state.answers = new Array(12).fill(null);
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
     5. GENERAL MENTAL HEALTH SCREENING (GHQ-12)
     --------------------------------------------------------- */
  const TOTAL_QUESTIONS = QUESTIONS.length;

  function renderQuestion() {
    const idx = state.currentQuestion;
    $('#question-text').textContent = QUESTIONS[idx].text;
    $('#progress-label').textContent = `Pertanyaan ${idx + 1} dari ${TOTAL_QUESTIONS}`;
    $('#progress-fill').style.width = `${((idx + 1) / TOTAL_QUESTIONS) * 100}%`;

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
          if (state.currentQuestion < TOTAL_QUESTIONS - 1) {
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
    // Item positif (reverse: true) dibalik skornya (3 - nilai) supaya arah
    // skor konsisten: makin tinggi total = makin perlu diperhatikan.
    const score = state.answers.reduce((sum, v, idx) => {
      const raw = v || 0;
      const contribution = QUESTIONS[idx].reverse ? 3 - raw : raw;
      return sum + contribution;
    }, 0);
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

    $('#result-crisis').classList.toggle('hidden', category.name !== 'Perlu Perhatian Lebih');
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
    return bubble;
  }

  function showTypingIndicator() {
    const bubble = document.createElement('div');
    bubble.className = 'bubble bubble-bot bubble-typing';
    bubble.innerHTML = '<span></span><span></span><span></span>';
    chatWindow.appendChild(bubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return bubble;
  }

  function greetIfNeeded() {
    if (greeted) return;
    greeted = true;
    addBubble(
      'Hai, aku Calmora 🌿 Ceritakan apa pun yang kamu rasakan hari ini, aku di sini untuk mendengarkan.',
      'bot'
    );
  }

  // Sistem "bag": ambil dari kantung yang sudah diacak sampai habis,
  // baru diacak ulang. Ini bikin variasi kalimat nggak berulang terus-menerus
  // selama variannya belum habis dipakai semua.
  const responseBags = new Map();

  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function pickFromBag(arr) {
    if (!arr || arr.length === 0) return '';
    if (arr.length === 1) return arr[0];
    let bag = responseBags.get(arr);
    if (!bag || bag.length === 0) {
      bag = shuffle(arr);
      responseBags.set(arr, bag);
    }
    return bag.pop();
  }

  function matchesAny(text, patterns) {
    return patterns.some((kw) => text === kw || text.includes(kw));
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
      const reply = pickFromBag(GREETING_RESPONSES);
      chatMemory.lastTopic = 'greeting';
      return reply;
    }

    // 2. Penutup / ucapan terima kasih
    if (matchesAny(text, CLOSING_PATTERNS)) {
      const reply = pickFromBag(CLOSING_RESPONSES);
      chatMemory.lastTopic = 'closing';
      return reply;
    }

    // 3. Ajakan mau cerita/curhat tapi belum spesifik
    if (matchesAny(text, INVITATION_PATTERNS)) {
      const reply = pickFromBag(INVITATION_RESPONSES);
      chatMemory.lastTopic = 'invitation';
      return reply;
    }

    // 4. Kategori emosi yang cocok
    const category = matchEmotionCategory(text);
    if (category) {
      const sameTopicAsBefore = chatMemory.lastTopic === category.name;
      let reply;
      if (sameTopicAsBefore && Math.random() < 0.6) {
        reply = pickFromBag(category.followups);
      } else {
        const base = pickFromBag(category.responses);
        const addFollowup = category.followups && Math.random() < 0.45;
        reply = addFollowup ? `${base} ${pickFromBag(category.followups)}` : base;
      }
      chatMemory.lastTopic = category.name;
      return reply;
    }

    // 5. Balasan super singkat (iya, hmm, oke, dsb) — hanya dianggap "singkat"
    // kalau memang pendek, supaya kalimat panjang tetap masuk fallback reflektif.
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount <= 3 && matchesAny(text, SHORT_REPLY_PATTERNS)) {
      const reply = pickFromBag(SHORT_REPLY_RESPONSES);
      chatMemory.lastTopic = 'short';
      return reply;
    }

    // 6. Fallback reflektif (tidak ada pola yang cocok sama sekali).
    // Pakai respons netral yang selalu masuk akal, tanpa maksa menyisipkan
    // "topik" dari kalimat user — supaya kalau user ngetik ngasal/random,
    // jawabannya tetap lembut dan tidak terlihat aneh.
    const opener = pickFromBag(REFLECTIVE_OPENERS);
    const question = pickFromBag(REFLECTIVE_QUESTIONS);
    const reply = `${opener} ${question}`;
    chatMemory.lastTopic = 'general';
    return reply;
  }

  /* ---------------------------------------------------------
     VOICE INPUT (mic) — pakai Web Speech API bawaan browser.
     Tidak butuh backend/API key. Berfungsi di browser yang
     mendukung SpeechRecognition (mis. Chrome/Edge). Kalau tidak
     didukung (mis. Safari), tombol mic otomatis dinonaktifkan.
     --------------------------------------------------------- */
  const micBtn = $('#mic-btn');
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognitionAPI && micBtn) {
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'id-ID';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    let isRecording = false;

    recognition.addEventListener('result', (e) => {
      const transcript = e.results[0][0].transcript;
      chatInput.value = chatInput.value ? `${chatInput.value} ${transcript}` : transcript;
      chatInput.focus();
    });

    recognition.addEventListener('end', () => {
      isRecording = false;
      micBtn.classList.remove('recording');
    });

    recognition.addEventListener('error', () => {
      isRecording = false;
      micBtn.classList.remove('recording');
    });

    micBtn.addEventListener('click', () => {
      if (isRecording) {
        recognition.stop();
        return;
      }
      isRecording = true;
      micBtn.classList.add('recording');
      recognition.start();
    });
  } else if (micBtn) {
    micBtn.disabled = true;
    micBtn.title = 'Voice input tidak didukung di browser ini';
  }

  /* ---------------------------------------------------------
     CHAT SUBMIT — pakai chatbot lokal (rule-based), tanpa backend.
     --------------------------------------------------------- */
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = chatInput.value.trim();
    if (!value) return;

    addBubble(value, 'user');
    chatInput.value = '';

    const typingBubble = showTypingIndicator();
    const thinkTime = 500 + Math.random() * 500;

    setTimeout(() => {
      typingBubble.remove();
      addBubble(getBotResponse(value), 'bot');
    }, thinkTime);
  });

  // Greet the first time the chat page becomes visible
  const chatNavLink = document.querySelector('.nav-link[data-target="chat-page"]');
  if (chatNavLink) chatNavLink.addEventListener('click', greetIfNeeded);
  $('#dash-chat-btn').addEventListener('click', greetIfNeeded);
  $('#result-chat-btn').addEventListener('click', greetIfNeeded);
  $('#mismatch-chat-btn').addEventListener('click', greetIfNeeded);

  /* ---------------------------------------------------------
     INIT
     --------------------------------------------------------- */
  renderDashboard();
})();
