/**
 * public/js/main.js
 *
 * Global utilities: logout handler, alert helpers.
 * Loaded on every page that has a navbar.
 */

'use strict';

/* ------------------------------------------------------------------
   Alert helpers
   ------------------------------------------------------------------ */

/**
 * Shows a Bootstrap alert inside the given container element.
 *
 * @param {string}          containerId — id of the alert div
 * @param {string}          message
 * @param {'success'|'danger'|'warning'|'info'} type
 */
function showAlert(containerId, message, type = 'danger') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.classList.remove('d-none');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideAlert(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.classList.add('d-none');
}

/* ------------------------------------------------------------------
   Logout — used by navbar logout button and profile page
   ------------------------------------------------------------------ */

async function logout() {
  try {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    // best-effort
  }
  window.location.href = '/';
}

// Navbar logout button
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', logout);
}

// Profile page logout button
const logoutBtnProfile = document.getElementById('logoutBtnProfile');
if (logoutBtnProfile) {
  logoutBtnProfile.addEventListener('click', logout);
}

const autoSubmitSelects = document.querySelectorAll('form[method="GET"] select');
autoSubmitSelects.forEach((select) => {
  select.addEventListener('change', () => select.form.submit());
});

const goBackBtn = document.getElementById('goBackBtn');
if (goBackBtn) {
  goBackBtn.addEventListener('click', () => window.history.back());
}

/* ------------------------------------------------------------------
   Password visibility toggle (login + register pages)
   ------------------------------------------------------------------ */

const togglePassword = document.getElementById('togglePassword');
if (togglePassword) {
  togglePassword.addEventListener('click', function () {
    const passwordInput = document.getElementById('password');
    const eyeIcon       = document.getElementById('eyeIcon');
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      eyeIcon.className  = 'bi bi-eye-slash';
      this.setAttribute('aria-label', 'Hide password');
    } else {
      passwordInput.type = 'password';
      eyeIcon.className  = 'bi bi-eye';
      this.setAttribute('aria-label', 'Show password');
    }
  });
}

/* ------------------------------------------------------------------
   Exports (available globally on window)
   ------------------------------------------------------------------ */
window.CampusMarket = { showAlert, hideAlert, logout };
