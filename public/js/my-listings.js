/**
 * public/js/my-listings.js
 *
 * My Listings page — inline status updates and delete with row removal.
 */

'use strict';

/* ------------------------------------------------------------------
   Inline status update
   ------------------------------------------------------------------ */

document.querySelectorAll('[data-action="update-status"]').forEach(function (btn) {
  btn.addEventListener('click', async function () {
    const productId = this.dataset.productId;
    const status    = this.dataset.status;
    const row       = document.getElementById(`row-${productId}`);

    this.disabled = true;

    try {
      const res = await fetch(`/api/v1/products/${productId}/status`, {
        method:      'PATCH',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ status }),
      });

      if (res.ok) {
        // Reload to refresh the table and stat counts
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        window.CampusMarket.showAlert(
          'pageAlert',
          data.error && data.error.message ? data.error.message : 'Failed to update status.'
        );
        this.disabled = false;
      }
    } catch {
      window.CampusMarket.showAlert('pageAlert', 'Network error. Please try again.');
      this.disabled = false;
    }
  });
});

/* ------------------------------------------------------------------
   Delete product — confirm then remove row
   ------------------------------------------------------------------ */

document.querySelectorAll('[data-action="delete-product"]').forEach(function (btn) {
  btn.addEventListener('click', async function () {
    const productId = this.dataset.productId;
    const row       = document.getElementById(`row-${productId}`);

    if (!window.confirm('Delete this listing permanently? This cannot be undone.')) return;

    this.disabled = true;

    try {
      const res = await fetch(`/api/v1/products/${productId}`, {
        method:      'DELETE',
        credentials: 'same-origin',
      });

      if (res.status === 204) {
        // Animate row removal
        if (row) {
          row.style.opacity    = '0';
          row.style.transition = 'opacity 0.3s ease';
          setTimeout(() => { row.remove(); }, 320);
        }
        window.CampusMarket.showAlert('pageAlert', 'Listing deleted.', 'success');
      } else {
        const data = await res.json().catch(() => ({}));
        window.CampusMarket.showAlert(
          'pageAlert',
          data.error && data.error.message ? data.error.message : 'Failed to delete listing.'
        );
        this.disabled = false;
      }
    } catch {
      window.CampusMarket.showAlert('pageAlert', 'Network error. Please try again.');
      this.disabled = false;
    }
  });
});
