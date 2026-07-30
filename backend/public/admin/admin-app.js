(function () {
  'use strict';

  const API = '/api/v1/admin';

  const adminState = {
    admin: null,
    settings: {},
    isLoading: false,
    currentPage: 'dashboard',
    currentSettingsTab: 'home',
    appointments: [],
    patients: [],
    services: [],
    messages: [],
    testimonials: [],
    auditLogs: [],
    pageCache: new Set(),
    profile: null,
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[<>&"']/g, (char) => ({
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#x27;'
    }[char]));
  }

  function showToast(message, type = 'success') {
    const container = document.getElementById('toast');
    if (!container) {return;}
    const toast = document.createElement('div');
    toast.className = 'toast-item ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function showLogin() {
    document.getElementById('loginView')?.classList.remove('hidden');
    document.getElementById('appView')?.classList.add('hidden');
  }

  function showApp() {
    document.getElementById('loginView')?.classList.add('hidden');
    document.getElementById('appView')?.classList.remove('hidden');
    document.body.style.overflow = '';
  }

  function updateTopbar(admin) {
    const name = admin?.name || 'Admin';
    document.getElementById('adminName').textContent = name;
    document.getElementById('adminAvatar').textContent = name.charAt(0).toUpperCase();
    document.getElementById('welcomeGreeting').textContent = 'Welcome back, ' + name;
  }

  function setPage(page) {
    adminState.currentPage = page;
    document.querySelectorAll('[data-page-section]').forEach((section) => {
      section.classList.toggle('active', section.dataset.pageSection === page);
    });
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    const labels = {
      dashboard: 'Clinic operations at a glance',
      appointments: 'Appointment workflow',
      patients: 'Patient records',
      messages: 'Inbox and contact requests',
      testimonials: 'Homepage testimonials',
      services: 'Service catalog',
      'audit-logs': 'Security and change history',
      settings: 'Public website settings',
      profile: 'Admin account details',
    };

    document.getElementById('pageTitle').textContent = page === 'audit-logs' ? 'Audit Logs' : page.charAt(0).toUpperCase() + page.slice(1);
    document.getElementById('topbarSubTitle').textContent = labels[page] || '';

    loadPageData(page);
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }
    return { response, data };
  }

  function renderLoading(container, text = 'Loading...') {
    container.innerHTML = `<div class="empty-state">${escapeHtml(text)}</div>`;
  }

  function renderEmpty(container, text = 'No data found.') {
    container.innerHTML = `<div class="empty-state">${escapeHtml(text)}</div>`;
  }

  function normalizeStatus(status) {
    return String(status || 'pending').toLowerCase().replace(/\s+/g, '-');
  }

  function getAvatarText(name) {
    const parts = String(name || '').trim().split(/\s+/);
    if (!parts[0]) {return 'U';}
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  const SETTINGS_TABS = [
    {
      id: 'home',
      title: 'Home',
      description: 'Homepage hero, provider, and brand copy.',
      icon: 'home',
      fields: [
        { key: 'clinic_name', label: 'Clinic Name', type: 'text' },
        { key: 'clinic_phone', label: 'Clinic Phone', type: 'text' },
        { key: 'clinic_email', label: 'Clinic Email', type: 'email' },
        { key: 'clinic_address', label: 'Clinic Address', type: 'textarea', wide: true },
        { key: 'clinic_tagline', label: 'Clinic Tagline', type: 'text' },
        { key: 'footer_brand_desc', label: 'Footer Brand Description', type: 'textarea', wide: true },
        { key: 'provider_name', label: 'Provider Name', type: 'text' },
        { key: 'provider_credentials', label: 'Provider Credentials', type: 'text' },
        {
          key: 'provider_photo_url',
          label: 'Provider Photo URL',
          type: 'text',
          wide: true,
          hint: 'This same image appears on the public About page and the profile header.',
        },
        { key: 'homepage_provider_quote', label: 'Provider Quote', type: 'textarea', wide: true },
        { key: 'hero_floating_name', label: 'Hero Floating Name', type: 'text' },
        { key: 'hero_floating_title', label: 'Hero Floating Title', type: 'text' },
      ],
    },
    {
      id: 'telehealth',
      title: 'Telehealth',
      description: 'Virtual care page copy and treatment details.',
      icon: 'telehealth',
      fields: [
        { key: 'telehealth_hero_badge', label: 'Hero Badge', type: 'text' },
        { key: 'telehealth_hero_title', label: 'Hero Title', type: 'textarea', wide: true },
        { key: 'telehealth_hero_text', label: 'Hero Text', type: 'textarea', wide: true },
        { key: 'telehealth_steps_subtitle', label: 'Steps Subtitle', type: 'text' },
        { key: 'telehealth_steps_title', label: 'Steps Title', type: 'text' },
        { key: 'telehealth_steps_desc', label: 'Steps Description', type: 'textarea', wide: true },
        { key: 'telehealth_step1_title', label: 'Step 1 Title', type: 'text' },
        { key: 'telehealth_step1_desc', label: 'Step 1 Description', type: 'textarea', wide: true },
        { key: 'telehealth_step2_title', label: 'Step 2 Title', type: 'text' },
        { key: 'telehealth_step2_desc', label: 'Step 2 Description', type: 'textarea', wide: true },
        { key: 'telehealth_step3_title', label: 'Step 3 Title', type: 'text' },
        { key: 'telehealth_step3_desc', label: 'Step 3 Description', type: 'textarea', wide: true },
        { key: 'telehealth_conditions_subtitle', label: 'Conditions Subtitle', type: 'text' },
        { key: 'telehealth_conditions_title', label: 'Conditions Title', type: 'text' },
        { key: 'telehealth_conditions_desc', label: 'Conditions Description', type: 'textarea', wide: true },
      ],
    },
    {
      id: 'contact',
      title: 'Contact',
      description: 'Contact page callouts and public contact details.',
      icon: 'contact',
      fields: [
        { key: 'contact_badge', label: 'Contact Badge', type: 'text' },
        { key: 'contact_heading', label: 'Contact Heading', type: 'text' },
        { key: 'contact_intro', label: 'Contact Intro', type: 'textarea', wide: true },
        { key: 'clinic_phone', label: 'Clinic Phone', type: 'text' },
        { key: 'clinic_email', label: 'Clinic Email', type: 'email' },
        { key: 'clinic_address', label: 'Clinic Address', type: 'textarea', wide: true },
        { key: 'clinic_hours', label: 'Clinic Hours', type: 'textarea', wide: true },
      ],
    },
  ];

  function getSettingValue(key) {
    return adminState.settings[key] ?? '';
  }

  function getProviderPhotoUrl() {
    return String(adminState.settings.provider_photo_url || adminState.admin?.profilePhoto || '').trim();
  }

  function renderSettingsField(field) {
    const fieldId = `set_${field.key}`;
    const value = escapeHtml(getSettingValue(field.key));
    const fieldClass = field.wide ? 'visual-field settings-field settings-field--wide' : 'visual-field settings-field';
    const control = field.type === 'textarea'
      ? `<textarea id="${fieldId}" rows="${field.rows || 4}">${value}</textarea>`
      : `<input id="${fieldId}" type="${field.type || 'text'}" value="${value}">`;
    return `
      <div class="${fieldClass}">
        <label for="${fieldId}">${escapeHtml(field.label)}</label>
        ${control}
        ${field.hint ? `<div class="field-hint">${escapeHtml(field.hint)}</div>` : ''}
      </div>
    `;
  }

  function activateSettingsTab(tabId) {
    adminState.currentSettingsTab = tabId;
    const panel = document.getElementById('settingsPage');
    if (!panel) {return;}

    panel.querySelectorAll('[data-settings-tab]').forEach((item) => {
      item.classList.toggle('active', item.dataset.settingsTab === tabId);
    });
    panel.querySelectorAll('[data-settings-pane]').forEach((pane) => {
      pane.classList.toggle('active', pane.dataset.settingsPane === tabId);
    });
  }

  function renderSettingsPanel(activeTab = adminState.currentSettingsTab || 'home') {
    const panel = document.getElementById('settingsPage');
    if (!panel) {return;}

    adminState.currentSettingsTab = activeTab;

    panel.innerHTML = `
      <div class="settings-shell__intro">
        <div>
          <div class="settings-kicker">Public site sync</div>
          <h2>Site Settings</h2>
          <p>Manage the content that feeds the Home, Telehealth, and Contact pages.</p>
        </div>
        <div class="settings-hero-note">
          <strong>Shared provider photo</strong>
          <span>The photo below is the same image shown on the public About page and in the admin profile.</span>
        </div>
      </div>
      <form id="settingsForm" class="settings-panel">
        <div class="settings-nav" role="tablist" aria-label="Settings sections">
          ${SETTINGS_TABS.map((tab) => `
            <button type="button" class="settings-nav-item${tab.id === activeTab ? ' active' : ''}" data-settings-tab="${tab.id}" aria-controls="settings-pane-${tab.id}">
              <span>${escapeHtml(tab.title)}</span>
            </button>
          `).join('')}
        </div>
        <div class="settings-divider"></div>
        <div class="settings-body">
          ${SETTINGS_TABS.map((tab) => `
            <section class="settings-section-pane${tab.id === activeTab ? ' active' : ''}" id="settings-pane-${tab.id}" data-settings-pane="${tab.id}">
              <div class="section-editor">
                <div class="section-editor-header">
                  <div class="section-editor-icon ${tab.icon === 'telehealth' ? 'indigo' : tab.icon === 'contact' ? 'teal' : 'navy'}">
                    ${tab.icon === 'telehealth'
                      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v10H7l-3 3V5z"></path></svg>'
                      : tab.icon === 'contact'
                        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16v12H4z"></path><path d="m4 7 8 6 8-6"></path></svg>'
                        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11.5 12 4l9 7.5"></path><path d="M5 10.5V20h14v-9.5"></path></svg>'}
                  </div>
                  <div>
                    <div class="section-editor-title">${escapeHtml(tab.title)}</div>
                    <div class="section-editor-subtitle">${escapeHtml(tab.description)}</div>
                  </div>
                </div>
                <div class="section-editor-body">
                  <div class="visual-fields visual-fields--2col">
                    ${tab.fields.map((field) => renderSettingsField(field)).join('')}
                  </div>
                </div>
              </div>
            </section>
          `).join('')}

          <div class="save-bar">
            <div class="save-bar-msg" id="settingsMsg">Changes are saved to the public website.</div>
            <button class="save-btn" type="submit">Save Settings</button>
          </div>
        </div>
      </form>
    `;

    panel.querySelectorAll('[data-settings-tab]').forEach((button) => {
      button.addEventListener('click', () => activateSettingsTab(button.dataset.settingsTab));
    });

    panel.querySelector('#settingsForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      saveSettings();
    });

    activateSettingsTab(activeTab);
    populateSettingsForm();
  }

  function bridgeSettingsToUI() {
    document.querySelectorAll('[data-content], [data-content-html], [data-content-href]').forEach((el) => {
      const key = el.dataset.content || el.dataset.contentHtml || el.dataset.contentHref || el.id;
      const content = adminState.settings[key];
      if (content === undefined) {return;}
      if (el.dataset.content) {el.textContent = content;}
      if (el.dataset.contentHtml) {el.innerHTML = content;}
      if (el.dataset.contentHref) {el.href = content;}
    });
  }

  function populateSettingsForm() {
    document.querySelectorAll('[id^="set_"]').forEach((el) => {
      const key = el.id.replace('set_', '');
      if (adminState.settings[key] !== undefined) {
        el.value = adminState.settings[key];
      }
    });
  }

  function renderProfilePanel() {
    const panel = document.getElementById('profilePage');
    if (!panel || !adminState.profile) {return;}
    const sharedPhoto = getProviderPhotoUrl();

    panel.innerHTML = `
      <form id="profileForm" class="profile-shell">
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><div class="card-title">Admin Profile</div></div>
          <div style="padding:24px;">
            <div class="profile-header-card" style="margin-bottom:24px;">
              <div class="profile-header-content">
                <div class="profile-photo-wrapper" style="background:var(--slate-100);">
                  ${sharedPhoto ? `<img class="profile-photo-img" src="${escapeHtml(sharedPhoto)}" alt="Clinic profile photo">` : `<div class="profile-avatar-lg">${escapeHtml(getAvatarText(adminState.profile.name))}</div>`}
                  <div class="profile-photo-overlay">Shared photo<br>public About page</div>
                </div>
                <div class="profile-header-info">
                  <h3 class="profile-header-name">${escapeHtml(adminState.profile.name || '')}</h3>
                  <div class="profile-role-badge">${escapeHtml(adminState.profile.role || 'admin')}</div>
                  <div class="profile-photo-sync-note">Changes here update the same image used publicly on the About page.</div>
                </div>
              </div>
            </div>

            <div class="profile-grid">
              <div class="profile-section-card card">
                <div class="card-header"><div class="card-title">Account Details</div></div>
                <div class="card-body" style="padding:24px;">
                  <div class="profile-field">
                    <label class="profile-field-label" for="profileNameInput">Name</label>
                    <input id="profileNameInput" class="form-input profile-field-input" value="${escapeHtml(adminState.profile.name || '')}">
                  </div>
                  <div class="profile-field">
                    <label class="profile-field-label" for="profileEmailInput">Email</label>
                    <input id="profileEmailInput" class="form-input profile-field-input" type="email" value="${escapeHtml(adminState.profile.email || '')}">
                  </div>
                  <div class="profile-field">
                    <label class="profile-field-label" for="profilePhotoInput">Public About Photo</label>
                    <input id="profilePhotoInput" class="form-input profile-field-input" type="file" accept="image/*">
                    <small class="profile-field-note">PNG, JPG, GIF, or WebP under 5 MB.</small>
                  </div>
                </div>
              </div>

              <div class="profile-section-card card">
                <div class="card-header"><div class="card-title">Password Update</div></div>
                <div class="card-body" style="padding:24px;">
                  <div class="profile-field">
                    <label class="profile-field-label" for="profileCurrentPassword">Current Password</label>
                    <input id="profileCurrentPassword" class="form-input profile-field-input" type="password">
                  </div>
                  <div class="profile-field">
                    <label class="profile-field-label" for="profileNewPassword">New Password</label>
                    <input id="profileNewPassword" class="form-input profile-field-input" type="password">
                  </div>
                  <div class="profile-field-actions">
                    <button type="submit" class="btn btn-primary">Save Profile</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    `;

    panel.querySelector('#profileForm').addEventListener('submit', handleProfileSubmit);
    panel.querySelector('#profilePhotoInput')?.addEventListener('change', handleProfilePhotoUpload);
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    const payload = {
      name: document.getElementById('profileNameInput')?.value.trim(),
      email: document.getElementById('profileEmailInput')?.value.trim(),
      currentPassword: document.getElementById('profileCurrentPassword')?.value,
      newPassword: document.getElementById('profileNewPassword')?.value,
    };

    if (!payload.currentPassword && !payload.newPassword) {
      delete payload.currentPassword;
      delete payload.newPassword;
    }
    if (!payload.name) {delete payload.name;}
    if (!payload.email) {delete payload.email;}

    const { response, data } = await requestJson(API + '/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    if (response.ok && data.success) {
      adminState.profile = data.admin || adminState.profile;
      adminState.admin = data.admin || adminState.admin;
      updateTopbar(adminState.admin);
      renderProfilePanel();
      showToast(data.message || 'Profile updated.');
      if (payload.newPassword) {
        showToast('Password updated. You may need to sign in again on other devices.');
      }
      return;
    }

    showToast(data?.message || 'Unable to update profile.', 'danger');
  }

  async function handleProfilePhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {return;}
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const response = await fetch(API + '/profile/photo', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await response.json();
      if (response.ok && data.success) {
        showToast('Profile photo updated.');
        await Promise.all([loadSettings(), loadProfileData()]);
      } else {
        showToast(data?.message || 'Photo upload failed.', 'danger');
      }
    } catch (error) {
      console.error(error);
      showToast('Photo upload failed.', 'danger');
    }
  }

  function bridgeTestimonialsUI() {
    const panel = document.getElementById('testimonialsPage');
    if (!panel || !adminState.testimonials.length) {return;}
  }

  async function loadSettings() {
    if (adminState.isLoading) {return;}
    adminState.isLoading = true;
    renderSettingsPanel(adminState.currentSettingsTab || 'home');
    try {
      const { response, data } = await requestJson(API + '/settings');
      if (response.ok && data.success) {
        adminState.settings = data.data || data.settings || {};
        renderSettingsPanel(adminState.currentSettingsTab || 'home');
        bridgeSettingsToUI();
        if (adminState.currentPage === 'profile' && adminState.profile) {
          renderProfilePanel();
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      adminState.isLoading = false;
    }
  }

  async function saveSettings() {
    if (adminState.isLoading) {return;}
    const settings = {};
    document.querySelectorAll('[id^="set_"]').forEach((el) => {
      settings[el.id.replace('set_', '')] = el.value;
    });

    adminState.isLoading = true;
    const button = document.querySelector('.settings-panel .save-btn');
    const originalText = button?.textContent || 'Save Settings';
    if (button) {
      button.disabled = true;
      button.textContent = 'Saving...';
    }

    try {
      const { response, data } = await requestJson(API + '/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      if (response.ok && data.success) {
        adminState.settings = data.data || settings;
        renderSettingsPanel(adminState.currentSettingsTab || 'home');
        bridgeSettingsToUI();
        if (adminState.currentPage === 'profile' && adminState.profile) {
          renderProfilePanel();
        }
        showToast('Settings saved successfully.');
        const msg = document.getElementById('settingsMsg');
        if (msg) {
          msg.textContent = 'Settings saved and synced to the public site.';
          msg.classList.add('success');
          msg.classList.remove('error');
        }
      } else {
        showToast(data?.message || 'Save failed.', 'danger');
        const msg = document.getElementById('settingsMsg');
        if (msg) {
          msg.textContent = data?.message || 'Save failed.';
          msg.classList.add('error');
          msg.classList.remove('success');
        }
      }
    } catch (error) {
      console.error(error);
      showToast('Network error while saving settings.', 'danger');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
      adminState.isLoading = false;
    }
  }

  async function loadDashboardData() {
    try {
      const statsPromise = requestJson(API + '/stats');
      const recentAppointmentsPromise = requestJson(API + '/appointments?limit=5');
      const recentMessagesPromise = requestJson(API + '/messages?limit=5');
      const [statsResult, appointmentsResult, messagesResult] = await Promise.all([statsPromise, recentAppointmentsPromise, recentMessagesPromise]);

      if (statsResult.response.ok && statsResult.data?.success && statsResult.data.stats) {
        const stats = statsResult.data.stats;
        document.getElementById('statAppointmentsValue').textContent = stats.total ?? '-';
        document.getElementById('statPatientsValue').textContent = stats.totalPatients ?? '-';
        document.getElementById('statMessagesValue').textContent = stats.unreadMessages ?? '-';
        document.getElementById('statServicesValue').textContent = stats.totalServices ?? '-';
      }

      const appointmentsBody = document.getElementById('recentAppointmentsBody');
      const recentAppointments = appointmentsResult.data?.appointments || [];
      if (appointmentsResult.response.ok && recentAppointments.length) {
        appointmentsBody.innerHTML = recentAppointments.slice(0, 5).map((appointment) => {
          const patient = appointment.patient ? `${escapeHtml(appointment.patient.firstName)} ${escapeHtml(appointment.patient.lastName)}` : 'Walk-in';
          const service = appointment.service?.name || appointment.service || '-';
          return `<tr><td><code>${escapeHtml(appointment.referenceNumber || '')}</code></td><td>${patient}</td><td>${escapeHtml(service)}</td><td>${escapeHtml(appointment.date || '')}</td><td><span class="status-badge badge-${normalizeStatus(appointment.status)}">${escapeHtml(appointment.status || '')}</span></td></tr>`;
        }).join('');
      } else {
        renderEmpty(appointmentsBody, 'No recent appointments found.');
      }

      const messagesBody = document.getElementById('recentMessagesBody');
      const recentMessages = messagesResult.data?.data || [];
      if (messagesResult.response.ok && recentMessages.length) {
        messagesBody.innerHTML = recentMessages.slice(0, 5).map((message) => {
          return `<tr><td>${escapeHtml(message.name)}</td><td>${escapeHtml(message.email)}</td><td>${escapeHtml(message.subject || '')}</td><td>${message.isRead ? 'Yes' : 'No'}</td></tr>`;
        }).join('');
      } else {
        renderEmpty(messagesBody, 'No recent messages found.');
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function loadAppointmentsPage() {
    const panel = document.getElementById('appointmentsPage');
    if (!panel) {return;}
    renderLoading(panel, 'Loading appointments...');

    const { response, data } = await requestJson(API + '/appointments?limit=100');
    if (!response.ok || !data?.appointments) {
      renderEmpty(panel, data?.message || 'Unable to load appointments.');
      return;
    }

    adminState.appointments = data.appointments;
    panel.innerHTML = `
      <div class="filter-bar" style="margin-bottom:16px;">
        <div class="filter-group"><label class="filter-label">Search</label><input id="appointmentsSearch" class="filter-input" type="text" placeholder="Reference, patient, email..."></div>
        <div class="filter-group"><label class="filter-label">Status</label><select id="appointmentsStatus" class="filter-input"><option value="">All</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no-show">No-show</option></select></div>
        <div class="card-actions"><button id="appointmentsRefresh" class="btn btn-primary btn-sm" type="button">Refresh</button></div>
      </div>
      <div class="dashboard-row">
        <div class="card" style="margin-bottom:0;">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Reference</th><th>Patient</th><th>Service</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody id="appointmentsTableBody"></tbody>
            </table>
          </div>
        </div>
        <div class="card" style="margin-bottom:0;">
          <div class="card-header"><div class="card-title">Appointment Details</div></div>
          <div class="card-body" id="appointmentDetailBody" style="padding:24px;">Select an appointment to inspect it.</div>
        </div>
      </div>
    `;

    const tableBody = panel.querySelector('#appointmentsTableBody');
    const detailBody = panel.querySelector('#appointmentDetailBody');
    const searchInput = panel.querySelector('#appointmentsSearch');
    const statusSelect = panel.querySelector('#appointmentsStatus');

    function renderAppointmentsList() {
      const term = searchInput.value.trim().toLowerCase();
      const status = statusSelect.value;
      const filtered = adminState.appointments.filter((appointment) => {
        const patientName = `${appointment.patient?.firstName || ''} ${appointment.patient?.lastName || ''}`.trim().toLowerCase();
        const haystack = [appointment.referenceNumber, patientName, appointment.patient?.email, appointment.service?.name, appointment.service].filter(Boolean).join(' ').toLowerCase();
        return (!status || appointment.status === status) && (!term || haystack.includes(term));
      });

      if (!filtered.length) {
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No appointments match the current filters.</td></tr>';
        return;
      }

      tableBody.innerHTML = filtered.map((appointment) => {
        const patient = appointment.patient ? `${escapeHtml(appointment.patient.firstName)} ${escapeHtml(appointment.patient.lastName)}` : 'Walk-in';
        const service = appointment.service?.name || appointment.service || '-';
        return `
          <tr>
            <td><code>${escapeHtml(appointment.referenceNumber || '')}</code></td>
            <td>${patient}</td>
            <td>${escapeHtml(service)}</td>
            <td>${escapeHtml(appointment.date || '')} ${escapeHtml(appointment.time || '')}</td>
            <td><span class="status-badge badge-${normalizeStatus(appointment.status)}">${escapeHtml(appointment.status || '')}</span></td>
            <td>
              <div class="row-actions">
                <button class="action-btn view" data-action="view-appointment" data-id="${appointment.id}" title="View">👁</button>
                <button class="action-btn edit" data-action="confirm-appointment" data-id="${appointment.id}" title="Confirm">✓</button>
                <button class="action-btn danger" data-action="delete-appointment" data-id="${appointment.id}" title="Delete">✕</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    function renderAppointmentDetail(appointment) {
      if (!appointment) {
        detailBody.innerHTML = 'Select an appointment to inspect it.';
        return;
      }
      detailBody.innerHTML = `
        <div class="detail-grid">
          <div class="detail-field"><div class="detail-field-label">Reference</div><div class="detail-field-value"><code>${escapeHtml(appointment.referenceNumber || '')}</code></div></div>
          <div class="detail-field"><div class="detail-field-label">Status</div><div class="detail-field-value"><span class="status-badge badge-${normalizeStatus(appointment.status)}">${escapeHtml(appointment.status || '')}</span></div></div>
          <div class="detail-field"><div class="detail-field-label">Patient</div><div class="detail-field-value">${escapeHtml(appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : appointment.name || '')}</div></div>
          <div class="detail-field"><div class="detail-field-label">Email</div><div class="detail-field-value">${escapeHtml(appointment.patient?.email || appointment.email || '')}</div></div>
          <div class="detail-field"><div class="detail-field-label">Service</div><div class="detail-field-value">${escapeHtml(appointment.service?.name || appointment.service || '')}</div></div>
          <div class="detail-field"><div class="detail-field-label">Scheduled</div><div class="detail-field-value">${escapeHtml(appointment.date || '')} at ${escapeHtml(appointment.time || '')}</div></div>
          <div class="detail-field detail-field-full"><div class="detail-field-label">Notes</div><div class="detail-field-value">${escapeHtml(appointment.notes || appointment.patientNotes || 'No notes recorded.')}</div></div>
        </div>
      `;
    }

    tableBody.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) {return;}
      const appointment = adminState.appointments.find((item) => String(item.id) === String(button.dataset.id));
      if (!appointment) {return;}

      if (button.dataset.action === 'view-appointment') {
        renderAppointmentDetail(appointment);
      }

      if (button.dataset.action === 'confirm-appointment') {
        const { response } = await requestJson(API + `/appointments/${appointment.id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'confirmed' }),
        });
        if (response.ok) {
          showToast('Appointment confirmed.');
          adminState.pageCache.delete('appointments');
          loadAppointmentsPage();
          loadDashboardData();
        }
      }

      if (button.dataset.action === 'delete-appointment') {
        if (!confirm('Delete this appointment permanently?')) {return;}
        const { response } = await requestJson(API + `/appointments/${appointment.id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          showToast('Appointment deleted.');
          adminState.pageCache.delete('appointments');
          loadAppointmentsPage();
          loadDashboardData();
        }
      }
    });

    searchInput.addEventListener('input', renderAppointmentsList);
    statusSelect.addEventListener('change', renderAppointmentsList);
    panel.querySelector('#appointmentsRefresh').addEventListener('click', () => {
      adminState.pageCache.delete('appointments');
      loadAppointmentsPage();
    });

    renderAppointmentsList();
  }

  async function loadPatientsPage() {
    const panel = document.getElementById('patientsPage');
    if (!panel) {return;}
    renderLoading(panel, 'Loading patients...');

    const { response, data } = await requestJson(API + '/patients?limit=100');
    if (!response.ok || !data?.patients) {
      renderEmpty(panel, data?.message || 'Unable to load patients.');
      return;
    }

    adminState.patients = data.patients;
    panel.innerHTML = `
      <div class="filter-bar" style="margin-bottom:16px;">
        <div class="filter-group"><label class="filter-label">Search</label><input id="patientsSearch" class="filter-input" type="text" placeholder="Name, email, phone..."></div>
        <div class="card-actions"><button id="patientsRefresh" class="btn btn-primary btn-sm" type="button">Refresh</button></div>
      </div>
      <div class="dashboard-row">
        <div class="card" style="margin-bottom:0;">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody id="patientsTableBody"></tbody>
            </table>
          </div>
        </div>
        <div class="card" style="margin-bottom:0;">
          <div class="card-header"><div class="card-title">Patient Details</div></div>
          <div class="card-body" id="patientDetailBody" style="padding:24px;">Select a patient to view full record.</div>
        </div>
      </div>
    `;

    const tableBody = panel.querySelector('#patientsTableBody');
    const detailBody = panel.querySelector('#patientDetailBody');
    const searchInput = panel.querySelector('#patientsSearch');

    function renderPatientList() {
      const term = searchInput.value.trim().toLowerCase();
      const filtered = adminState.patients.filter((patient) => {
        const haystack = [patient.firstName, patient.lastName, patient.email, patient.phone].filter(Boolean).join(' ').toLowerCase();
        return !term || haystack.includes(term);
      });

      if (!filtered.length) {
        tableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No patients match the current filters.</td></tr>';
        return;
      }

      tableBody.innerHTML = filtered.map((patient) => `
        <tr>
          <td>${escapeHtml(patient.firstName)} ${escapeHtml(patient.lastName)}</td>
          <td>${escapeHtml(patient.email || '')}</td>
          <td>${escapeHtml(patient.phone || '')}</td>
          <td><span class="status-badge badge-${normalizeStatus(patient.status)}">${escapeHtml(patient.status || '')}</span></td>
          <td>
            <div class="row-actions">
              <button class="action-btn view" data-action="view-patient" data-id="${patient.id}" title="View">👁</button>
              <button class="action-btn edit" data-action="remind-patient" data-id="${patient.id}" title="Reminder">⏰</button>
              <button class="action-btn danger" data-action="delete-patient" data-id="${patient.id}" title="Delete">✕</button>
            </div>
          </td>
        </tr>
      `).join('');
    }

    async function renderPatientDetail(id) {
      const { response, data: patientData } = await requestJson(API + `/patients/${id}`);
      if (!response.ok || !patientData?.patient) {return;}
      const patient = patientData.patient;
      const appointments = patientData.appointments || [];
      detailBody.innerHTML = `
        <div class="detail-grid">
          <div class="detail-field"><div class="detail-field-label">Name</div><div class="detail-field-value">${escapeHtml(patient.firstName)} ${escapeHtml(patient.lastName)}</div></div>
          <div class="detail-field"><div class="detail-field-label">Status</div><div class="detail-field-value">${escapeHtml(patient.status || '')}</div></div>
          <div class="detail-field"><div class="detail-field-label">Email</div><div class="detail-field-value">${escapeHtml(patient.email || '')}</div></div>
          <div class="detail-field"><div class="detail-field-label">Phone</div><div class="detail-field-value">${escapeHtml(patient.phone || '')}</div></div>
          <div class="detail-field detail-field-full"><div class="detail-field-label">Allergies</div><div class="detail-field-value">${escapeHtml((patient.allergies || []).join(', ') || 'None recorded')}</div></div>
          <div class="detail-field detail-field-full"><div class="detail-field-label">Medications</div><div class="detail-field-value">${escapeHtml((patient.medications || []).join(', ') || 'None recorded')}</div></div>
        </div>
        <div style="margin-top:18px;">
          <div class="card-title" style="margin-bottom:12px;">Recent Appointments</div>
          ${appointments.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Ref</th><th>Service</th><th>Date</th></tr></thead><tbody>${appointments.slice(0, 5).map((appt) => `<tr><td><code>${escapeHtml(appt.referenceNumber || '')}</code></td><td>${escapeHtml(appt.service?.name || '')}</td><td>${escapeHtml(appt.date || '')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No appointments on record.</div>'}
        </div>
      `;
    }

    tableBody.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) {return;}
      const patient = adminState.patients.find((item) => String(item.id) === String(button.dataset.id));
      if (!patient) {return;}

      if (button.dataset.action === 'view-patient') {
        await renderPatientDetail(patient.id);
      }

      if (button.dataset.action === 'remind-patient') {
        const timeframe = prompt('Reminder timeframe (e.g. 1 week, 1 month):', '1 week');
        if (timeframe === null) {return;}
        const message = prompt('Reminder message:', 'Please follow up with the clinic.');
        if (message === null) {return;}
        const { response } = await requestJson(API + `/patients/${patient.id}/reminders`, {
          method: 'POST',
          body: JSON.stringify({ timeframe, message }),
        });
        if (response.ok) {
          showToast('Reminder added.');
          adminState.pageCache.delete('patients');
          loadPatientsPage();
        }
      }

      if (button.dataset.action === 'delete-patient') {
        if (!confirm('Delete this patient and their appointments?')) {return;}
        const { response } = await requestJson(API + `/patients/${patient.id}`, { method: 'DELETE' });
        if (response.ok) {
          showToast('Patient deleted.');
          adminState.pageCache.delete('patients');
          loadPatientsPage();
          loadDashboardData();
        }
      }
    });

    searchInput.addEventListener('input', renderPatientList);
    panel.querySelector('#patientsRefresh').addEventListener('click', () => {
      adminState.pageCache.delete('patients');
      loadPatientsPage();
    });

    renderPatientList();
  }

  async function loadMessagesPage() {
    const panel = document.getElementById('messagesPage');
    if (!panel) {return;}
    renderLoading(panel, 'Loading messages...');

    const { response, data } = await requestJson(API + '/messages?limit=100');
    if (!response.ok || !data?.data) {
      renderEmpty(panel, data?.message || 'Unable to load messages.');
      return;
    }

    adminState.messages = data.data;
    panel.innerHTML = `
      <div class="dashboard-row">
        <div class="card" style="margin-bottom:0;">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Name</th><th>Email</th><th>Subject</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody id="messagesTableBody"></tbody>
            </table>
          </div>
        </div>
        <div class="card" style="margin-bottom:0;">
          <div class="card-header"><div class="card-title">Message Detail</div></div>
          <div class="card-body" id="messageDetailBody" style="padding:24px;">Select a message to inspect it.</div>
        </div>
      </div>
    `;

    const tableBody = panel.querySelector('#messagesTableBody');
    const detailBody = panel.querySelector('#messageDetailBody');

    function renderMessageList() {
      if (!adminState.messages.length) {
        tableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No messages found.</td></tr>';
        return;
      }

      tableBody.innerHTML = adminState.messages.map((message) => `
        <tr class="${message.isRead ? '' : 'unread-row'}">
          <td><span class="${message.isRead ? '' : 'unread-dot'}"></span> ${escapeHtml(message.name)}</td>
          <td>${escapeHtml(message.email)}</td>
          <td>${escapeHtml(message.subject || '')}</td>
          <td>${message.isRead ? 'Read' : 'Unread'}</td>
          <td>
            <div class="row-actions">
              <button class="action-btn view" data-action="view-message" data-id="${message.id}" title="View">👁</button>
              <button class="action-btn edit" data-action="toggle-message" data-id="${message.id}" title="Toggle Read">↺</button>
              <button class="action-btn danger" data-action="delete-message" data-id="${message.id}" title="Delete">✕</button>
            </div>
          </td>
        </tr>
      `).join('');
    }

    async function renderMessageDetail(id) {
      const { response, data: messageData } = await requestJson(API + `/messages/${id}`);
      if (!response.ok || !messageData?.data) {return;}
      const message = messageData.data;
      detailBody.innerHTML = `
        <div class="detail-grid">
          <div class="detail-field"><div class="detail-field-label">From</div><div class="detail-field-value">${escapeHtml(message.name)}</div></div>
          <div class="detail-field"><div class="detail-field-label">Email</div><div class="detail-field-value">${escapeHtml(message.email)}</div></div>
          <div class="detail-field"><div class="detail-field-label">Phone</div><div class="detail-field-value">${escapeHtml(message.phone || 'N/A')}</div></div>
          <div class="detail-field"><div class="detail-field-label">Subject</div><div class="detail-field-value">${escapeHtml(message.subject || '')}</div></div>
          <div class="detail-field detail-field-full"><div class="detail-field-label">Message</div><div class="detail-field-value">${escapeHtml(message.message || '')}</div></div>
        </div>
      `;
    }

    tableBody.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) {return;}
      const message = adminState.messages.find((item) => String(item.id) === String(button.dataset.id));
      if (!message) {return;}

      if (button.dataset.action === 'view-message') {
        await renderMessageDetail(message.id);
      }

      if (button.dataset.action === 'toggle-message') {
        const { response } = await requestJson(API + `/messages/${message.id}/read`, { method: 'PUT' });
        if (response.ok) {
          showToast(message.isRead ? 'Marked unread.' : 'Marked read.');
          adminState.pageCache.delete('messages');
          loadMessagesPage();
          loadDashboardData();
        }
      }

      if (button.dataset.action === 'delete-message') {
        if (!confirm('Delete this message permanently?')) {return;}
        const { response } = await requestJson(API + `/messages/${message.id}`, { method: 'DELETE' });
        if (response.ok) {
          showToast('Message deleted.');
          adminState.pageCache.delete('messages');
          loadMessagesPage();
          loadDashboardData();
        }
      }
    });

    renderMessageList();
  }

  async function loadServicesPage() {
    const panel = document.getElementById('servicesPage');
    if (!panel) {return;}
    renderLoading(panel, 'Loading services...');

    const { response, data } = await requestJson(API + '/services');
    if (!response.ok || !data?.services) {
      renderEmpty(panel, data?.message || 'Unable to load services.');
      return;
    }

    adminState.services = data.services;
    panel.innerHTML = `
      <div class="dashboard-row">
        <div class="card" style="margin-bottom:0;">
          <div class="card-header"><div class="card-title">Service Catalog</div></div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Active</th><th>Actions</th></tr></thead>
              <tbody id="servicesTableBody"></tbody>
            </table>
          </div>
        </div>
        <div class="card" style="margin-bottom:0;">
          <div class="card-header"><div class="card-title" id="serviceFormTitle">Create Service</div></div>
          <div class="card-body" style="padding:24px;">
            <form id="serviceForm">
              <input type="hidden" id="serviceId">
              <div class="visual-fields visual-fields--2col">
                <div class="visual-field"><label for="serviceName">Name</label><input id="serviceName" class="form-input" required></div>
                <div class="visual-field"><label for="serviceCategory">Category</label><input id="serviceCategory" class="form-input" required></div>
                <div class="visual-field"><label for="serviceDuration">Duration</label><input id="serviceDuration" class="form-input" type="number" min="5" step="5"></div>
                <div class="visual-field"><label for="servicePrice">Price</label><input id="servicePrice" class="form-input" type="number" min="0" step="1"></div>
                <div class="visual-field"><label for="serviceColor">Color</label><input id="serviceColor" class="form-input" placeholder="#4F46E5"></div>
                <div class="visual-field"><label for="serviceIcon">Icon</label><input id="serviceIcon" class="form-input" placeholder="stethoscope"></div>
                <div class="visual-field" style="grid-column:1/-1;"><label for="serviceDescription">Description</label><textarea id="serviceDescription" class="form-input"></textarea></div>
                <div class="visual-field" style="grid-column:1/-1;"><label for="servicePrep">Preparation Instructions</label><textarea id="servicePrep" class="form-input"></textarea></div>
              </div>
              <div style="display:flex; gap:12px; align-items:center; justify-content:space-between; margin-top:16px;">
                <label class="toggle-label"><input id="serviceActive" type="checkbox" checked> Active</label>
                <div style="display:flex; gap:8px;">
                  <button type="button" id="serviceReset" class="btn btn-outline btn-sm">Reset</button>
                  <button type="submit" class="btn btn-primary btn-sm">Save Service</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    const tableBody = panel.querySelector('#servicesTableBody');
    const form = panel.querySelector('#serviceForm');
    const serviceId = panel.querySelector('#serviceId');
    const serviceFormTitle = panel.querySelector('#serviceFormTitle');

    function resetForm() {
      serviceId.value = '';
      form.reset();
      panel.querySelector('#serviceActive').checked = true;
      serviceFormTitle.textContent = 'Create Service';
    }

    function renderServicesList() {
      if (!adminState.services.length) {
        tableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No services found.</td></tr>';
        return;
      }
      tableBody.innerHTML = adminState.services.map((service) => `
        <tr>
          <td>${escapeHtml(service.name)}</td>
          <td>${escapeHtml(service.category || '')}</td>
          <td>$${escapeHtml(service.price ?? '')}</td>
          <td>${service.isActive ? 'Yes' : 'No'}</td>
          <td>
            <div class="row-actions">
              <button class="action-btn edit" data-action="edit-service" data-id="${service.id}" title="Edit">✎</button>
              <button class="action-btn danger" data-action="delete-service" data-id="${service.id}" title="Delete">✕</button>
            </div>
          </td>
        </tr>
      `).join('');
    }

    tableBody.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) {return;}
      const service = adminState.services.find((item) => String(item.id) === String(button.dataset.id));
      if (!service) {return;}

      if (button.dataset.action === 'edit-service') {
        serviceId.value = service.id;
        panel.querySelector('#serviceName').value = service.name || '';
        panel.querySelector('#serviceCategory').value = service.category || '';
        panel.querySelector('#serviceDuration').value = service.duration || '';
        panel.querySelector('#servicePrice').value = service.price || '';
        panel.querySelector('#serviceColor').value = service.color || '';
        panel.querySelector('#serviceIcon').value = service.icon || '';
        panel.querySelector('#serviceDescription').value = service.description || '';
        panel.querySelector('#servicePrep').value = service.preparationInstructions || '';
        panel.querySelector('#serviceActive').checked = Boolean(service.isActive);
        serviceFormTitle.textContent = 'Edit Service';
      }

      if (button.dataset.action === 'delete-service') {
        if (!confirm('Delete this service? Existing appointments will keep it and the service may be deactivated instead.')) {return;}
        const { response, data: deleteData } = await requestJson(API + `/services/${service.id}`, { method: 'DELETE' });
        if (response.ok) {
          showToast(deleteData?.message || 'Service updated.');
          adminState.pageCache.delete('services');
          loadServicesPage();
          loadDashboardData();
        }
      }
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        name: panel.querySelector('#serviceName').value.trim(),
        category: panel.querySelector('#serviceCategory').value.trim(),
        duration: Number(panel.querySelector('#serviceDuration').value || 0),
        price: Number(panel.querySelector('#servicePrice').value || 0),
        color: panel.querySelector('#serviceColor').value.trim(),
        icon: panel.querySelector('#serviceIcon').value.trim(),
        description: panel.querySelector('#serviceDescription').value.trim(),
        preparationInstructions: panel.querySelector('#servicePrep').value.trim(),
        isActive: panel.querySelector('#serviceActive').checked,
      };
      const id = serviceId.value;
      const url = id ? `${API}/services/${id}` : `${API}/services`;
      const method = id ? 'PUT' : 'POST';
      const { response, data: saveData } = await requestJson(url, { method, body: JSON.stringify(payload) });
      if (response.ok && saveData?.success) {
        showToast(id ? 'Service updated.' : 'Service created.');
        resetForm();
        adminState.pageCache.delete('services');
        loadServicesPage();
        loadDashboardData();
      } else {
        showToast(saveData?.message || 'Unable to save service.', 'danger');
      }
    });

    panel.querySelector('#serviceReset').addEventListener('click', resetForm);
    renderServicesList();
  }

  async function loadTestimonialsPage() {
    const panel = document.getElementById('testimonialsPage');
    if (!panel) {return;}
    renderLoading(panel, 'Loading testimonials...');

    const { response, data } = await requestJson(API + '/testimonials/manage');
    if (!response.ok || !data?.data) {
      renderEmpty(panel, data?.message || 'Unable to load testimonials.');
      return;
    }

    adminState.testimonials = data.data;
    panel.innerHTML = `
      <div class="dashboard-row">
        <div class="card" style="margin-bottom:0;">
          <div class="card-header"><div class="card-title">Testimonial List</div></div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Name</th><th>Title</th><th>Rating</th><th>Home</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody id="testimonialsTableBody"></tbody>
            </table>
          </div>
        </div>
        <div class="card" style="margin-bottom:0;">
          <div class="card-header"><div class="card-title" id="testimonialFormTitle">Create Testimonial</div></div>
          <div class="card-body" style="padding:24px;">
            <form id="testimonialForm">
              <input type="hidden" id="testimonialId">
              <div class="visual-fields visual-fields--2col">
                <div class="visual-field"><label for="testimonialName">Name</label><input id="testimonialName" class="form-input" required></div>
                <div class="visual-field"><label for="testimonialTitle">Title</label><input id="testimonialTitle" class="form-input"></div>
                <div class="visual-field"><label for="testimonialRating">Rating</label><input id="testimonialRating" class="form-input" type="number" min="1" max="5" value="5"></div>
                <div class="visual-field">
                  <label class="toggle-label" style="margin-top:24px;"><input id="testimonialHome" type="checkbox" checked> Display on homepage</label>
                  <label class="toggle-label" style="margin-top:12px;"><input id="testimonialActive" type="checkbox" checked> Active</label>
                </div>
                <div class="visual-field" style="grid-column:1/-1;"><label for="testimonialContent">Content</label><textarea id="testimonialContent" class="form-input" required></textarea></div>
              </div>
              <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px;">
                <button type="button" id="testimonialReset" class="btn btn-outline btn-sm">Reset</button>
                <button type="submit" class="btn btn-primary btn-sm">Save Testimonial</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    const tableBody = panel.querySelector('#testimonialsTableBody');
    const form = panel.querySelector('#testimonialForm');
    const testimonialId = panel.querySelector('#testimonialId');
    const testimonialFormTitle = panel.querySelector('#testimonialFormTitle');

    function resetForm() {
      testimonialId.value = '';
      form.reset();
      panel.querySelector('#testimonialRating').value = 5;
      panel.querySelector('#testimonialHome').checked = true;
      panel.querySelector('#testimonialActive').checked = true;
      testimonialFormTitle.textContent = 'Create Testimonial';
    }

    function renderTestimonialsList() {
      if (!adminState.testimonials.length) {
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No testimonials found.</td></tr>';
        return;
      }
      tableBody.innerHTML = adminState.testimonials.map((testimonial) => `
        <tr>
          <td>${escapeHtml(testimonial.name)}</td>
          <td>${escapeHtml(testimonial.title || '')}</td>
          <td>${escapeHtml(testimonial.rating || '')}</td>
          <td>${testimonial.displayOnHome ? 'Yes' : 'No'}</td>
          <td>${testimonial.isActive ? 'Active' : 'Hidden'}</td>
          <td>
            <div class="row-actions">
              <button class="action-btn edit" data-action="edit-testimonial" data-id="${testimonial.id}" title="Edit">✎</button>
              <button class="action-btn danger" data-action="delete-testimonial" data-id="${testimonial.id}" title="Delete">✕</button>
            </div>
          </td>
        </tr>
      `).join('');
    }

    tableBody.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) {return;}
      const testimonial = adminState.testimonials.find((item) => String(item.id) === String(button.dataset.id));
      if (!testimonial) {return;}

      if (button.dataset.action === 'edit-testimonial') {
        testimonialId.value = testimonial.id;
        panel.querySelector('#testimonialName').value = testimonial.name || '';
        panel.querySelector('#testimonialTitle').value = testimonial.title || '';
        panel.querySelector('#testimonialRating').value = testimonial.rating || 5;
        panel.querySelector('#testimonialContent').value = testimonial.content || '';
        panel.querySelector('#testimonialHome').checked = Boolean(testimonial.displayOnHome);
        panel.querySelector('#testimonialActive').checked = Boolean(testimonial.isActive);
        testimonialFormTitle.textContent = 'Edit Testimonial';
      }

      if (button.dataset.action === 'delete-testimonial') {
        if (!confirm('Delete this testimonial?')) {return;}
        const { response } = await requestJson(API + `/testimonials/manage/${testimonial.id}`, { method: 'DELETE' });
        if (response.ok) {
          showToast('Testimonial deleted.');
          adminState.pageCache.delete('testimonials');
          loadTestimonialsPage();
          loadDashboardData();
        }
      }
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        name: panel.querySelector('#testimonialName').value.trim(),
        title: panel.querySelector('#testimonialTitle').value.trim(),
        rating: Number(panel.querySelector('#testimonialRating').value || 5),
        content: panel.querySelector('#testimonialContent').value.trim(),
        displayOnHome: panel.querySelector('#testimonialHome').checked,
        isActive: panel.querySelector('#testimonialActive').checked,
      };
      const id = testimonialId.value;
      const url = id ? `${API}/testimonials/manage/${id}` : `${API}/testimonials/manage`;
      const method = id ? 'PUT' : 'POST';
      const { response, data: saveData } = await requestJson(url, { method, body: JSON.stringify(payload) });
      if (response.ok && saveData?.success) {
        showToast(id ? 'Testimonial updated.' : 'Testimonial created.');
        resetForm();
        adminState.pageCache.delete('testimonials');
        loadTestimonialsPage();
      } else {
        showToast(saveData?.message || 'Unable to save testimonial.', 'danger');
      }
    });

    panel.querySelector('#testimonialReset').addEventListener('click', resetForm);
    renderTestimonialsList();
  }

  async function loadAuditLogsPage() {
    const panel = document.getElementById('auditLogsPage');
    if (!panel) {return;}
    renderLoading(panel, 'Loading audit logs...');

    const { response, data } = await requestJson(API + '/audit-logs?limit=100');
    if (!response.ok || !data?.logs) {
      renderEmpty(panel, data?.message || 'Unable to load audit logs.');
      return;
    }

    adminState.auditLogs = data.logs;
    panel.innerHTML = `
      <div class="filter-bar" style="margin-bottom:16px;">
        <div class="filter-group"><label class="filter-label">Action</label><input id="auditAction" class="filter-input" type="text" placeholder="login, update, delete..."></div>
        <div class="filter-group"><label class="filter-label">Resource</label><input id="auditResource" class="filter-input" type="text" placeholder="appointment, patient..."></div>
        <div class="card-actions"><button id="auditRefresh" class="btn btn-primary btn-sm" type="button">Refresh</button></div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Resource</th><th>Details</th></tr></thead>
          <tbody id="auditLogsTableBody"></tbody>
        </table>
      </div>
    `;

    const tableBody = panel.querySelector('#auditLogsTableBody');
    const actionInput = panel.querySelector('#auditAction');
    const resourceInput = panel.querySelector('#auditResource');

    function renderLogs() {
      const actionTerm = actionInput.value.trim().toLowerCase();
      const resourceTerm = resourceInput.value.trim().toLowerCase();
      const filtered = adminState.auditLogs.filter((log) => {
        const matchesAction = !actionTerm || String(log.action || '').toLowerCase().includes(actionTerm);
        const matchesResource = !resourceTerm || String(log.resource || '').toLowerCase().includes(resourceTerm);
        return matchesAction && matchesResource;
      });

      if (!filtered.length) {
        tableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No audit logs match the filters.</td></tr>';
        return;
      }

      tableBody.innerHTML = filtered.map((log) => `
        <tr>
          <td>${escapeHtml(new Date(log.createdAt).toLocaleString())}</td>
          <td>${escapeHtml(log.adminEmail || '')}</td>
          <td>${escapeHtml(log.action || '')}</td>
          <td>${escapeHtml(log.resource || '')}</td>
          <td><code>${escapeHtml(JSON.stringify(log.details || {}).slice(0, 120))}</code></td>
        </tr>
      `).join('');
    }

    actionInput.addEventListener('input', renderLogs);
    resourceInput.addEventListener('input', renderLogs);
    panel.querySelector('#auditRefresh').addEventListener('click', () => {
      adminState.pageCache.delete('audit-logs');
      loadAuditLogsPage();
    });

    renderLogs();
  }

  async function loadProfileData() {
    const { response, data } = await requestJson(API + '/me');
    if (response.ok && data?.admin) {
      adminState.admin = data.admin;
      adminState.profile = data.admin;
      updateTopbar(data.admin);
      renderProfilePanel();
      if (adminState.currentPage === 'settings') {
        renderSettingsPanel(adminState.currentSettingsTab || 'home');
      }
    }
  }

  async function loadPageData(page) {
    if (page !== 'dashboard' && adminState.pageCache.has(page)) {
      return;
    }

    if (page === 'dashboard') {
      await loadDashboardData();
      adminState.pageCache.add('dashboard');
      return;
    }
    if (page === 'appointments') {
      await loadAppointmentsPage();
      adminState.pageCache.add('appointments');
      return;
    }
    if (page === 'patients') {
      await loadPatientsPage();
      adminState.pageCache.add('patients');
      return;
    }
    if (page === 'messages') {
      await loadMessagesPage();
      adminState.pageCache.add('messages');
      return;
    }
    if (page === 'testimonials') {
      await loadTestimonialsPage();
      adminState.pageCache.add('testimonials');
      return;
    }
    if (page === 'services') {
      await loadServicesPage();
      adminState.pageCache.add('services');
      return;
    }
    if (page === 'audit-logs') {
      await loadAuditLogsPage();
      adminState.pageCache.add('audit-logs');
      return;
    }
    if (page === 'settings') {
      await loadSettings();
      adminState.pageCache.add('settings');
      return;
    }
    if (page === 'profile') {
      await loadProfileData();
      adminState.pageCache.add('profile');
    }
  }

  async function initAdminApp() {
    try {
      const { response, data } = await requestJson(API + '/me');
      if (response.ok && data?.success && data.admin) {
        adminState.admin = data.admin;
        adminState.profile = data.admin;
        updateTopbar(data.admin);
        showApp();
        await Promise.all([loadSettings(), loadDashboardData(), loadProfileData()]);
        return;
      }
    } catch (error) {
      console.error(error);
    }
    showLogin();
  }

  function startClock() {
    const tick = () => {
      const el = document.getElementById('liveClock');
      if (el) {el.textContent = new Date().toLocaleString();}
    };
    tick();
    setInterval(tick, 1000);
  }

  document.addEventListener('DOMContentLoaded', () => {
    startClock();

    document.getElementById('adminLoginForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const errorBox = document.getElementById('loginError');
      const button = document.getElementById('loginBtn');
      errorBox.classList.remove('show');
      errorBox.textContent = '';
      button.disabled = true;
      button.classList.add('loading');

      try {
        const { response, data } = await requestJson(API + '/login', {
          method: 'POST',
          body: JSON.stringify({
            email: document.getElementById('adminEmail').value.trim(),
            password: document.getElementById('adminPassword').value,
          }),
        });

        if (response.ok && data?.success) {
          showToast('Signed in successfully.');
          adminState.pageCache.clear();
          await initAdminApp();
        } else {
          errorBox.textContent = data?.message || 'Sign in failed.';
          errorBox.classList.add('show');
        }
      } catch (error) {
        console.error(error);
        errorBox.textContent = 'Network error while signing in.';
        errorBox.classList.add('show');
      } finally {
        button.disabled = false;
        button.classList.remove('loading');
      }
    });

    document.getElementById('settingsForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      saveSettings();
    });

    document.querySelectorAll('[data-page]').forEach((item) => {
      item.addEventListener('click', () => {
        setPage(item.dataset.page);
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebarOverlay')?.classList.remove('open');
      });
    });

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      try {
        await fetch(API + '/logout', { method: 'POST', credentials: 'include' });
      } catch (error) {
        console.error(error);
      }
      adminState.admin = null;
      adminState.profile = null;
      adminState.pageCache.clear();
      showLogin();
    });

    document.querySelector('.sidebar-toggle')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('open');
      document.getElementById('sidebarOverlay')?.classList.toggle('open');
    });

    document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebarOverlay')?.classList.remove('open');
    });

    initAdminApp();
  });
})();
