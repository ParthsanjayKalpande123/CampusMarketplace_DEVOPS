/**
 * public/js/profile.js
 *
 * Profile page — saves profile updates to the API.
 */

'use strict';

const profileForm = document.getElementById('profileForm');
if (profileForm) {
  profileForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    window.CampusMarket.hideAlert('profileAlert');

    const saveBtn      = document.getElementById('saveProfileBtn');
    const name         = document.getElementById('name').value.trim();
    const college      = document.getElementById('college').value.trim();
    const phone        = document.getElementById('phone').value.trim();
    const profileImage = document.getElementById('profileImage').value.trim();

    if (!name) {
      window.CampusMarket.showAlert('profileAlert', 'Name is required.');
      return;
    }

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving...';

    const body = { name };
    if (college)      body.college      = college;
    if (phone)        body.phone        = phone;
    if (profileImage) body.profileImage = profileImage;

    try {
      const res  = await fetch('/api/v1/users/me', {
        method:      'PUT',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok) {
        window.CampusMarket.showAlert('profileAlert', 'Profile updated successfully.', 'success');
      } else {
        let msg = 'Failed to update profile. Please try again.';
        if (data.error) {
          if (data.error.fields && data.error.fields.length > 0) {
            msg = data.error.fields.map(f => f.message).join(' ');
          } else if (data.error.message) {
            msg = data.error.message;
          }
        }
        window.CampusMarket.showAlert('profileAlert', msg);
      }
    } catch {
      window.CampusMarket.showAlert('profileAlert', 'Network error. Please check your connection and try again.');
    } finally {
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Save Changes';
    }
  });
}
