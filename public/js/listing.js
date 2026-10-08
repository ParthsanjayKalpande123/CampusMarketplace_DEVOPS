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

const offerForm = document.getElementById('offerForm');
offerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const exchangeProductId = document.getElementById('exchangeProduct')?.value || '';
  const body = {
    productId: window.location.pathname.split('/').pop(),
    kind: exchangeProductId ? 'exchange' : 'price',
    amount: Number(document.getElementById('offerAmount').value),
    exchangeProductId,
    additionalCash: Number(document.getElementById('additionalCash')?.value || 0),
    message: document.getElementById('offerMessage').value.trim(),
  };
  try {
    const response = await fetch('/api/v1/features/offers', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error && result.error.message || 'Offer could not be sent.');
    window.alert('Offer sent to the seller.');
    offerForm.reset();
  } catch (error) {
    window.alert(error.message || 'Offer could not be sent.');
  }
});

document.getElementById('reportSellerBtn')?.addEventListener('click', async (event) => {
  const reason = window.prompt('Reason: scam, harassment, fake_listing, spam, misleading_information, off_platform_payment, or other');
  if (!reason) return;
  const description = window.prompt('Add details (optional):') || '';
  try {
    const response = await fetch(`/api/v1/features/sellers/${event.currentTarget.dataset.sellerId}/report`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim(), description }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error && result.error.message || 'Seller report could not be submitted.');
    window.alert('Seller report submitted to admins.');
  } catch (error) {
    window.alert(error.message || 'Seller report could not be submitted.');
  }
});

document.getElementById('blockSellerBtn')?.addEventListener('click', async (event) => {
  if (!window.confirm('Block this user? This also prevents messages in either direction.')) return;
  try {
    const response = await fetch(`/api/v1/features/blocks/${event.currentTarget.dataset.sellerId}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error && result.error.message || 'User could not be blocked.');
    window.alert('User blocked.');
    window.location.reload();
  } catch (error) {
    window.alert(error.message || 'User could not be blocked.');
  }
});

document.getElementById('checkListingCredibility')?.addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const result = document.getElementById('listingCredibilityResult');
  const originalText = button.textContent;
  button.disabled = true;
  button.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Checking...';
  result.replaceChildren();
  try {
    const response = await fetch('/api/v1/features/ai/fraud/listing', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: button.dataset.productId }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error && payload.error.message || 'AI review failed.');
    const assessment = payload.data.assessment;
    const score = Math.max(0, Math.min(100, Math.round(Number(assessment.score))));
    const resultCard = document.createElement('div');
    resultCard.className = 'cm-credibility-result';
    const heading = document.createElement('strong');
    heading.textContent = `${assessment.verdictLabel} · ${score}/100 listing credibility`;
    const explanation = document.createElement('p');
    explanation.className = 'small text-muted mt-1 mb-2';
    explanation.textContent = assessment.note;
    const meter = document.createElement('div');
    meter.className = 'progress mb-3';
    meter.setAttribute('role', 'progressbar');
    meter.setAttribute('aria-label', 'AI listing credibility score');
    meter.setAttribute('aria-valuemin', '0');
    meter.setAttribute('aria-valuemax', '100');
    meter.setAttribute('aria-valuenow', String(score));
    const bar = document.createElement('div');
    bar.className = `progress-bar ${score < 45 ? 'bg-danger' : score < 70 ? 'bg-warning' : 'bg-success'}`;
    bar.style.width = `${score}%`;
    meter.append(bar);
    resultCard.append(heading, explanation, meter);

    [
      { title: 'Signals considered', values: assessment.evidence },
      { title: 'Signals to review', values: assessment.riskFlags },
    ].forEach(({ title, values }) => {
      if (!values.length) return;
      const subheading = document.createElement('strong');
      subheading.className = 'small d-block mt-2';
      subheading.textContent = title;
      const list = document.createElement('ul');
      list.className = 'small mb-2';
      values.forEach((value) => {
        const item = document.createElement('li');
        item.textContent = value;
        list.append(item);
      });
      resultCard.append(subheading, list);
    });
    result.append(resultCard);
  } catch (error) {
    result.textContent = error.message || 'AI review failed.';
    result.classList.add('text-danger');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});

const compareStorageKey = 'campus-marketplace-compare';
let compareIds = [];
try {
  const stored = JSON.parse(window.localStorage.getItem(compareStorageKey) || '[]');
  if (Array.isArray(stored)) compareIds = stored.filter((id) => typeof id === 'string').slice(0, 4);
} catch {
  window.localStorage.removeItem(compareStorageKey);
}

function updateCompareCount() {
  const count = document.querySelector('[data-compare-count]');
  if (count) count.textContent = `${compareIds.length} selected (up to 4)`;
}

document.querySelector('[data-compare-add]')?.addEventListener('click', (event) => {
  const id = event.currentTarget.dataset.compareAdd;
  if (compareIds.includes(id)) {
    compareIds = compareIds.filter((item) => item !== id);
  } else if (compareIds.length < 4) {
    compareIds.push(id);
  } else {
    window.alert('Compare up to four listings at a time.');
    return;
  }
  window.localStorage.setItem(compareStorageKey, JSON.stringify(compareIds));
  updateCompareCount();
});

document.querySelector('[data-compare-open]')?.addEventListener('click', () => {
  if (compareIds.length < 2) {
    window.alert('Select at least two listings to compare.');
    return;
  }
  window.location.href = `/account/features?compare=${encodeURIComponent(compareIds.join(','))}`;
});

updateCompareCount();
