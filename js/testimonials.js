(function () {
  'use strict';

  var track = document.querySelector('.testimonials__track');
  var slides = document.querySelectorAll('.testimonials__slide');
  var prevBtn = document.querySelector('.testimonials__arrow--prev');
  var nextBtn = document.querySelector('.testimonials__arrow--next');
  var dots = document.querySelectorAll('.testimonials__dot');
  var container = document.querySelector('.testimonials');

  if (!track || !slides.length) return;

  var current = 0;
  var total = slides.length;
  var autoplayInterval = null;
  var AUTOPLAY_DELAY = 5000;

  /* ----- Go to slide ----- */
  function goTo(index) {
    if (index < 0) index = 0;
    if (index >= total) index = total - 1;
    current = index;

    track.style.transform = 'translateX(-' + (current * 100) + '%)';

    // Update dots
    dots.forEach(function (dot, i) {
      dot.classList.toggle('testimonials__dot--active', i === current);
    });

    // Update arrows
    if (prevBtn) prevBtn.disabled = current === 0;
    if (nextBtn) nextBtn.disabled = current === total - 1;
  }

  /* ----- Next / Prev ----- */
  function next() {
    if (current < total - 1) goTo(current + 1);
    else goTo(0); // loop
  }

  function prev() {
    if (current > 0) goTo(current - 1);
    else goTo(total - 1); // loop
  }

  /* ----- Autoplay ----- */
  function startAutoplay() {
    stopAutoplay();
    autoplayInterval = setInterval(next, AUTOPLAY_DELAY);
  }

  function stopAutoplay() {
    if (autoplayInterval) {
      clearInterval(autoplayInterval);
      autoplayInterval = null;
    }
  }

  /* ----- Dot click ----- */
  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () {
      goTo(i);
      startAutoplay(); // reset timer
    });
  });

  /* ----- Arrow click ----- */
  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      prev();
      startAutoplay();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      next();
      startAutoplay();
    });
  }

  /* ----- Pause on hover ----- */
  if (container) {
    container.addEventListener('mouseenter', stopAutoplay);
    container.addEventListener('mouseleave', startAutoplay);
    // Touch support
    container.addEventListener('touchstart', stopAutoplay, { passive: true });
    container.addEventListener('touchend', startAutoplay, { passive: true });
  }

  /* ----- Keyboard ----- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { prev(); startAutoplay(); }
    if (e.key === 'ArrowRight') { next(); startAutoplay(); }
  });

  /* ----- Init ----- */
  goTo(0);
  startAutoplay();
})();
