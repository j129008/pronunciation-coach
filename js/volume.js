// Playback volume (0–1) for every sound the app plays, independent of the system volume.
// Lets mic monitoring stay loud (system volume up) while lesson audio stays comfortable.
(function () {
  const get = () => { const v = parseFloat(localStorage.playVol); return isNaN(v) ? 0.3 : Math.min(1, Math.max(0, v)); };
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { this.volume = get(); return origPlay.apply(this, arguments); };
  if (window.speechSynthesis) {
    const origSpeak = speechSynthesis.speak.bind(speechSynthesis);
    speechSynthesis.speak = u => { u.volume = get(); return origSpeak(u); };
  }
  document.addEventListener('DOMContentLoaded', () => {
    const r = document.getElementById('playVol'), out = document.getElementById('playVolPct');
    if (!r) return;
    r.value = Math.round(get() * 100); out.textContent = r.value + '%';
    r.oninput = () => { localStorage.playVol = r.value / 100; out.textContent = r.value + '%'; };
  });
})();
