(function () {
  'use strict';

  var API_ENDPOINT = '/api/messages';

  var form = document.getElementById('contactForm');
  if (!form) return;

  var fields = {
    name: form.querySelector('#contactName'),
    email: form.querySelector('#contactEmail'),
    subject: form.querySelector('#contactSubject'),
    message: form.querySelector('#contactMessage'),
  };

  var submitBtn = document.getElementById('contactSubmitBtn');
  var statusEl = document.getElementById('contactStatus');
  var successEl = document.getElementById('contactSuccess');

  /* ----- Helpers ----- */
  function getErrorEl(input) {
    return document.getElementById(input.id + 'Error');
  }

  function showError(input, message) {
    var err = getErrorEl(input);
    if (err) {
      err.textContent = message;
      err.classList.add('form__error--visible');
    }
    input.classList.add('form__input--error');
  }

  function clearError(input) {
    var err = getErrorEl(input);
    if (err) {
      err.classList.remove('form__error--visible');
    }
    input.classList.remove('form__input--error');
  }

  function clearAllErrors() {
    Object.keys(fields).forEach(function (key) {
      if (fields[key]) clearError(fields[key]);
    });
  }

  function showStatus(message, type) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = 'form__status';
    if (type) {
      statusEl.classList.add('form__status--visible', 'form__status--' + type);
    }
  }

  function hideStatus() {
    if (statusEl) {
      statusEl.className = 'form__status';
    }
  }

  function setLoading(loading) {
    if (!submitBtn) return;
    if (loading) {
      submitBtn.classList.add('btn--loading');
      submitBtn.disabled = true;
    } else {
      submitBtn.classList.remove('btn--loading');
      submitBtn.disabled = false;
    }
  }

  function scrollToFirstError() {
    var firstError = form.querySelector('.form__input--error');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstError.focus({ preventScroll: true });
    }
  }

  /* ----- Validation ----- */
  function isValidEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }

  function validate() {
    var valid = true;
    clearAllErrors();
    hideStatus();

    if (!fields.name.value.trim()) {
      showError(fields.name, 'Please enter your name');
      valid = false;
    }

    if (!fields.email.value.trim()) {
      showError(fields.email, 'Please enter your email');
      valid = false;
    } else if (!isValidEmail(fields.email.value.trim())) {
      showError(fields.email, 'Enter a valid email address');
      valid = false;
    }

    if (!fields.subject.value.trim()) {
      showError(fields.subject, 'Please enter a subject');
      valid = false;
    }

    if (!fields.message.value.trim()) {
      showError(fields.message, 'Please enter your message');
      valid = false;
    } else if (fields.message.value.trim().length < 10) {
      showError(fields.message, 'Message must be at least 10 characters');
      valid = false;
    }

    if (!valid) {
      scrollToFirstError();
    }

    return valid;
  }

  /* ----- Blur: clear single error ----- */
  Object.keys(fields).forEach(function (key) {
    var input = fields[key];
    if (input) {
      input.addEventListener('blur', function () {
        if (input.value.trim()) {
          clearError(input);
        }
      });
    }
  });

  /* ----- Submit ----- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    var payload = {
      name: fields.name.value.trim(),
      email: fields.email.value.trim(),
      subject: fields.subject.value.trim(),
      message: fields.message.value.trim(),
      timestamp: new Date().toISOString(),
    };

    function onSuccess() {
      setLoading(false);
      form.reset();
      clearAllErrors();
      if (successEl) {
        successEl.classList.add('form__success--visible');
        successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    function onError(msg) {
      setLoading(false);
      showStatus(msg || 'Something went wrong. Please try again or call us.', 'error');
    }

    if (API_ENDPOINT) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API_ENDPOINT, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'application/json');

      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          onSuccess();
        } else {
          try {
            var res = JSON.parse(xhr.responseText);
            onError(res.message || 'Server error. Please try again.');
          } catch (_) {
            onError('Server error (' + xhr.status + '). Please try again.');
          }
        }
      };

      xhr.onerror = function () {
        onError('Network error. Please check your connection and try again.');
      };

      xhr.send(JSON.stringify(payload));
    } else {
      // Demo mode
      setTimeout(function () {
        onSuccess();
      }, 1500);
    }
  });
})();
