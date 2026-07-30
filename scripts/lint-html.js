const fs = require('fs');
const path = require('path');

const htmlFiles = [];
function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      walk(full);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      htmlFiles.push(full);
    }
  }
}

walk('.');

const errors = [];
const requiredChecks = [
  { name: 'DOCTYPE', pattern: /<!DOCTYPE\s+html/i },
  { name: 'lang attribute', pattern: /lang=["']en["']/ },
  { name: 'charset meta', pattern: /<meta\s+charset=["']UTF-8["']/i },
  { name: 'viewport meta', pattern: /<meta\s+name=["']viewport["']/i },
  { name: 'title tag', pattern: /<title>/i },
  { name: 'closing title', pattern: /<\/title>/i },
];

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const check of requiredChecks) {
    if (!check.pattern.test(content)) {
      errors.push(`${file}: missing ${check.name}`);
    }
  }
  const openDivs = (content.match(/<div/g) || []).length;
  const closeDivs = (content.match(/<\/div>/g) || []).length;
  if (openDivs !== closeDivs) {
    errors.push(`${file}: mismatched div tags (${openDivs} open vs ${closeDivs} close)`);
  }
}

if (errors.length > 0) {
  console.error('HTML lint errors:');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
}

console.log(`All ${htmlFiles.length} HTML files pass linting.`);