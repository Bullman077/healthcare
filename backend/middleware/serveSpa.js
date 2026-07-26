const path = require('path');
const fs = require('fs');

/**
 * Inject CSP nonce into all inline <script> and <style> tags in the HTML string.
 * Replaces <script> with <script nonce="..."> and <style> with <style nonce="...">.
 */
function injectNonce(html, nonce) {
  if (!nonce) return html;
  return html
    .replace(/<script(?! nonce=)(>|\s)/gi, `<script nonce="${nonce}"$1`)
    .replace(/<style(?! nonce=)(>|\s)/gi, `<style nonce="${nonce}"$1`);
}

const getAdminHtml = () => fs.readFileSync(path.join(__dirname, '..', 'public', 'admin', 'index.html'), 'utf8');
const getPatientHtml = () => fs.readFileSync(path.join(__dirname, '..', 'public', 'patient', 'index.html'), 'utf8');

/**
 * Serve admin and patient HTML with per-request CSP nonces injected.
 * Must be called AFTER cspNonce middleware and Helmet.
 */
function serveSpa(getHtml, spaName) {
  return (req, res) => {
    const nonce = res.locals.nonce;
    const htmlContent = typeof getHtml === 'function' ? getHtml() : getHtml;
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(injectNonce(htmlContent, nonce));
  };
}

module.exports = { serveSpa, adminHtml: getAdminHtml(), patientHtml: getPatientHtml(), getAdminHtml, getPatientHtml };

