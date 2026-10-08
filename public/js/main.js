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
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
  } catch {
    // best-effort
  }
  const marketplaceOrigin = window.location.port === '3001'
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : '';
  window.location.href = `${marketplaceOrigin}/`;
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

const featureApi = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error && result.error.message || 'Request failed.');
  return result.data;
};

const assistantForm = document.getElementById('assistantForm');
assistantForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const answer = document.getElementById('assistantAnswer');
  const submit = assistantForm.querySelector('[type="submit"]');
  submit.disabled = true;
  answer.textContent = 'Searching campus listings and preparing an answer...';
  try {
    const data = await featureApi('/api/v1/features/ai/assistant', {
      method: 'POST',
      body: JSON.stringify({ question: new FormData(assistantForm).get('question') }),
    });
    answer.replaceChildren();
    const assistantResult = data.answer;
    const responseText = document.createElement('p');
    responseText.textContent = typeof assistantResult === 'string' ? assistantResult : assistantResult.answer;
    answer.append(responseText);
    (assistantResult.listings || data.listings || []).forEach((listing) => {
      const link = document.createElement('a');
      link.href = `/listings/${encodeURIComponent(listing._id)}`;
      link.className = 'd-block';
      link.textContent = `${listing.title} — ₹${listing.price}`;
      answer.append(link);
    });
  } catch (error) {
    answer.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

document.querySelectorAll('[data-assistant-example]').forEach((button) => {
  button.addEventListener('click', () => {
    const question = assistantForm?.querySelector('[name="question"]');
    if (!question) return;
    question.value = button.dataset.assistantExample;
    question.focus();
  });
});

document.querySelectorAll('[data-add-wishlist]').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      await featureApi(`/api/v1/features/wishlist/${button.dataset.addWishlist}`, { method: 'POST', body: '{}' });
      button.innerHTML = '<i class="bi bi-heart-fill"></i> Saved';
    } catch (error) {
      if (error.message.includes('Access denied')) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      } else {
        window.alert(error.message);
      }
    }
  });
});

if (document.getElementById('wishlistCount')) {
  featureApi('/api/v1/features/wishlist').then((data) => {
    document.getElementById('wishlistCount').textContent = data.products.length || '';
  }).catch(() => {});
}

document.querySelectorAll('[data-compare-product]').forEach((button) => {
  button.addEventListener('click', () => {
    const ids = JSON.parse(localStorage.getItem('campusCompare') || '[]');
    if (!ids.includes(button.dataset.compareProduct)) ids.push(button.dataset.compareProduct);
    if (ids.length > 4) ids.shift();
    localStorage.setItem('campusCompare', JSON.stringify(ids));
    button.textContent = `Selected (${ids.length})`;
    let link = document.getElementById('compareListingsLink');
    if (!link) {
      link = document.createElement('a');
      link.id = 'compareListingsLink';
      link.className = 'btn btn-sm btn-primary position-fixed bottom-0 end-0 m-3';
      document.body.append(link);
    }
    link.href = `/account/features?compare=${encodeURIComponent(ids.join(','))}`;
    link.textContent = `Compare ${ids.length} listings`;
  });

  document.getElementById('saveCurrentSearch')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const filters = Object.fromEntries([
      ['q', button.dataset.query],
      ['category', button.dataset.category],
      ['condition', button.dataset.condition],
      ['minPrice', button.dataset.minPrice],
      ['maxPrice', button.dataset.maxPrice],
      ['college', button.dataset.college],
    ].filter(([, value]) => value));
    try {
      await featureApi('/api/v1/features/saved-searches', {
        method: 'POST',
        body: JSON.stringify({ title: button.dataset.query || 'My campus search', filters }),
      });
      button.textContent = 'Search saved';
    } catch (error) {
      window.alert(error.message);
    }
  });
});
