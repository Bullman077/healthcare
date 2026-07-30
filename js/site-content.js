/**
 * site-content.js
 * Shared dynamic content loader for all public pages.
 * Fetches /api/site-content and applies values to elements with data-content attributes.
 *
 * Usage in HTML:
 *   <span data-content="clinic_phone"></span>         → replaces textContent
 *   <div data-content-html="privacy_policy"></div>     → replaces innerHTML
 *   <a data-content-href="clinic_phone_href">...</a>  → replaces href
 */
(function () {
  'use strict';

  let cache = null;

  /* Sanitize HTML: strip dangerous tags/attributes while keeping safe formatting */
  function sanitizeHtml(html) {
    if (!html) {
      return '';
    }
    return String(html)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^>]*>/gi, '')
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
      .replace(/on\w+\s*=/gi, 'data-xss-blocked=')
      .replace(/javascript:/gi, 'data-xss-blocked:')
      .replace(/vbscript:/gi, 'data-xss-blocked:')
      .replace(/data:text\/html/gi, 'data-xss-blocked');
  }

  function applyContent(data) {
    if (!data) {
      return;
    }

    /* --- textContent replacements --- */
    document.querySelectorAll('[data-content]').forEach(function (el) {
      const key = el.getAttribute('data-content');
      if (data[key]) {
        el.textContent = data[key];
      }
    });

    /* --- innerHTML replacements (sanitized) --- */
    document.querySelectorAll('[data-content-html]').forEach(function (el) {
      const key = el.getAttribute('data-content-html');
      if (data[key]) {
        el.innerHTML = sanitizeHtml(data[key]);
      }
    });

    /* --- href replacements (phone links) --- */
    document.querySelectorAll('[data-content-href]').forEach(function (el) {
      const key = el.getAttribute('data-content-href');
      if (data[key]) {
        el.href = data[key];
      }
    });

    /* --- Privacy page: inject full policy content (sanitized) --- */
    const privacyArticle = document.getElementById('privacy-article-body');
    if (privacyArticle && data.privacy_policy) {
      privacyArticle.innerHTML = sanitizeHtml(data.privacy_policy);
    }

    /* --- Terms page: inject full terms content (sanitized) --- */
    const termsArticle = document.getElementById('terms-article-body');
    if (termsArticle && data.terms_of_service) {
      termsArticle.innerHTML = sanitizeHtml(data.terms_of_service);
    }

    /* --- Footer: dynamic contact block (all pages, sanitized) --- */
    const footerAddress = document.getElementById('footer-clinic-address');
    if (footerAddress && data.clinic_address) {
      footerAddress.innerHTML = sanitizeHtml(data.clinic_address.replace(/\n/g, '<br>'));
    }

    const footerPhone = document.getElementById('footer-clinic-phone');
    if (footerPhone && data.clinic_phone) {
      footerPhone.textContent = data.clinic_phone;
      const phoneLink = footerPhone.closest('a') || footerPhone.querySelector('a');
      if (phoneLink) {
        phoneLink.href = 'tel:+1' + data.clinic_phone.replace(/[^\d]/g, '');
      }
    }

    const footerEmail = document.getElementById('footer-clinic-email');
    if (footerEmail && data.clinic_email) {
      footerEmail.textContent = data.clinic_email;
      const emailLink = footerEmail.closest('a') || footerEmail.querySelector('a');
      if (emailLink) {
        emailLink.href = 'mailto:' + data.clinic_email;
      }
    }

    /* --- Nav call pill --- */
    const navPills = document.querySelectorAll('.nav__call-pill');
    navPills.forEach(function (pill) {
      if (data.clinic_phone) {
        pill.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> ' + data.clinic_phone;
        if (pill instanceof HTMLAnchorElement) {
          pill.href = 'tel:+1' + data.clinic_phone.replace(/[^\d]/g, '');
        } else {
          // if not an anchor, try to find a nested <a>
          const nested = pill.querySelector('a');
          if (nested) {
            nested.href = 'tel:+1' + data.clinic_phone.replace(/[^\d]/g, '');
          }
        }
      }
    });

    /* --- Provider photo: set img src on about page --- */
    const providerImgs = document.querySelectorAll('[data-content-src="provider_photo_url"]');
    providerImgs.forEach(function (img) {
      if (data.provider_photo_url) {
        let src = data.provider_photo_url;
        if (src.indexOf('/') === 0 && src.indexOf('//') !== 0) {
          src = API_URL + src;
        }
        img.src = src;
      }
    });

    /* --- Contact page: hours block (sanitized) --- */
    const hoursBlock = document.getElementById('contact-clinic-hours');
    if (hoursBlock && data.clinic_hours) {
      hoursBlock.innerHTML = sanitizeHtml(data.clinic_hours.replace(/\n/g, '<br>'));
    }

    /* --- Contact page: address block (sanitized) --- */
    const contactAddress = document.getElementById('contact-clinic-address');
    if (contactAddress && data.clinic_address) {
      contactAddress.innerHTML = sanitizeHtml(data.clinic_address.replace(/\n/g, '<br>'));
    }
  }

  const API_URL = (typeof window !== 'undefined' && (window.UHS_API_URL || window.API_URL)) ? (window.UHS_API_URL || window.API_URL) : 'https://uhs-backen.onrender.com';

  function loadSiteContent() {
    if (cache) {
      applyContent(cache);
      return;
    }
    fetch(API_URL + '/api/site-content')
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (json && json.success && json.data) {
          cache = json.data;
          applyContent(cache);
        }
      })
      .catch(function () {
        // optionally log or silently ignore
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSiteContent);
  } else {
    loadSiteContent();
  }
})();