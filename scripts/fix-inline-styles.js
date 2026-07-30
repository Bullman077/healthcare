/**
 * Script to replace repeated inline style patterns across HTML files with CSS classes.
 * Run: node scripts/fix-inline-styles.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Files to update
const htmlFiles = [
  'about.html',
  'contact.html',
  'services.html',
  'telehealth.html',
  'appointment.html',
  'privacy.html',
  'terms.html',
];

// Each replacement: [search string, replacement string]
const replacements = [
  // 1. Logo text column div: remove inline styles, use class
  [
    `<div style="display:flex; flex-direction:column; justify-content:center;">`,
    `<div class="nav__logo-text-col">`,
  ],
  // 2. Logo subtitle span (nav)
  [
    `<span style="font-size:0.68rem; font-weight:700; color:var(--color-royal-blue); letter-spacing:0.06em; text-transform:uppercase;">Healthcare Services</span>`,
    `<span class="nav__logo-subtitle">Healthcare Services</span>`,
  ],
  // 3. Logo img: remove redundant inline styles (CSS class already handles it)
  [
    `class="nav__logo-img" alt="Unmeasurable Heights of Strength Logo" style="height:44px; width:auto; border-radius:50%; border:1.5px solid rgba(75,29,109,0.3);"`,
    `class="nav__logo-img" alt="Unmeasurable Heights of Strength Logo"`,
  ],
  // 4. Footer logo img (slightly different height)
  [
    `class="nav__logo-img" alt="Unmeasurable Heights of Strength Logo" style="height:42px; width:auto; border-radius:50%;"`,
    `class="nav__logo-img" alt="Unmeasurable Heights of Strength Logo"`,
  ],
  // 5. Patient Portal link: replace inline styles with CSS class
  [
    `class="btn btn--outline btn--sm" style="border-color:var(--color-plum);color:var(--color-plum);background:rgba(75,29,109,0.08);margin-right:0;" id="patient-portal-link"`,
    `class="btn btn--outline btn--sm btn--patient-portal" id="patient-portal-link"`,
  ],
  // 6. Nav logo title: remove redundant inline style (CSS class handles it)
  [
    `class="nav__logo-title" style="font-size:1.02rem; font-weight:800; color:var(--color-plum); line-height:1.1;"`,
    `class="nav__logo-title"`,
  ],
  // 7. Footer logo title
  [
    `class="nav__logo-title" data-content="clinic_name" style="font-size:1.02rem; font-weight:800; color:var(--color-plum); line-height:1.1;"`,
    `class="nav__logo-title" data-content="clinic_name"`,
  ],
  // 8. Hero section - services/contact pages
  [
    `class="hero" style="min-height:50vh; padding:150px 0 60px;"`,
    `class="hero hero--subpage"`,
  ],
  // 9. Hero section - telehealth page
  [
    `class="hero" style="min-height:55vh; padding:150px 0 60px;"`,
    `class="hero hero--subpage"`,
  ],
  // 10. Hero section - contact page
  [
    `class="hero" style="min-height:45vh; padding:140px 0 50px;"`,
    `class="hero hero--subpage"`,
  ],
  // 11. Footer bottom links
  [
    `<div style="display:flex; gap:1.5rem;">`,
    `<div class="footer-bottom-links">`,
  ],
  // 12. Footer bottom links anchor tags
  [
    `href="privacy.html" style="color:inherit; text-decoration:none;"`,
    `href="privacy.html" class="footer-bottom-link"`,
  ],
  [
    `href="terms.html" style="color:inherit; text-decoration:none;"`,
    `href="terms.html" class="footer-bottom-link"`,
  ],
  // 13. Footer tagline section
  [
    `<div style="text-align:center; padding:1rem 0; border-top:1px solid rgba(255,255,255,0.15); margin-top:0.5rem;">`,
    `<div class="footer-tagline">`,
  ],
  [
    `<span style="font-family:'Dancing Script', cursive; font-size:1.15rem; color:var(--color-gold, #F59E0B);">Rising Above. Empowering Wellness. Serving Our Community.</span>`,
    `<span class="footer-tagline-text">Rising Above. Empowering Wellness. Serving Our Community.</span>`,
  ],
];

let totalChanges = 0;

for (const filename of htmlFiles) {
  const filePath = path.join(ROOT, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠ Skipping (not found): ${filename}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let fileChanges = 0;

  for (const [search, replace] of replacements) {
    if (content.includes(search)) {
      // Replace all occurrences
      const before = content;
      content = content.split(search).join(replace);
      const count = (before.split(search).length - 1);
      if (count > 0) {
        console.log(`  ✓ [${filename}] Replaced ${count}x: "${search.substring(0, 60)}..."`);
        fileChanges += count;
      }
    }
  }

  if (fileChanges > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Saved ${filename} (${fileChanges} replacements)`);
    totalChanges += fileChanges;
  } else {
    console.log(`ℹ No changes needed in ${filename}`);
  }
}

console.log(`\n🎉 Done! Total replacements: ${totalChanges}`);
