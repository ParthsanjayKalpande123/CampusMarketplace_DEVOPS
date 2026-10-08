'use strict';

const featureAlert = document.getElementById('featureAlert');

async function featureRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error && result.error.message || 'Request failed.');
  return result.data;
}

function featureMessage(message, type = 'success') {
  featureAlert.className = `alert alert-${type}`;
  featureAlert.textContent = message;
  featureAlert.classList.remove('d-none');
}

document.querySelectorAll('[data-remove-wishlist]').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      await featureRequest(`/api/v1/features/wishlist/${button.dataset.removeWishlist}`, { method: 'DELETE' });
      window.location.reload();
    } catch (error) {
      featureMessage(error.message, 'danger');
    }
  });
});

const saveSearchForm = document.getElementById('saveSearchForm');
if (saveSearchForm) {
  saveSearchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(saveSearchForm);
    const filters = Object.fromEntries(['q', 'minPrice', 'maxPrice']
      .map((key) => [key, String(form.get(key) || '').trim()])
      .filter(([, value]) => value));
    try {
      await featureRequest('/api/v1/features/saved-searches', {
        method: 'POST',
        body: JSON.stringify({ title: form.get('title'), filters }),
      });
      window.location.reload();
    } catch (error) {
      featureMessage(error.message, 'danger');
    }
  });
}

document.querySelectorAll('[data-delete-search]').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      await featureRequest(`/api/v1/features/saved-searches/${button.dataset.deleteSearch}`, { method: 'DELETE' });
      window.location.reload();
    } catch (error) {
      featureMessage(error.message, 'danger');
    }
  });
});

const interestsForm = document.getElementById('interestsForm');
if (interestsForm) {
  interestsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const categoryIds = [...interestsForm.querySelectorAll('input:checked')].map((input) => input.value);
    try {
      await featureRequest('/api/v1/features/interests', {
        method: 'PUT',
        body: JSON.stringify({ categoryIds }),
      });
      featureMessage('Your interests were saved.');
    } catch (error) {
      featureMessage(error.message, 'danger');
    }
  });
}

document.querySelectorAll('[data-mark-notifications-read]').forEach((button) => {
  button.addEventListener('click', async () => {
  try {
    await featureRequest('/api/v1/features/notifications/read', { method: 'PATCH', body: '{}' });
    window.location.reload();
  } catch (error) {
    featureMessage(error.message, 'danger');
  }
  });
});

document.querySelectorAll('[data-open-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    const tab = document.querySelector(`#${button.dataset.openTab}-tab`);
    if (tab) bootstrap.Tab.getOrCreateInstance(tab).show();
  });
});

function showAccountTabFromHash() {
  const tabId = window.location.hash.slice(1);
  const tab = document.getElementById(`${tabId}-tab`);
  if (tab) bootstrap.Tab.getOrCreateInstance(tab).show();
}

showAccountTabFromHash();
window.addEventListener('hashchange', showAccountTabFromHash);

