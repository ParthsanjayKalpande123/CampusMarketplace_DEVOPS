/**
 * public/js/inbox.js
 *
 * Client-side script for the Inbox page chat interface.
 */

'use strict';

(function () {
  const chatForm = document.getElementById('chatForm');
  const chatFeed = document.getElementById('chatFeed');

  // Auto-scroll to the bottom of the message feed on load
  if (chatFeed) {
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  if (chatForm) {
    chatForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const receiverId = document.getElementById('receiverId').value;
      const productId  = document.getElementById('productId').value;
      const textarea   = document.getElementById('messageContent');
      const content    = textarea.value.trim();
      const sendBtn    = document.getElementById('sendBtn');

      if (!content) return;

      sendBtn.disabled = true;

      try {
        const res = await fetch('/api/v1/messages', {
          method:      'POST',
          credentials: 'same-origin',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ receiverId, productId, content }),
        });

        if (res.ok) {
          // Clear text box and reload page to see the new message and update chat history
          textarea.value = '';
          window.location.reload();
        } else {
          const data = await res.json().catch(() => ({}));
          alert(data.error && data.error.message ? data.error.message : 'Failed to send message.');
          sendBtn.disabled = false;
        }
      } catch {
        alert('Network error. Please try again.');
        sendBtn.disabled = false;
      }
    });

    // Submit form on pressing Enter (without Shift)
    const textarea = document.getElementById('messageContent');
    if (textarea) {
      textarea.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          chatForm.requestSubmit();
        }
      });
    }
  }
})();
