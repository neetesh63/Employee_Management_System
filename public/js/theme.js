/* theme.js — earliest script, runs before DOMContentLoaded */
(function () {
  const saved = localStorage.getItem('pd_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
})();
