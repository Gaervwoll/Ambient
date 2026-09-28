// app.js
import { PRESETS, generateWav } from './wav-generator.js';

(() => {
  'use strict';

  // ---------- DOM ----------
  const orb      = document.getElementById('orb');
  const icon     = document.getElementById('icon');
  const rateEl   = document.getElementById('rate');
  const statusEl = document.getElementById('status');
  const installBtn = document.getElementById('installBtn');

  // ---------- Audio ----------
  const audio = new Audio();
  audio.loop = true;
  audio.preload = 'auto';
  if ('preservesPitch' in audio) audio.preservesPitch = false;
  if ('mozPreservesPitch' in audio) audio.mozPreservesPitch = false;
  if ('webkitPreservesPitch' in audio) audio.webkitPreservesPitch = false;

  let rate = 1.0;
  let presetIndex = 0;
  const urls = []; // держим blob-URL'ы, чистим при перезагрузке

  // ---------- Генерация всех пресетов один раз при старте ----------
  function buildPreset(i) {
    const preset = PRESETS[i];
    const blob = generateWav(preset, 12, 22050);
    const url = URL.createObjectURL(blob);
    urls.push(url);
    return { preset, url };
  }

  const presets = PRESETS.map((_, i) => buildPreset(i));

  function loadPreset(i) {
    presetIndex = (i + presets.length) % presets.length;
    const wasPlaying = !audio.paused;
    audio.src = presets[presetIndex].url;
    audio.load();
    if (wasPlaying) audio.play().catch(() => {});
    setStatus('Пресет: ' + presets[presetIndex].preset.name);
    updateMediaSession();
  }

  // ---------- Управление ----------
  function setRate(newRate) {
    rate = Math.min(2, Math.max(0.5, +newRate.toFixed(2)));
    audio.playbackRate = rate;
    rateEl.textContent = rate.toFixed(2) + '×';
    updateMediaSession();
  }
  function adjustRate(d) { setRate(rate + d); }

  function setStatus(t) { statusEl.textContent = t; }

  async function toggle() {
    try {
      if (audio.paused) {
        if (!audio.src) loadPreset(0);
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (e) {
      setStatus('Ошибка: ' + e.message);
      console.error(e);
    }
  }

  // ---------- Events ----------
  orb.addEventListener('click', toggle);
  document.querySelectorAll('[data-delta]').forEach(b =>
    b.addEventListener('click', () => adjustRate(parseFloat(b.dataset.delta))));
  document.getElementById('reset').addEventListener('click', () => setRate(1.0));
  document.getElementById('presetPrev').addEventListener('click', () => loadPreset(presetIndex - 1));
  document.getElementById('presetNext').addEventListener('click', () => loadPreset(presetIndex + 1));

  audio.addEventListener('play', () => {
    orb.classList.add('playing');
    icon.textContent = '❚❚';
    updateMediaSession();
  });
  audio.addEventListener('pause', () => {
    orb.classList.remove('playing');
    icon.textContent = '▶';
    updateMediaSession();
  });
  audio.addEventListener('loadedmetadata', () => {
    if (audio.duration && isFinite(audio.duration)) {
      setStatus('Готово · ' + audio.duration.toFixed(0) + 'с цикл');
    }
  });
  audio.addEventListener('error', () => {
    setStatus('Ошибка аудио');
  });

  // ---------- MediaSession ----------
  function updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const p = presets[presetIndex]?.preset?.name ?? '—';
    navigator.mediaSession.metadata = new MediaMetadata({
      title: p + ' · ' + rate.toFixed(2) + '×',
      artist: 'Ambient Generator',
      album: 'Local',
      artwork: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
    navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
  }

  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    const safe = (name, fn) => { try { ms.setActionHandler(name, fn); } catch (_) {} };
    safe('play', () => toggle());
    safe('pause', () => toggle());
    safe('nexttrack', () => loadPreset(presetIndex + 1));
    safe('previoustrack', () => loadPreset(presetIndex - 1));
    safe('seekforward', () => adjustRate(+0.05));
    safe('seekbackward', () => adjustRate(-0.05));
    safe('stop', () => { audio.pause(); audio.currentTime = 0; });
  }

  // ---------- PWA: регистрация SW и кнопка установки ----------
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  }

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') installBtn.hidden = true;
    deferredPrompt = null;
  });
  window.addEventListener('appinstalled', () => {
    installBtn.hidden = true;
  });

  // На всякий — если страница открыта уже как приложение
  if (window.matchMedia('(display-mode: standalone)').matches) {
    installBtn.hidden = true;
  }

  // ---------- Init ----------
  loadPreset(0);
  setStatus('Нажми ▶');
})();