// Frontend Patient Portal Router Initialization
// This file provides client-side routing for the patient portal

(function() {
  'use strict';
  
  const API_BASE_URL = 'https://uhs-backen.onrender.com';
  
  // Simple client-side router for static deployment
  function handleClientSideRouting() {
    const path = window.location.pathname;
    const isPatientRoute = path.startsWith('/patient') || path === '/patient';
    
    if (isPatientRoute) {
      // Load patient portal CSS if not already loaded
      let patientCssLink = document.querySelector('link[href*="patient.css"]');
      if (!patientCssLink) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/patient/patient.css?v=' + Date.now();
        document.head.appendChild(link);
      }
      
      // Load patient portal JS with version to break cache
      const script = document.createElement('script');
      script.src = '/patient/index.html?version=' + Date.now();
      script.onload = function() {
        console.log('Patient portal loaded');
        // Initialize patient portal functionality
        if (typeof loadPatientPortal === 'function') {
          loadPatientPortal();
        }
      };
      document.head.appendChild(script);
      
      // Update nav link highlighting
      setTimeout(() => {
        document.querySelectorAll('.nav__link').forEach(link => {
          link.classList.remove('nav__link--active');
          if (link.getAttribute('href') === '/patient/' || link.getAttribute('href') === '/patient') {
            link.classList.add('nav__link--active');
          }
        });
      }, 100);
    } else {
      // Remove patient CSS if on main site
      const patientCssLink = document.querySelector('link[href*="patient.css"]');
      if (patientCssLink) {
        patientCssLink.remove();
      }
    }
  }
  
  // Initialize router
  document.addEventListener('DOMContentLoaded', handleClientSideRouting);
  
  // Handle browser back/forward navigation
  window.addEventListener('popstate', handleClientSideRouting);
  
  // Make functions globally available
  window.loadPatientPortal = function() {
    console.log('Patient portal functions initialized');
  };
})();