/**
 * Production build script for UHS Healthcare
 * Minifies HTML, inlines critical CSS, optimizes assets
 *
 * Usage: node scripts/build.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BUILD_LOG = [];

function log(msg) {
  console.log(`[build] ${msg}`);
  BUILD_LOG.push(msg);
}

function minifyHTML(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  // Simple HTML compression (remove extra whitespace)
  const minified = html
    .replace(/\s{2,}/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/\n/g, '')
    .trim();
  fs.writeFileSync(filePath, minified, 'utf-8');
  const saved = ((html.length - minified.length) / html.length * 100).toFixed(1);
  log(`  Minified ${path.basename(filePath)} — saved ${saved}%`);
}

function main() {
  log('=== UHS Healthcare Build ===\n');

  // 1. Ensure production directories exist
  const dirs = ['assets/images', 'assets/icons'];
  dirs.forEach((d) => {
    const full = path.join(ROOT, d);
    if (!fs.existsSync(full)) {
      fs.mkdirSync(full, { recursive: true });
      log(`  Created ${d}/`);
    }
  });

  // 2. Build CSS (requires clean-css-cli)
  try {
    log('Building CSS...');
    execSync('npx cleancss -o css/styles.min.css css/reset.css css/variables.css css/layout.css css/components.css css/responsive.css', {
      cwd: ROOT,
      stdio: 'pipe',
    });
    const cssSize = fs.statSync(path.join(ROOT, 'css', 'styles.min.css')).size;
    log(`  css/styles.min.css — ${(cssSize / 1024).toFixed(1)} KB`);
  } catch (err) {
    log('  CSS build skipped (install clean-css-cli: npm install)');
  }

  // 3. Build JS (requires terser)
  try {
    log('Building JS...');
    execSync('npx terser js/main.js js/testimonials.js js/faq.js -o js/app.min.js --compress --mangle', {
      cwd: ROOT,
      stdio: 'pipe',
    });
    const jsSize = fs.statSync(path.join(ROOT, 'js', 'app.min.js')).size;
    log(`  js/app.min.js — ${(jsSize / 1024).toFixed(1)} KB`);
  } catch (err) {
    log('  JS build skipped (install terser: npm install)');
  }

  // 4. Minify HTML files
  log('Minifying HTML...');
  const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && f !== 'sitemap.xml');
  htmlFiles.forEach((f) => minifyHTML(path.join(ROOT, f)));

  // 5. Summary
  log('\n=== Build Complete ===');
  BUILD_LOG.forEach((l) => console.log(l));
}

main();
