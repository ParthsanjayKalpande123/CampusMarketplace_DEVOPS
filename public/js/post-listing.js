/**
 * public/js/post-listing.js
 *
 * Post / Edit listing form submission.
 * Reads formMode ('create' | 'edit') and productId from hidden inputs
 * to decide which API endpoint to call.
 */

'use strict';

const listingForm = document.getElementById('listingForm');
if (!listingForm) throw new Error('listingForm not found');

const formMode  = document.getElementById('formMode').value;   // 'create' | 'edit'
const productId = document.getElementById('productId').value;  // '' when creating
const submitBtn = document.getElementById('submitBtn');

async function runListingAI(endpoint, makeBody, onSuccess) {
  const result = document.getElementById('aiListingResult');
  result.textContent = 'Checking...';
  try {
    const response = await fetch(`/api/v1/features/ai/${endpoint}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody()),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error && data.error.message || 'AI request failed.');
    onSuccess(data.data);
  } catch (error) {
    result.textContent = error.message;
  }
}

document.getElementById('loadListingExampleBtn')?.addEventListener('click', () => {
  document.getElementById('title').value = 'Lenovo ThinkPad laptop';
  document.getElementById('description').value = 'Two-year-old Lenovo ThinkPad in good working condition. 8 GB RAM and 512 GB SSD. Includes charger; available for campus pickup.';
  document.getElementById('price').value = '22000';
  document.getElementById('condition').value = 'good';
  document.getElementById('location').value = 'Campus main gate';
  document.getElementById('detail-brand').value = 'Lenovo';
  document.getElementById('detail-model').value = 'ThinkPad';
  document.getElementById('detail-ram').value = '8 GB';
  document.getElementById('detail-storage').value = '512 GB SSD';
  document.getElementById('tags').value = 'laptop, lenovo, demo';
  const category = [...document.getElementById('category').options]
    .find((option) => option.text.trim().toLowerCase() === 'electronics');
  if (category) document.getElementById('category').value = category.value;
  document.getElementById('aiListingResult').textContent = 'Example details loaded. Try generating a listing, suggesting a price, or checking quality.';
});

document.getElementById('generateListingBtn')?.addEventListener('click', () => {
  const facts = [document.getElementById('title').value, document.getElementById('description').value].filter(Boolean).join('\n');
  runListingAI('listing', () => ({ description: facts }), ({ listing }) => {
    document.getElementById('title').value = listing.title || '';
    document.getElementById('description').value = listing.description || '';
    document.getElementById('tags').value = (listing.tags || []).join(', ');
    if (listing.suggestedCategory) {
      const match = [...document.getElementById('category').options]
        .find((option) => option.text.trim().toLowerCase() === String(listing.suggestedCategory).trim().toLowerCase());
      if (match) document.getElementById('category').value = match.value;
    }
    document.getElementById('aiListingResult').textContent = `Suggested category: ${listing.suggestedCategory || 'none'}; tags: ${(listing.tags || []).join(', ')}`;
  });
});

document.getElementById('suggestPriceBtn')?.addEventListener('click', () => {
  runListingAI('price', () => ({
    title: document.getElementById('title').value,
    description: document.getElementById('description').value,
    condition: document.getElementById('condition').value,
    details: Object.fromEntries(['brand', 'model', 'ram', 'storage', 'warranty', 'author', 'edition', 'subject', 'semester', 'dimensions', 'material']
      .map((field) => [field, document.getElementById(`detail-${field}`).value])),
  }), ({ recommendation }) => {
    document.getElementById('aiListingResult').textContent = `Suggested range: ₹${recommendation.lowPrice}–₹${recommendation.highPrice}. ${recommendation.rationale || ''}`;
  });
});

document.getElementById('checkListingBtn')?.addEventListener('click', () => {
  runListingAI('quality', () => ({
    listing: {
      title: document.getElementById('title').value,
      description: document.getElementById('description').value,
      price: document.getElementById('price').value,
      location: document.getElementById('location').value,
      imageUrl: document.getElementById('imageUrl').value,
    },
  }), ({ assessment }) => {
    document.getElementById('aiListingResult').textContent = `Quality ${assessment.score}/100. Suggestions: ${(assessment.improvements || []).join('; ')}. Risk flags: ${(assessment.riskFlags || []).join('; ') || 'none'}.`;
  });
});

listingForm.addEventListener('submit', async function (e) {
  e.preventDefault();
  window.CampusMarket.hideAlert('formAlert');

  const title         = document.getElementById('title').value.trim();
  const description   = document.getElementById('description').value.trim();
  const category      = document.getElementById('category').value;
  const condition     = document.getElementById('condition').value;
  const price         = parseFloat(document.getElementById('price').value);
  const location      = document.getElementById('location').value.trim();
  const imageUrl      = document.getElementById('imageUrl').value.trim();
  const isExchangeable = document.getElementById('isExchangeable').checked;
  const listingType = document.getElementById('listingType').value;
  const pickupLocation = document.getElementById('pickupLocation').value.trim();
  const pickupAvailability = document.getElementById('pickupAvailability').value.trim();
  const lostFoundDate = document.getElementById('lostFoundDate').value;
  const detailFields = ['brand', 'model', 'ram', 'storage', 'warranty', 'author', 'edition', 'subject', 'semester', 'dimensions', 'material'];
  const details = Object.fromEntries(detailFields
    .map((field) => [field, document.getElementById(`detail-${field}`).value.trim()])
    .filter(([, value]) => value));
  const tags = document.getElementById('tags').value.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 10);

  // Basic client-side validation
  if (!title || !description || !category || !condition || isNaN(price)) {
    window.CampusMarket.showAlert('formAlert', 'Please fill in all required fields.');
    return;
  }

  submitBtn.disabled    = true;
  submitBtn.textContent = formMode === 'edit' ? 'Saving...' : 'Posting...';

  const body = { title, description, category, condition, price: listingType === 'free' ? 0 : price, isExchangeable, listingType, details, tags, pickupLocation, pickupAvailability };
  if (lostFoundDate) body.lostFoundDate = new Date(`${lostFoundDate}T00:00:00`).toISOString();
  if (location)  body.location = location;
  if (imageUrl)  body.imageUrl = imageUrl;

  const url    = formMode === 'edit' ? `/api/v1/products/${productId}` : '/api/v1/products';
  const method = formMode === 'edit' ? 'PUT' : 'POST';

  try {
    const res  = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(body),
    });

    const data = await res.json();

    if (res.ok) {
      const createdId = formMode === 'edit' ? productId : data.data.product._id;
      window.location.href = `/listings/${createdId}`;
    } else {
      let msg = 'Failed to save listing. Please try again.';
      if (data.error) {
        if (data.error.fields && data.error.fields.length > 0) {
          msg = data.error.fields.map(f => f.message).join(' ');
        } else if (data.error.message) {
          msg = data.error.message;
        }
      }
      window.CampusMarket.showAlert('formAlert', msg);
      submitBtn.disabled    = false;
      submitBtn.textContent = formMode === 'edit' ? 'Save Changes' : 'Post Listing';
    }
  } catch {
    window.CampusMarket.showAlert('formAlert', 'Network error. Please check your connection and try again.');
    submitBtn.disabled    = false;
    submitBtn.textContent = formMode === 'edit' ? 'Save Changes' : 'Post Listing';
  }
});
