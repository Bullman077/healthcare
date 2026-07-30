const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// 1. Update css/components.css
let componentsCssPath = path.join(root, 'css', 'components.css');
let compCss = fs.readFileSync(componentsCssPath, 'utf8');

const btnVariants = `
/* ----- BUTTON VARIANTS & SYSTEM ----- */
.btn--primary,
.btn-primary {
  background: var(--gradient-primary) !important;
  color: var(--color-white) !important;
  border-color: transparent !important;
  box-shadow: 0 4px 14px rgba(75, 29, 109, 0.25) !important;
}

.btn--primary:hover,
.btn-primary:hover {
  background: var(--color-plum-dark) !important;
  color: var(--color-white) !important;
  box-shadow: 0 6px 20px rgba(75, 29, 109, 0.35) !important;
  transform: translateY(-2px) !important;
}

.btn--secondary {
  background: var(--color-royal-blue) !important;
  color: var(--color-white) !important;
  border-color: transparent !important;
  box-shadow: 0 4px 14px rgba(14, 67, 125, 0.25) !important;
}

.btn--secondary:hover {
  background: var(--color-royal-blue-dark) !important;
  color: var(--color-white) !important;
  box-shadow: 0 6px 20px rgba(14, 67, 125, 0.35) !important;
  transform: translateY(-2px) !important;
}

.btn--accent {
  background: var(--gradient-accent) !important;
  color: var(--color-white) !important;
  border-color: transparent !important;
  box-shadow: 0 4px 14px rgba(14, 67, 125, 0.25) !important;
}

.btn--accent:hover {
  filter: brightness(1.08) !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 20px rgba(14, 67, 125, 0.35) !important;
}

.btn--outline,
.btn-outline {
  background: rgba(75, 29, 109, 0.06) !important;
  color: var(--color-plum) !important;
  border: 1.5px solid var(--color-plum) !important;
}

.btn--outline:hover,
.btn-outline:hover {
  background: var(--color-plum) !important;
  color: var(--color-white) !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 4px 14px rgba(75, 29, 109, 0.2) !important;
}

.btn--sm {
  padding: 0.55rem 1.15rem !important;
  font-size: var(--fs-xs) !important;
}

.btn--lg {
  padding: 1rem 2.25rem !important;
  font-size: var(--fs-md) !important;
}

.nav__logo-img {
  height: 44px;
  width: 44px;
  min-width: 44px;
  object-fit: cover;
  border-radius: 50%;
  border: 1.5px solid rgba(75, 29, 109, 0.3);
  box-shadow: 0 2px 8px rgba(75, 29, 109, 0.15);
  transition: transform var(--transition-fast), border-color var(--transition-fast);
}

.nav__logo:hover .nav__logo-img {
  transform: scale(1.04);
  border-color: var(--color-plum);
}
`;

if (!compCss.includes('.btn--primary')) {
  compCss += '\n' + btnVariants;
  fs.writeFileSync(componentsCssPath, compCss, 'utf8');
  console.log('Updated css/components.css');
}

// 2. Update patient/patient.css
let patientCssPath = path.join(root, 'patient', 'patient.css');
let patientCss = fs.readFileSync(patientCssPath, 'utf8');

const patientAdditions = `
/* ----- PATIENT PORTAL LOGO & BUTTON ENHANCEMENTS ----- */
.nav__logo-img {
  height: 44px;
  width: 44px;
  min-width: 44px;
  object-fit: cover;
  border-radius: 50%;
  border: 1.5px solid rgba(75, 29, 109, 0.3);
  box-shadow: 0 2px 8px rgba(75, 29, 109, 0.15);
  transition: transform var(--transition-fast), border-color var(--transition-fast);
}

.nav__logo:hover .nav__logo-img {
  transform: scale(1.04);
  border-color: var(--color-plum);
}

.btn-primary {
  background: var(--gradient-primary, linear-gradient(135deg, #4B1D6D 0%, #0E437D 100%)) !important;
  color: #ffffff !important;
  border: none !important;
  border-radius: 9999px !important;
  padding: 0.75rem 1.5rem !important;
  font-weight: 600 !important;
  box-shadow: 0 4px 14px rgba(75, 29, 109, 0.25) !important;
  transition: all 0.2s ease !important;
  cursor: pointer !important;
}

.btn-primary:hover {
  background: #371353 !important;
  box-shadow: 0 6px 20px rgba(75, 29, 109, 0.35) !important;
  transform: translateY(-2px) !important;
}

.btn-outline {
  background: rgba(75, 29, 109, 0.06) !important;
  color: #4B1D6D !important;
  border: 1.5px solid #4B1D6D !important;
  border-radius: 9999px !important;
  padding: 0.55rem 1.15rem !important;
  font-weight: 600 !important;
  transition: all 0.2s ease !important;
  cursor: pointer !important;
}

.btn-outline:hover {
  background: #4B1D6D !important;
  color: #ffffff !important;
  transform: translateY(-2px) !important;
}
`;

if (!patientCss.includes('PATIENT PORTAL LOGO & BUTTON ENHANCEMENTS')) {
  patientCss += '\n' + patientAdditions;
  fs.writeFileSync(patientCssPath, patientCss, 'utf8');
  console.log('Updated patient/patient.css');
}

// 3. Fix patient/index.html stylesheet links and absolute asset paths
let patientHtmlPath = path.join(root, 'patient', 'index.html');
let patientHtml = fs.readFileSync(patientHtmlPath, 'utf8');

// Replace /patient/patient.css with patient.css
patientHtml = patientHtml.replace('href="/patient/patient.css"', 'href="patient.css"');
// Replace /assets/images/logo.png with ../assets/images/logo.png in patient portal
patientHtml = patientHtml.split('src="/assets/images/logo.png"').join('src="../assets/images/logo.png"');
// Add nav__logo-img class to img tags inside logo containers if missing
if (!patientHtml.includes('class="nav__logo-img"')) {
  patientHtml = patientHtml.split('alt="Unmeasurable Heights of Strength Logo"').join('class="nav__logo-img" alt="Unmeasurable Heights of Strength Logo"');
}

fs.writeFileSync(patientHtmlPath, patientHtml, 'utf8');
console.log('Updated patient/index.html');

// 4. Update root HTML files to add nav__logo-img class and remove hardcoded inline styles on buttons
const htmlFiles = fs.readdirSync(root).filter(f => f.endsWith('.html'));
htmlFiles.forEach(file => {
  let p = path.join(root, file);
  let content = fs.readFileSync(p, 'utf8');
  // Remove ad-hoc inline styles on Book Appointment buttons
  content = content.split('style="background:#7c3aed;border-color:#7c3aed;color:#fff;"').join('');
  if (!content.includes('class="nav__logo-img"')) {
    content = content.split('alt="Unmeasurable Heights of Strength Logo"').join('class="nav__logo-img" alt="Unmeasurable Heights of Strength Logo"');
  }
  fs.writeFileSync(p, content, 'utf8');
  console.log(`Cleaned inline styles in ${file}`);
});
