(function () {
  'use strict';

  var items = document.querySelectorAll('.faq__item');
  if (!items.length) return;

  items.forEach(function (item) {
    var question = item.querySelector('.faq__question');
    var answer = item.querySelector('.faq__answer');

    if (!question || !answer) return;

    question.addEventListener('click', function () {
      var isOpen = item.classList.contains('faq__item--open');

      // Close all items
      items.forEach(function (other) {
        other.classList.remove('faq__item--open');
        var otherBtn = other.querySelector('.faq__question');
        var otherAnswer = other.querySelector('.faq__answer');
        if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        if (otherAnswer) otherAnswer.style.maxHeight = null;
      });

      // Open this one if it was closed
      if (!isOpen) {
        item.classList.add('faq__item--open');
        question.setAttribute('aria-expanded', 'true');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });
})();