document.querySelectorAll('#marketplaceTabs [data-bs-toggle="pill"]').forEach((tab) => {
  tab.addEventListener('shown.bs.tab', (event) => {
    const paneId = event.target.getAttribute('data-bs-target');
    if (paneId) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${paneId}`);
  });
});

document.querySelector('[data-clear-compare]')?.addEventListener('click', () => {
  window.localStorage.removeItem('campus-marketplace-compare');
  window.location.href = '/account/features#discover';
});

document.querySelectorAll('[data-offer-action]').forEach((button) => {
  button.addEventListener('click', async () => {
    let body = { action: button.dataset.offerAction };
    if (body.action === 'counter') {
      const amount = window.prompt('Enter your counter-offer in rupees:');
      if (amount === null) return;
      if (!Number.isFinite(Number(amount)) || Number(amount) < 0) {
        featureMessage('Enter a valid counter-offer amount.', 'danger');
        return;
      }
      body = { ...body, kind: 'price', amount: Number(amount) };
    }
    try {
      await featureRequest(`/api/v1/features/offers/${button.dataset.offerId}/respond`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      window.location.reload();
    } catch (error) {
      featureMessage(error.message, 'danger');
    }
  });
});

document.querySelectorAll('[data-create-qr]').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      const data = await featureRequest(`/api/v1/features/orders/${button.dataset.createQr}/qr`);
      const container = document.getElementById(`qr-${button.dataset.createQr}`);
      container.replaceChildren();
      const image = document.createElement('img');
      image.alt = 'Order handover QR code';
      image.className = 'img-fluid';
      image.src = data.qrCode;
      const instructions = document.createElement('p');
      instructions.className = 'small';
      instructions.textContent = 'Show this code to the seller. Manual code for scanning apps:';
      const token = document.createElement('code');
      token.className = 'text-break';
      token.textContent = data.token;
      container.append(image, instructions, token);
    } catch (error) {
      featureMessage(error.message, 'danger');
    }
  });
});

document.querySelectorAll('[data-complete-order]').forEach((button) => {
  button.addEventListener('click', async () => {
    const id = button.dataset.completeOrder;
    const token = document.querySelector(`[data-complete-token="${id}"]`).value.trim();
    try {
      await featureRequest(`/api/v1/features/orders/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      window.location.reload();
    } catch (error) {
      featureMessage(error.message, 'danger');
    }
  });
});

document.querySelectorAll('[data-scan-qr]').forEach((button) => {
  button.addEventListener('click', async () => {
    const id = button.dataset.scanQr;
    const video = document.querySelector(`[data-qr-camera="${id}"]`);
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
      featureMessage('QR camera scanning is not supported in this browser. Use a QR scanner app and paste the code.', 'warning');
      return;
    }
    let stream;
    try {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
      video.classList.remove('d-none');
      await video.play();
      const scan = async () => {
        if (!video.srcObject) return;
        const codes = await detector.detect(video);
        if (codes.length) {
          const tokenInput = document.querySelector(`[data-complete-token="${id}"]`);
          tokenInput.value = codes[0].rawValue;
          stream.getTracks().forEach((track) => track.stop());
          video.srcObject = null;
          video.classList.add('d-none');
          featureMessage('QR scanned. Confirm the handover to complete the order.');
          return;
        }
        window.setTimeout(scan, 300);
      };
      scan().catch((error) => featureMessage(error.message, 'danger'));
    } catch (error) {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      featureMessage(`Could not start QR scanner: ${error.message}`, 'danger');
    }
  });
});

document.querySelectorAll('[data-cancel-order]').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      await featureRequest(`/api/v1/features/orders/${button.dataset.cancelOrder}/cancel`, { method: 'POST', body: '{}' });
      window.location.reload();
    } catch (error) {
      featureMessage(error.message, 'danger');
    }
  });
});

document.querySelectorAll('[data-schedule-pickup]').forEach((button) => {
  button.addEventListener('click', async () => {
    const id = button.dataset.schedulePickup;
    const pickupAt = document.querySelector(`[data-pickup-time="${id}"]`).value;
    try {
      await featureRequest(`/api/v1/features/orders/${id}/pickup`, {
        method: 'PATCH',
        body: JSON.stringify({ pickupAt }),
      });
      featureMessage('Pickup time saved.');
    } catch (error) {
      featureMessage(error.message, 'danger');
    }
  });
});

document.querySelectorAll('[data-review-order]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    try {
      await featureRequest('/api/v1/features/reviews', {
        method: 'POST',
        body: JSON.stringify({ ...values, orderId: form.dataset.reviewOrder }),
      });
      featureMessage('Review submitted.');
      form.remove();
    } catch (error) {
      featureMessage(error.message, 'danger');
    }
  });
});

document.querySelectorAll('[data-unblock]').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      await featureRequest(`/api/v1/features/blocks/${button.dataset.unblock}`, { method: 'DELETE' });
      window.location.reload();
    } catch (error) {
      featureMessage(error.message, 'danger');
    }
  });
});
