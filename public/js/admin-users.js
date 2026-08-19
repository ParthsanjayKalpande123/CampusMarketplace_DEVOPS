/**
 * public/js/admin-users.js
 *
 * Admin users page — inline role change via API.
 */

'use strict';

document.querySelectorAll('[data-action="change-role"]').forEach(function (btn) {
  btn.addEventListener('click', async function () {
    const userId = this.dataset.userId;
    const role   = this.dataset.role;

    const confirmMsg = role === 'admin'
      ? 'Promote this user to Admin? They will have full admin access.'
      : 'Demote this user to Student? They will lose admin access.';

    if (!window.confirm(confirmMsg)) return;

    this.disabled = true;

    try {
      const res  = await fetch(`/api/v1/admin/users/${userId}/role`, {
        method:      'PATCH',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ role }),
      });
      const data = await res.json();

      if (res.ok) {
        // Reload to reflect new badge and button state
        window.location.reload();
      } else {
        const msg = data.error && data.error.message ? data.error.message : 'Failed to update role.';
        window.CampusMarket.showAlert('usersAlert', msg);
        this.disabled = false;
      }
    } catch {
      window.CampusMarket.showAlert('usersAlert', 'Network error. Please try again.');
      this.disabled = false;
    }
  });
});
