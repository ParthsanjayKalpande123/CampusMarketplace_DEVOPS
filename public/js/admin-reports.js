/**
 * public/js/admin-reports.js
 *
 * Admin reports page — inline status updates via API.
 */

'use strict';

document.querySelectorAll('[data-action="update-report-status"]').forEach(function (btn) {
  btn.addEventListener('click', async function () {
    const reportId = this.dataset.reportId;
    const status   = this.dataset.status;

    this.disabled = true;

    try {
      const res  = await fetch(`/api/v1/admin/reports/${reportId}/status`, {
        method:      'PATCH',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ status }),
      });
      const data = await res.json();

      if (res.ok) {
        window.location.reload();
      } else {
        const msg = data.error && data.error.message ? data.error.message : 'Failed to update report.';
        window.CampusMarket.showAlert('reportsAlert', msg);
        this.disabled = false;
      }
    } catch {
      window.CampusMarket.showAlert('reportsAlert', 'Network error. Please try again.');
      this.disabled = false;
    }
  });
});
