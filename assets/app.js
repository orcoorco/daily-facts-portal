/**
 * app.js - Interactive features for Daily Facts Portal
 * - Audio playback & chapter seeking
 * - Bilingual reading & real-time translation
 * - Speech synthesis pronunciation
 * - Instant catalog filtering
 * - Theme switcher & font controls
 */

// Theme Management
(function initTheme() {
  const saved = localStorage.getItem('df_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', saved);

  const toggleBtn = document.getElementById('themeToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('df_theme', next);
    });
  }
})();

// Audio Player
const audio = document.getElementById('mainAudio');
const playPauseBtn = document.getElementById('playPauseBtn');
const progressBar = document.getElementById('progressBar');
const currentTimeEl = document.getElementById('currentTime');
const totalDurationEl = document.getElementById('totalDuration');
const speedSelect = document.getElementById('speedSelect');

if (audio) {
  // Set default slow speed (0.8x)
  audio.playbackRate = 0.8;

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const progress = (audio.currentTime / audio.duration) * 100;
    if (progressBar) progressBar.value = progress;
    if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
  });

  audio.addEventListener('loadedmetadata', () => {
    if (totalDurationEl && !isNaN(audio.duration)) {
      totalDurationEl.textContent = formatTime(audio.duration);
    }
  });

  audio.addEventListener('play', () => {
    if (playPauseBtn) playPauseBtn.textContent = '⏸';
  });

  audio.addEventListener('pause', () => {
    if (playPauseBtn) playPauseBtn.textContent = '▶';
  });
}

function togglePlay() {
  if (!audio) return;
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
}

function skipAudio(seconds) {
  if (!audio) return;
  audio.currentTime = Math.max(0, Math.min(audio.duration || Infinity, audio.currentTime + seconds));
}

function seekProgress(val) {
  if (!audio || !audio.duration) return;
  audio.currentTime = (val / 100) * audio.duration;
}

function setAudioSpeed(speed) {
  if (!audio) return;
  audio.playbackRate = parseFloat(speed);
}

function seekAudio(timestampStr) {
  if (!audio) return;
  const parts = timestampStr.split(':').map(p => parseInt(p, 10));
  let sec = 0;
  if (parts.length === 2) {
    sec = parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  audio.currentTime = sec;
  audio.play();

  // Scroll to sticky player or top of transcript smoothly
  const player = document.getElementById('stickyPlayer');
  if (player) {
    player.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Catalog Search Filter
const catalogSearch = document.getElementById('catalogSearch');
const episodeGrid = document.getElementById('episodeGrid');
const matchCountEl = document.getElementById('matchCount');

if (catalogSearch && episodeGrid) {
  catalogSearch.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const cards = episodeGrid.querySelectorAll('.catalog-card');
    let visible = 0;

    cards.forEach(card => {
      const title = card.getAttribute('data-title') || '';
      const vocab = card.getAttribute('data-vocab') || '';
      if (!q || title.includes(q) || vocab.includes(q)) {
        card.style.display = 'flex';
        visible++;
      } else {
        card.style.display = 'none';
      }
    });

    if (matchCountEl) {
      matchCountEl.textContent = visible;
    }
  });
}

// Interactive Reader & Translation
let currentReaderMode = 'single';
let currentTargetLang = 'en';
const translationCache = {};

function setReaderMode(mode) {
  currentReaderMode = mode;
  const container = document.getElementById('readerContainer');
  const singleBtn = document.getElementById('singleModeBtn');
  const parallelBtn = document.getElementById('parallelModeBtn');

  if (!container) return;

  if (mode === 'parallel') {
    container.classList.add('mode-parallel');
    if (parallelBtn) parallelBtn.classList.add('active');
    if (singleBtn) singleBtn.classList.remove('active');

    // Trigger translation for visible rows
    translateAllVisibleRows();
  } else {
    container.classList.remove('mode-parallel');
    if (singleBtn) singleBtn.classList.add('active');
    if (parallelBtn) parallelBtn.classList.remove('active');
  }
}

function updateTranslationTarget() {
  const select = document.getElementById('targetLangSelect');
  if (select) {
    currentTargetLang = select.value;
    if (currentReaderMode === 'parallel') {
      translateAllVisibleRows(true);
    }
  }
}

async function fetchTranslation(text, sourceLang, targetLang) {
  const cacheKey = `${sourceLang}_${targetLang}_${text.trim()}`;
  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Translation request failed');
    const data = await res.json();
    const translated = data[0].map(chunk => chunk[0]).join(' ');
    translationCache[cacheKey] = translated;
    return translated;
  } catch (err) {
    console.warn('Translate error:', err);
    return text;
  }
}

async function toggleParagraphTranslation(index) {
  const row = document.getElementById(`row-${index}`);
  const col = document.getElementById(`trans-col-${index}`);
  if (!row || !col) return;

  const isVisible = row.classList.contains('has-trans');
  if (isVisible && currentReaderMode !== 'parallel') {
    row.classList.remove('has-trans');
    return;
  }

  row.classList.add('has-trans');
  col.innerHTML = '<div class="trans-placeholder">Translating...</div>';

  const textEl = row.querySelector('.transcript-text');
  const text = textEl ? textEl.textContent : '';
  const lang = document.body.getAttribute('data-lang') || 'de';

  const translated = await fetchTranslation(text, lang, currentTargetLang);
  col.innerHTML = `<p class="trans-text">${translated}</p>`;
}

async function translateAllVisibleRows(force = false) {
  const rows = document.querySelectorAll('.transcript-row');
  const lang = document.body.getAttribute('data-lang') || 'de';

  // Translate up to first 25 paragraphs immediately
  const limit = Math.min(rows.length, 30);
  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    const col = document.getElementById(`trans-col-${i}`);
    if (!col) continue;

    if (force || !row.classList.contains('has-trans')) {
      row.classList.add('has-trans');
      const textEl = row.querySelector('.transcript-text');
      if (textEl) {
        fetchTranslation(textEl.textContent, lang, currentTargetLang).then(translated => {
          col.innerHTML = `<p class="trans-text">${translated}</p>`;
        });
      }
    }
  }
}

// Font Size Controls
let currentFontSizeRem = 1.125;
function adjustFontSize(delta) {
  currentFontSizeRem = Math.max(0.9, Math.min(1.6, currentFontSizeRem + (delta * 0.1)));
  document.documentElement.style.setProperty('--transcript-font-size', `${currentFontSizeRem}rem`);
}

// Speech Synthesis Pronunciation
function speakText(btn, langCode) {
  const row = btn.closest('.transcript-row');
  if (!row) return;
  const textEl = row.querySelector('.transcript-text');
  if (!textEl) return;
  speakTerm(textEl.textContent, langCode);
}

function speakTerm(term, langCode) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(term);
  const langMap = {
    de: 'de-DE',
    es: 'es-ES',
    fr: 'fr-FR',
    en: 'en-US',
    pt: 'pt-BR',
    it: 'it-IT'
  };
  utterance.lang = langMap[langCode] || 'de-DE';
  utterance.rate = 0.85; // Slow beginner rate
  window.speechSynthesis.speak(utterance);
}

function handleWordClick(event, langCode) {
  const selection = window.getSelection().toString().trim();
  if (selection && selection.length > 1 && selection.length < 30) {
    speakTerm(selection, langCode);
  }
}
