/**
 * Script to fix inline styles in index.html
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const filename = 'index.html';
const filePath = path.join(ROOT, filename);

let content = fs.readFileSync(filePath, 'utf8');
let changes = 0;

const replacements = [
  [
    `<div style="display:flex; flex-direction:column; justify-content:center;">`,
    `<div class="nav__logo-text-col">`,
  ],
  [
    `<span style="font-size:0.68rem; font-weight:700; color:var(--color-royal-blue); letter-spacing:0.06em; text-transform:uppercase;">Healthcare Services</span>`,
    `<span class="nav__logo-subtitle">Healthcare Services</span>`,
  ],
  [
    `class="nav__logo-img" alt="Unmeasurable Heights of Strength Logo" style="height:44px; width:auto; border-radius:50%; border:1.5px solid rgba(75,29,109,0.3);"`,
    `class="nav__logo-img" alt="Unmeasurable Heights of Strength Logo"`,
  ],
  [
    `class="nav__logo-img" alt="Unmeasurable Heights of Strength Logo" style="height:42px; width:auto; border-radius:50%;"`,
    `class="nav__logo-img" alt="Unmeasurable Heights of Strength Logo"`,
  ],
  [
    `class="btn btn--outline btn--sm" style="border-color:var(--color-plum);color:var(--color-plum);background:rgba(75,29,109,0.08);margin-right:0;" id="patient-portal-link"`,
    `class="btn btn--outline btn--sm btn--patient-portal" id="patient-portal-link"`,
  ],
  [
    `class="nav__logo-title" style="font-size:1.02rem; font-weight:800; color:var(--color-plum); line-height:1.1;"`,
    `class="nav__logo-title"`,
  ],
  [
    `class="nav__logo-title" data-content="clinic_name" style="font-size:1.02rem; font-weight:800; color:var(--color-plum); line-height:1.1;"`,
    `class="nav__logo-title" data-content="clinic_name"`,
  ],
  [
    `<div style="display:flex; gap:1.5rem;">`,
    `<div class="footer-bottom-links">`,
  ],
  [
    `href="privacy.html" style="color:inherit; text-decoration:none;"`,
    `href="privacy.html" class="footer-bottom-link"`,
  ],
  [
    `href="terms.html" style="color:inherit; text-decoration:none;"`,
    `href="terms.html" class="footer-bottom-link"`,
  ],
  [
    `<div style="text-align:center; padding:1rem 0; border-top:1px solid rgba(255,255,255,0.15); margin-top:0.5rem;">`,
    `<div class="footer-tagline">`,
  ],
  [
    `<span style="font-family:'Dancing Script', cursive; font-size:1.15rem; color:var(--color-gold, #F59E0B);">Rising Above. Empowering Wellness. Serving Our Community.</span>`,
    `<span class="footer-tagline-text">Rising Above. Empowering Wellness. Serving Our Community.</span>`,
  ],
];

for (const [search, replace] of replacements) {
  if (content.includes(search)) {
    const count = content.split(search).length - 1;
    content = content.split(search).join(replace);
    console.log(`  ✓ Replaced ${count}x: "${search.substring(0, 70)}..."`);
    changes += count;
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\n✅ Saved index.html (${changes} replacements)`);
