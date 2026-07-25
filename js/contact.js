(function () {
  'use strict';

  var API_URL = 'https://uhs-backen.onrender.com';
  var form = document.getElementById('contact-form');
  if (!form) return;

  var errEl = document.getElementById('contact-api-error');
  var succEl = document.getElementById('contact-api-success');
  var btn = document.getElementById('c-submit-btn');

  function isValidEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (errEl) errEl.style.display = 'none';
    if (succEl) succEl.style.display = 'none';

    var payload = {
      name: document.getElementById('c-name').value.trim(),
      phone: document.getElementById('c-phone').value.trim(),
      email: document.getElementById('c-email').value.trim(),
      subject: (document.getElementById('c-subject')?.value || '').trim() || 'Contact Form Inquiry',
      message: document.getElementById('c-message').value.trim(),
    };

    if (!payload.name || !payload.email || !payload.message) {
      if (errEl) {
        errEl.textContent = 'Please fill in all required fields.';
        errEl.style.display = 'block';
      }
      return;
    }

    if (!isValidEmail(payload.email)) {
      if (errEl) {
        errEl.textContent = 'Please enter a valid email address.';
        errEl.style.display = 'block';
      }
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending...';
    }

    try {
      var res = await fetch(API_URL + '/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      var data = await res.json();
      if (res.ok && data.success) {
        form.style.display = 'none';
        if (succEl) succEl.style.display = 'block';
      } else {
        if (errEl) {
          errEl.textContent = data.message || 'Error sending message. Please call (803) 381-7489.';
          errEl.style.display = 'block';
        }
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Send Message';
        }
      }
    } catch (_) {
      if (errEl) {
        errEl.textContent = 'Network error. Please call (803) 381-7489.';
        errEl.style.display = 'block';
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Send Message';
      }
    }
  });
})();
