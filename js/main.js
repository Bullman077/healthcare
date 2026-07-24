(function () {
  'use strict';

  function esc(str) {
    if (str == null) return '';
    return String(str).replace(/[<>&"']/g, function(c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;' }[c];
    });
  }

  // 1. Preloader Hide
  window.addEventListener('load', function () {
    const preloader = document.querySelector('.preloader');
    if (preloader) {
      preloader.classList.add('hidden');
      setTimeout(() => preloader.style.display = 'none', 400);
    }
  });

  // 2. Sticky Glass Navbar & Mobile Toggle
  const nav = document.querySelector('.nav');
  const navToggle = document.querySelector('.nav__toggle');
  const navList = document.querySelector('.nav__right');

  window.addEventListener('scroll', function () {
    if (window.scrollY > 40) {
      nav?.classList.add('scrolled');
    } else {
      nav?.classList.remove('scrolled');
    }
  });

  if (navToggle && navList) {
    navToggle.addEventListener('click', function () {
      navList.classList.toggle('open');
      navToggle.classList.toggle('active');
    });
  }

  // FIX: Mobile nav auto-close on any nav link click
  if (navList) {
    navList.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navList.classList.remove('open');
        navToggle?.classList.remove('active');
      });
    });
  }

  // 3. Scroll Entrance Animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animated');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.animate').forEach(el => observer.observe(el));

  // 4. Membership Billing Toggle (Monthly / Annual)
  const billingBtns = document.querySelectorAll('.pricing-toggle__btn');
  const priceElements = document.querySelectorAll('[data-monthly-price]');

  billingBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      billingBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      const isAnnual = this.getAttribute('data-billing') === 'annual';
      priceElements.forEach(el => {
        const monthly = parseFloat(el.getAttribute('data-monthly-price'));
        if (isAnnual) {
          const annualMonthly = Math.round(monthly * 0.85); // 15% discount
          el.textContent = '$' + annualMonthly;
        } else {
          el.textContent = '$' + monthly;
        }
      });
    });
  });

  // 5. Interactive Service Explorer Tabs
  const serviceTabs = document.querySelectorAll('.service-tab-btn');
  const serviceCards = document.querySelectorAll('.service-display-card');

  serviceTabs.forEach(tab => {
    tab.addEventListener('click', function () {
      serviceTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');

      const targetId = this.getAttribute('data-tab');
      serviceCards.forEach(card => {
        if (card.id === targetId) {
          card.style.display = 'grid';
          card.classList.add('animated');
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // 6. Care Need / Symptom Selector Widget
  const careOptions = document.querySelectorAll('.care-option');
  const careResultBox = document.getElementById('care-result-box');

  const careMap = {
    'physicals': {
      title: 'DOT / Non-DOT, Work & Sports Physicals',
      desc: 'Stay compliant and road ready. We provide thorough DOT and Non-DOT physicals, work physicals, and sports physicals with fast turnaround results.',
      btnText: 'Book Physical Exam',
    },
    'weight': {
      title: 'Weight Loss Healthy Plans',
      desc: 'Sustainable plans designed for real results. Reach a healthy BMI with personalized nutrition, exercise guidance, lifestyle coaching, and GLP-1 support.',
      btnText: 'Start Weight Loss Plan',
    },
    'cpr': {
      title: 'BLS CPR Training',
      desc: 'American Heart Association BLS CPR training for healthcare providers and the community. Engaging, hands-on, and trusted certification.',
      btnText: 'Inquire CPR Class',
    },
    'tb': {
      title: 'TB Skin Testing',
      desc: 'Accurate TB skin testing for employment, school, or healthcare requirements with fast results.',
      btnText: 'Schedule TB Test',
    },
    'patch': {
      title: 'Iontophoresis Patch & Chronic Pain Relief',
      desc: 'Non-invasive transdermal drug delivery using gentle electrical current. Reduces pain and swelling to improve mobility without oral drugs.',
      btnText: 'Schedule Pain Consultation',
    },
    'telehealth': {
      title: 'Telehealth Visit',
      desc: 'Connect remotely for consultations, treatment plans, and prescription refills from home.',
      btnText: 'Access Telehealth Visit',
    }
  };

  careOptions.forEach(opt => {
    opt.addEventListener('click', function () {
      careOptions.forEach(o => o.classList.remove('selected'));
      this.classList.add('selected');

      const key = this.getAttribute('data-care-key');
      const data = careMap[key];
      if (data && careResultBox) {
        careResultBox.innerHTML = `
          <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); padding: 1.5rem 2rem; border-radius: 16px; margin-top: 1.5rem; text-align: center; border: 1px solid rgba(255,255,255,0.25);">
            <h4 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; color: #fff;">${data.title}</h4>
            <p style="font-size: 0.95rem; margin-bottom: 1.25rem; color: rgba(255,255,255,0.9);">${data.desc}</p>
            <button class="btn btn--accent btn--sm" data-open-modal>${data.btnText}</button>
          </div>
        `;
        initModalTriggers();
      }
    });
  });

  // 7. FAQ Accordion & Search Filter
  const faqButtons = document.querySelectorAll('.faq-button');
  const faqSearchInput = document.getElementById('faq-search');

  faqButtons.forEach(btn => {
    btn.addEventListener('click', function () {
      const item = this.closest('.faq-item');
      const isActive = item.classList.contains('active');

      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
      if (!isActive) item.classList.add('active');
    });
  });

  if (faqSearchInput) {
    faqSearchInput.addEventListener('input', function () {
      const term = this.value.toLowerCase().trim();
      document.querySelectorAll('.faq-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(term) ? 'block' : 'none';
      });
    });
  }

  // =========================================================
  // 8. BOOKING MODAL — FULLY WIRED TO POST /api/appointments
  // =========================================================
  const API_BASE = '/api/appointments';
  let availableServices = [];

  async function loadServices() {
    try {
      const res = await fetch('/api/services');
      const data = await res.json();
      if (data.success && data.services && data.services.length) {
        availableServices = data.services;
        return;
      }
    } catch (e) { /* fallback below */ }
    availableServices = [
      { name: 'DOT Physical' }, { name: 'Non-DOT Physical' },
      { name: 'Sports Physical' }, { name: 'Work Physical' },
      { name: 'BLS CPR Training' }, { name: 'TB Skin Testing' },
      { name: 'Weight Management' }, { name: 'Iontophoresis Patch Therapy' },
      { name: 'Chronic Pain Relief' }, { name: 'Telehealth Visit' },
      { name: 'Preventive Wellness' }
    ];
  }

  function buildModalForm(preselectedService) {
    const serviceOptions = availableServices
      .map(s => `<option value="${s.name}"${s.name === preselectedService ? ' selected' : ''}>${s.name}</option>`)
      .join('');

    const timeSlots = [
      '8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM',
      '1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM'
    ].map(t => `<option value="${t}">${t}</option>`).join('');

    var loggedIn = window.currentPatient;
    var badgeText = loggedIn
      ? 'Welcome back, ' + loggedIn.firstName + ' \u2014 Booking as ' + loggedIn.firstName + ' ' + loggedIn.lastName
      : 'Free Appointment \u2014 No Account Required';
    return `
      <div style="text-align:center; margin-bottom:1.5rem;">
        <span class="badge badge--indigo" style="margin-bottom:0.5rem;">${badgeText}</span>
        <h3 style="font-size:1.75rem; font-weight:800; color:var(--color-navy);">Book Your Appointment</h3>
        <p style="font-size:0.9rem; color:var(--color-slate-500);">Select your service and preferred time below.</p>
      </div>
      <div id="booking-api-error" style="display:none; background:#fef2f2; border:1px solid #fca5a5; color:#991b1b; padding:12px 16px; border-radius:10px; font-size:13px; margin-bottom:14px;"></div>
      <form id="booking-api-form" novalidate autocomplete="on">
        <div style="margin-bottom:1rem;">
          <label style="display:block; font-weight:600; font-size:0.88rem; margin-bottom:0.4rem; color:var(--color-slate-800);">Full Name *</label>
          <input type="text" id="b-name" autocomplete="name" required placeholder="Jane Doe" style="width:100%;padding:0.75rem 1rem;border-radius:10px;border:1.5px solid var(--color-slate-300);font-size:0.95rem;font-family:inherit;transition:border-color .2s;">
          <div id="err-name" style="color:#dc2626;font-size:12px;margin-top:4px;display:none;"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
          <div>
            <label style="display:block;font-weight:600;font-size:0.88rem;margin-bottom:0.4rem;color:var(--color-slate-800);">Phone Number *</label>
            <input type="tel" id="b-phone" autocomplete="tel" required placeholder="(803) 555-0199" style="width:100%;padding:0.75rem 1rem;border-radius:10px;border:1.5px solid var(--color-slate-300);font-size:0.95rem;font-family:inherit;">
            <div id="err-phone" style="color:#dc2626;font-size:12px;margin-top:4px;display:none;"></div>
          </div>
          <div>
            <label style="display:block;font-weight:600;font-size:0.88rem;margin-bottom:0.4rem;color:var(--color-slate-800);">Email Address *</label>
            <input type="email" id="b-email" autocomplete="email" required placeholder="jane@example.com" style="width:100%;padding:0.75rem 1rem;border-radius:10px;border:1.5px solid var(--color-slate-300);font-size:0.95rem;font-family:inherit;">
            <div id="err-email" style="color:#dc2626;font-size:12px;margin-top:4px;display:none;"></div>
          </div>
        </div>
        <div style="margin-bottom:1rem;">
          <label style="display:block;font-weight:600;font-size:0.88rem;margin-bottom:0.4rem;color:var(--color-slate-800);">Service Requested *</label>
          <select id="b-service" required style="width:100%;padding:0.75rem 1rem;border-radius:10px;border:1.5px solid var(--color-slate-300);font-size:0.95rem;background:#fff;font-family:inherit;">
            <option value="">-- Choose a Care Service --</option>
            ${serviceOptions}
          </select>
          <div id="err-service" style="color:#dc2626;font-size:12px;margin-top:4px;display:none;"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
          <div>
            <label style="display:block;font-weight:600;font-size:0.88rem;margin-bottom:0.4rem;color:var(--color-slate-800);">Preferred Date *</label>
            <input type="date" id="b-date" required style="width:100%;padding:0.75rem 1rem;border-radius:10px;border:1.5px solid var(--color-slate-300);font-size:0.95rem;font-family:inherit;">
            <div id="err-date" style="color:#dc2626;font-size:12px;margin-top:4px;display:none;"></div>
          </div>
          <div>
            <label style="display:block;font-weight:600;font-size:0.88rem;margin-bottom:0.4rem;color:var(--color-slate-800);">Preferred Time *</label>
            <select id="b-time" required style="width:100%;padding:0.75rem 1rem;border-radius:10px;border:1.5px solid var(--color-slate-300);font-size:0.95rem;background:#fff;font-family:inherit;">
              <option value="">-- Select Time --</option>
              ${timeSlots}
            </select>
            <div id="err-time" style="color:#dc2626;font-size:12px;margin-top:4px;display:none;"></div>
          </div>
        </div>
        <div style="margin-bottom:1.5rem;">
          <label style="display:block;font-weight:600;font-size:0.88rem;margin-bottom:0.4rem;color:var(--color-slate-800);">Additional Notes <span style="font-weight:400;color:var(--color-slate-500)">(optional)</span></label>
          <textarea id="b-message" rows="3" placeholder="Any health history or questions…" style="width:100%;padding:0.75rem 1rem;border-radius:10px;border:1.5px solid var(--color-slate-300);font-size:0.95rem;font-family:inherit;resize:vertical;"></textarea>
        </div>
        <button type="submit" id="b-submit-btn" class="btn btn--primary" style="width:100%;gap:8px;">
          <span id="b-btn-text">Confirm Appointment Request</span>
          <span id="b-btn-spin" style="display:none;align-items:center;gap:6px;">
            <svg style="animation:uhsSpin .7s linear infinite;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            Submitting…
          </span>
        </button>
        <p style="text-align:center;font-size:0.8rem;color:var(--color-slate-400);margin-top:0.75rem;">${loggedIn ? '' : 'Already have a patient account? <a href="/patient/" style="color:var(--color-teal);font-weight:600;text-decoration:none;">Sign in to your portal \u2192</a>'}</p>
      </form>
      <style>@keyframes uhsSpin{to{transform:rotate(360deg)}}</style>
    `;
  }

  function showBookingSuccess(appt, email) {
    const mc = document.querySelector('.modal-card');
    if (!mc) return;

    // Fetch past appointments for this email silently
    if (email) {
      fetch('/api/appointments/by-email?email=' + encodeURIComponent(email))
        .then(r => r.json())
        .then(function(d) {
          var past = (d.data || []).filter(function(a) { return a.referenceNumber !== appt.referenceNumber; });
          if (past.length) {
            var el = document.getElementById('past-appt-count');
            if (el) el.textContent = 'You have ' + past.length + ' past appointment(s) on record.';
          }
        }).catch(function(){});
    }

    mc.innerHTML = `
      <div style="text-align:center;padding:1rem 0;">
        <div style="width:72px;height:72px;background:linear-gradient(135deg,#10B981,#059669);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;box-shadow:0 8px 24px rgba(16,185,129,.35);">
          <svg width="32" height="32" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h3 style="font-size:1.6rem;font-weight:800;color:var(--color-navy);margin-bottom:.75rem;">Appointment Confirmed!</h3>
        <p style="color:var(--color-slate-600);margin-bottom:1.75rem;line-height:1.6;">
          Thank you, <strong>${esc(appt.patient)}</strong>. Your <strong>${esc(appt.service)}</strong> appointment is booked. A confirmation email has been sent to you.
        </p>
        <div style="background:var(--color-slate-50);border:1.5px solid var(--color-slate-200);border-radius:14px;padding:1.25rem 1.5rem;margin-bottom:1.5rem;text-align:left;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.85rem;">
            <div>
              <div style="font-size:10px;font-weight:700;color:var(--color-slate-500);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">Reference #</div>
              <div style="font-size:1rem;font-weight:800;color:var(--color-indigo);font-family:monospace;">${esc(appt.referenceNumber)}</div>
            </div>
            <div>
              <div style="font-size:10px;font-weight:700;color:var(--color-slate-500);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">Date & Time</div>
              <div style="font-size:.9rem;font-weight:600;color:var(--color-slate-800);">${new Date(appt.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} · ${appt.time}</div>
            </div>
            <div>
              <div style="font-size:10px;font-weight:700;color:var(--color-slate-500);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">Service</div>
              <div style="font-size:.9rem;font-weight:600;color:var(--color-slate-800);">${esc(appt.service)}</div>
            </div>
            <div>
              <div style="font-size:10px;font-weight:700;color:var(--color-slate-500);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">Status</div>
              <div style="font-size:.9rem;font-weight:700;color:#065F46;">✓ Confirmed</div>
            </div>
          </div>
        </div>
        <p id="past-appt-count" style="font-size:0.82rem;color:var(--color-slate-500);margin-bottom:1rem;"></p>
        ${window.currentPatient
          ? '<div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:12px;padding:1rem 1.25rem;margin-bottom:1.5rem;text-align:left;"><p style="font-size:0.85rem;color:#3730A3;margin:0;font-weight:600;">View all your appointments & progress</p><a href="/patient/" style="display:inline-block;padding:7px 16px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:12px;">Go to My Dashboard \u2192</a></div>'
          : '<div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:12px;padding:1rem 1.25rem;margin-bottom:1.5rem;text-align:left;"><p style="font-size:0.85rem;color:#3730A3;margin:0;font-weight:600;">Want to track your progress & appointments?</p><p style="font-size:0.82rem;color:#4338CA;margin:4px 0 10px;">Set up your free Patient Portal account to view doctor notes, reminders, and your full appointment history.</p><a href="/patient/" style="display:inline-block;padding:7px 16px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:12px;">Set Up My Patient Account \u2192</a></div>'
        }
        <button class="btn btn--dark-outline btn--sm" onclick="document.getElementById('booking-modal').classList.remove('active')">Close</button>
      </div>
    `;
  }

  async function handleBookingSubmit(e) {
    e.preventDefault();

    // Clear errors
    ['err-name','err-phone','err-email','err-service','err-date','err-time'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const errBanner = document.getElementById('booking-api-error');
    if (errBanner) errBanner.style.display = 'none';

    const val = id => document.getElementById(id)?.value?.trim() || '';
    const name    = val('b-name');
    const phone   = val('b-phone');
    const email   = val('b-email');
    const service = val('b-service');
    const date    = val('b-date');
    const time    = val('b-time');
    const message = val('b-message');

    // Client validation
    let ok = true;
    const fieldErr = (id, msg) => {
      const el = document.getElementById(id);
      if (el) { el.textContent = msg; el.style.display = 'block'; }
      ok = false;
    };

    if (name.length < 2)  fieldErr('err-name',    'Please enter your full name (min 2 characters).');
    if (!phone)           fieldErr('err-phone',   'Phone number is required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErr('err-email', 'Please enter a valid email address.');
    if (!service)         fieldErr('err-service', 'Please select a service.');
    if (!date) {
      fieldErr('err-date', 'Please select a date.');
    } else {
      const d = new Date(date), now = new Date(); now.setHours(0,0,0,0);
      if (d <= now)     fieldErr('err-date', 'Date must be in the future.');
      if (d.getDay() === 0) fieldErr('err-date', 'We are closed on Sundays.');
    }
    if (!time)            fieldErr('err-time',    'Please select a time slot.');
    if (!ok) return;

    // Set loading state
    const btn     = document.getElementById('b-submit-btn');
    const btnTxt  = document.getElementById('b-btn-text');
    const btnSpin = document.getElementById('b-btn-spin');
    if (btn)     btn.disabled = true;
    if (btnTxt)  btnTxt.style.display = 'none';
    if (btnSpin) { btnSpin.style.display = 'inline-flex'; }

    try {
      // Book appointment directly — no account required
      const res  = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, phone, email, service, date, time, message }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showBookingSuccess(data.data, email);
      } else {
        if (errBanner) {
          errBanner.textContent = data.message || 'Something went wrong. Please call (803) 381-7489.';
          errBanner.style.display = 'block';
        }
        if (btn)     btn.disabled = false;
        if (btnTxt)  btnTxt.style.display = 'inline';
        if (btnSpin) btnSpin.style.display = 'none';
      }
    } catch {
      if (errBanner) {
        errBanner.textContent = 'Network error. Please call us at (803) 381-7489.';
        errBanner.style.display = 'block';
      }
      if (btn)     btn.disabled = false;
      if (btnTxt)  btnTxt.style.display = 'inline';
      if (btnSpin) btnSpin.style.display = 'none';
    }
  }

  function initModalTriggers() {
    const overlay   = document.getElementById('booking-modal');
    const modalCard = document.querySelector('.modal-card');
    if (!overlay || !modalCard) return;

    document.querySelectorAll('[data-open-modal]').forEach(trigger => {
      // Prevent duplicate listeners
      trigger.removeEventListener('click', trigger._modalHandler);
      trigger._modalHandler = function (e) {
        e.preventDefault();
        const svc = trigger.dataset.service || '';
        modalCard.innerHTML = buildModalForm(svc);

        const di = document.getElementById('b-date');
        if (di) {
          const tm = new Date(); tm.setDate(tm.getDate() + 1);
          di.min = tm.toISOString().split('T')[0];
        }

        prefillPatientFields();

        document.getElementById('booking-api-form')
          ?.addEventListener('submit', handleBookingSubmit);

        overlay.classList.add('active');
        navList?.classList.remove('open');
        navToggle?.classList.remove('active');
      };
      trigger.addEventListener('click', trigger._modalHandler);
    });

    // Close on X or backdrop click
    overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('active'); };
    overlay.querySelector?.('.modal-close-btn')?.addEventListener('click', () => overlay.classList.remove('active'));
  }

  // =========================================================
  // 9. PATIENT AUTH — detect portal session on every page
  // =========================================================
  window.currentPatient = null;

  var patientAuthChecked = false;
  function initPatientAuth() {
    if (patientAuthChecked) return Promise.resolve();
    patientAuthChecked = true;
    return fetch('/api/patient/session', { credentials: 'include' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.success && data.patient) {
          window.currentPatient = data.patient;
          updateNavForPatient(data.patient);
        }
      })
      .catch(function(){});
  }

  function revertNav() {
    var link = document.getElementById('patient-portal-link');
    var span = document.getElementById('patient-nav');
    if (!link || !span) return;
    link.style.display = '';
    span.style.display = 'none';
    span.innerHTML = '';
    window.currentPatient = null;
  }

  function updateNavForPatient(patient) {
    var link = document.getElementById('patient-portal-link');
    var span = document.getElementById('patient-nav');
    if (!link || !span) return;
    link.style.display = 'none';
    span.style.display = 'inline-flex';
    span.style.alignItems = 'center';
    span.style.gap = '8px';
    span.innerHTML =
      '<a href="/patient/" style="color:#fff;font-weight:700;font-size:0.88rem;text-decoration:none;white-space:nowrap;">' +
      patient.firstName + ' \u25BC</a>' +
      '<a href="/api/patient/logout" onclick="event.preventDefault();fetch(this.href,{method:\'POST\',credentials:\'include\'}).then(function(){window.location.reload();}).catch(function(){});" style="color:rgba(255,255,255,0.7);font-size:0.82rem;text-decoration:none;">Logout</a>';
  }

  function prefillPatientFields() {
    var p = window.currentPatient;
    if (!p) return;
    ['b-name','b-phone','b-email'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) { el.readOnly = true; el.style.background = 'var(--color-slate-100)'; }
    });
    var nameEl = document.getElementById('b-name');
    var phoneEl = document.getElementById('b-phone');
    var emailEl = document.getElementById('b-email');
    if (nameEl) nameEl.value = p.firstName + ' ' + p.lastName;
    if (phoneEl) phoneEl.value = p.phone || '';
    if (emailEl) emailEl.value = p.email;
  }

  // Re-check auth (no guard — used for bfcache restore)
  function refreshAuth() {
    fetch('/api/patient/session', { credentials: 'include' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.success && data.patient) {
          window.currentPatient = data.patient;
          updateNavForPatient(data.patient);
        } else if (window.currentPatient) {
          revertNav();
        }
      })
      .catch(function(){});
  }

  // Run on initial load
  initPatientAuth().then(function() {
    return loadServices();
  }).then(function() {
    initModalTriggers();
    refreshAuth(); // re-check auth after everything is set up
  });

  // Re-run auth check on bfcache restore (browser back/forward)
  window.addEventListener('pageshow', function() {
    refreshAuth();
  });

})();
