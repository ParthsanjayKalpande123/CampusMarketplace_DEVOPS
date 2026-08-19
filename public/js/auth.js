/**
 * public/js/auth.js
 *
 * Handles login and register form submissions.
 * Loaded on /login and /register pages only.
 */

'use strict';

/* ------------------------------------------------------------------
   Login form
   ------------------------------------------------------------------ */

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const btn      = document.getElementById('loginBtn');
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const redirect = document.getElementById('redirectUrl')
      ? document.getElementById('redirectUrl').value
      : '/';

    // Basic client-side check
    if (!email || !password) {
      window.CampusMarket.showAlert('authAlert', 'Please enter your email and password.');
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Signing in...';
    window.CampusMarket.hideAlert('authAlert');

    try {
      const res  = await fetch('/api/v1/auth/login', {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok) {
        window.location.href = redirect && redirect !== '' ? redirect : '/';
      } else {
        const msg = data.error && data.error.message ? data.error.message : 'Login failed. Please try again.';
        window.CampusMarket.showAlert('authAlert', msg);
        btn.disabled    = false;
        btn.textContent = 'Sign In';
      }
    } catch {
      window.CampusMarket.showAlert('authAlert', 'Network error. Please check your connection and try again.');
      btn.disabled    = false;
      btn.textContent = 'Sign In';
    }
  });
}

/* ------------------------------------------------------------------
   Register form
   ------------------------------------------------------------------ */

const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const btn      = document.getElementById('registerBtn');
    const name     = document.getElementById('name').value.trim();
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const college  = document.getElementById('college')
      ? document.getElementById('college').value.trim()
      : '';

    if (!name || !email || !password) {
      window.CampusMarket.showAlert('authAlert', 'Please fill in all required fields.');
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Creating account...';
    window.CampusMarket.hideAlert('authAlert');

    const body = { name, email, password };
    if (college) body.college = college;

    try {
      const res  = await fetch('/api/v1/auth/register', {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok) {
        // Registration succeeded — show success then redirect to login
        window.CampusMarket.showAlert('authAlert', 'Account created! Redirecting to login...', 'success');
        setTimeout(() => { window.location.href = '/login'; }, 1500);
      } else {
        let msg = 'Registration failed. Please try again.';
        if (data.error) {
          if (data.error.fields && data.error.fields.length > 0) {
            msg = data.error.fields.map(f => f.message).join(' ');
          } else if (data.error.message) {
            msg = data.error.message;
          }
        }
        window.CampusMarket.showAlert('authAlert', msg);
        btn.disabled    = false;
        btn.textContent = 'Create Account';
      }
    } catch {
      window.CampusMarket.showAlert('authAlert', 'Network error. Please check your connection and try again.');
      btn.disabled    = false;
      btn.textContent = 'Create Account';
    }
  });
}
