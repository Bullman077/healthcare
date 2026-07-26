const path = require('path');
const fs = require('fs');

const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin', 'index.html'), 'utf8');
const patientHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'patient', 'index.html'), 'utf8');

/**
 * Inject CSP nonce into all inline <script> and <style> tags in the HTML string.
 * Replaces <script> with <script nonce="..."> and <style> with <style nonce="...">.
 */
function injectNonce(html, nonce) {
  return html
    .replace(/<script(?! nonce=)(>|\s)/gi, `<script nonce="${nonce}"$1`)
    .replace(/<style(?! nonce=)(>|\s)/gi, `<style nonce="${nonce}"$1`);
}

/**
 * Serve admin and patient HTML with per-request CSP nonces injected.
 * Must be called AFTER cspNonce middleware and Helmet.
 */
function serveSpa(htmlContent, spaName) {
  return (req, res) => {
    const nonce = res.locals.nonce;
    res.set('Content-Type', 'text/html');
    res.send(injectNonce(htmlContent, nonce));
  };
}

module.exports = { serveSpa, adminHtml, patientHtml };
