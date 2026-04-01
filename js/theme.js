/**
 * theme.js – Light/Dark toggle. Theme class is applied to <html> so all
 * CSS variables cascade correctly. Persists in localStorage.
 */
(function () {
  function _current() {
    return document.documentElement.classList.contains('light') ? 'light' : 'dark';
  }

  function _applyTheme(t) {
    document.documentElement.classList.toggle('light', t === 'light');
    const btn = document.getElementById('theme-btn');
    if (btn) btn.setAttribute('aria-label', t === 'light' ? 'Dunkles Theme' : 'Helles Theme');
    if (btn) btn.textContent = t === 'light' ? '◑' : '◐';
  }

  function toggleTheme() {
    const next = _current() === 'light' ? 'dark' : 'light';
    localStorage.setItem('mc_theme', next);
    _applyTheme(next);
  }

  // Update button label once DOM is ready (class already applied by inline head script)
  document.addEventListener('DOMContentLoaded', function () {
    _applyTheme(_current());
  });

  window.toggleTheme = toggleTheme;
}());
