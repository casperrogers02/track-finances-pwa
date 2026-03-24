// Theme & personalization utilities
// Stores per-user preferences in localStorage keyed by user id.

// Get getUser function - try to access from global scope or define fallback
const getUser = (() => {
  // Try to get from window if api.js loaded as module
  if (window.getUser) return window.getUser;
  // Fallback implementation
  return () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  };
})();

const DEFAULT_PREFS = {
  theme: 'light',          // light | dark | contrast
  textScale: 1,            // 1 = 100%
  reduceMotion: false,
  animations: true
};

function getUserIdForPrefs() {
  const user = getUser && getUser();
  return user && user.id ? `sw_prefs_${user.id}` : 'sw_prefs_guest';
}

function loadPrefs() {
  const key = getUserIdForPrefs();
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(prefs) {
  const key = getUserIdForPrefs();
  localStorage.setItem(key, JSON.stringify(prefs));
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
}

function applyTextScale(scale) {
  const clamped = Math.max(0.85, Math.min(1.3, scale));
  document.documentElement.style.setProperty('--text-scale', clamped);
  document.body.style.fontSize = `${16 * clamped}px`;
}

function applyMotion(reduce) {
  document.body.setAttribute('data-reduce-motion', reduce ? 'true' : 'false');
}

function applyPrefs() {
  const prefs = loadPrefs();
  applyTheme(prefs.theme);
  applyTextScale(prefs.textScale);
  applyMotion(prefs.reduceMotion);
  return prefs;
}

// Public setters
function setThemePref(theme) {
  const prefs = loadPrefs();
  prefs.theme = theme;
  savePrefs(prefs);
  applyTheme(theme);
}

function setTextScalePref(scale) {
  const prefs = loadPrefs();
  prefs.textScale = scale;
  savePrefs(prefs);
  applyTextScale(scale);
}

function setReduceMotionPref(reduce) {
  const prefs = loadPrefs();
  prefs.reduceMotion = !!reduce;
  savePrefs(prefs);
  applyMotion(!!reduce);
}

// Expose globally
window.themePrefs = {
  loadPrefs,
  applyPrefs,
  setThemePref,
  setTextScalePref,
  setReduceMotionPref
};

// Auto-apply on load
document.addEventListener('DOMContentLoaded', applyPrefs);

