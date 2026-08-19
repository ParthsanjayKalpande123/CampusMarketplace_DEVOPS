/**
 * public/js/listing.js
 *
 * Product detail page — handles status updates, deletion, and reports.
 */

'use strict';

/* ------------------------------------------------------------------
   Update status (mark as sold, etc.)
   ------------------------------------------------------------------ */

document.querySelectorAll('[data-action="update-status"]').forEach(function (btn) {
  btn.addEventListener('click', async function () {
    const productId = this.dataset.productId;
    const status    = this.dataset.status;

    this.disabled    = true;
    this.textContent = 'Updating...';

    try {
      const res = await fetch(`/api/v1/products/${productId}/status`, {
        method:      'PATCH',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ status }),
      });

      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error && data.error.message ? data.error.message : 'Failed to update status.');
        this.disabled = false;
        this.textContent = 'Mark as Sold';
      }
    } catch {
      alert('Network error. Please try again.');
      this.disabled = false;
    }
  });
});

/* ------------------------------------------------------------------
   Delete product — show confirm modal, then call DELETE API
   ------------------------------------------------------------------ */

const deleteModal   = document.getElementById('deleteModal');
const deleteModalBS = deleteModal ? new bootstrap.Modal(deleteModal) : null;

document.querySelectorAll('[data-action="delete-product"]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    if (deleteModalBS) deleteModalBS.show();
  });
});

const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
if (confirmDeleteBtn) {
  confirmDeleteBtn.addEventListener('click', async function () {
    const productId  = this.dataset.productId;
    this.disabled    = true;
    this.textContent = 'Deleting...';

    try {
      const res = await fetch(`/api/v1/products/${productId}`, {
        method:      'DELETE',
        credentials: 'same-origin',
      });

      if (res.status === 204) {
        window.location.href = '/my-listings';
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error && data.error.message ? data.error.message : 'Failed to delete listing.');
        this.disabled    = false;
        this.textContent = 'Yes, Delete';
        if (deleteModalBS) deleteModalBS.hide();
      }
    } catch {
      alert('Network error. Please try again.');
      this.disabled = false;
    }
  });
}

/* ------------------------------------------------------------------
   Report product — open modal on button click
   ------------------------------------------------------------------ */

const reportModal   = document.getElementById('reportModal');
const reportModalBS = reportModal ? new bootstrap.Modal(reportModal) : null;

document.querySelectorAll('[data-action="report-product"]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    if (reportModalBS) reportModalBS.show();
  });
});

const submitReportBtn = document.getElementById('submitReportBtn');
if (submitReportBtn) {
  submitReportBtn.addEventListener('click', async function () {
    const productId   = this.dataset.productId;
    const reason      = document.getElementById('reportReason').value;
    const description = document.getElementById('reportDescription').value.trim();
    const alertEl     = document.getElementById('reportAlert');

    if (!reason) {
      if (alertEl) {
        alertEl.className = 'alert alert-danger';
        alertEl.textContent = 'Please select a reason.';
        alertEl.classList.remove('d-none');
      }
      return;
    }

    this.disabled    = true;
    this.textContent = 'Submitting...';
    if (alertEl) alertEl.classList.add('d-none');

    const body = { productId, reason };
    if (description) body.description = description;

    try {
      const res  = await fetch('/api/v1/reports', {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok) {
        if (alertEl) {
          alertEl.className   = 'alert alert-success';
          alertEl.textContent = 'Report submitted. Thank you for helping keep the marketplace safe.';
          alertEl.classList.remove('d-none');
        }
        this.disabled    = true;
        this.textContent = 'Reported';
      } else {
        const msg = data.error && data.error.message ? data.error.message : 'Failed to submit report.';
        if (alertEl) {
          alertEl.className   = 'alert alert-danger';
          alertEl.textContent = msg;
          alertEl.classList.remove('d-none');
        }
        this.disabled    = false;
        this.textContent = 'Submit Report';
      }
    } catch {
      if (alertEl) {
        alertEl.className   = 'alert alert-danger';
        alertEl.textContent = 'Network error. Please try again.';
        alertEl.classList.remove('d-none');
      }
      this.disabled    = false;
      this.textContent = 'Submit Report';
    }
  });
}
