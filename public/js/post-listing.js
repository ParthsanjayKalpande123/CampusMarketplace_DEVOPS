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

  // Basic client-side validation
  if (!title || !description || !category || !condition || isNaN(price)) {
    window.CampusMarket.showAlert('formAlert', 'Please fill in all required fields.');
    return;
  }

  submitBtn.disabled    = true;
  submitBtn.textContent = formMode === 'edit' ? 'Saving...' : 'Posting...';

  const body = { title, description, category, condition, price, isExchangeable };
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
