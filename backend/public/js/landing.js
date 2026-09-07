/**
 * Public landing page: top-nav section switching (Home/Download) and the
 * photo gallery carousel. Slides are placeholders until real campus photos
 * are added — swap the .gallery-placeholder divs in index.html for <img>
 * tags when photos are ready; this script doesn't need to change.
 */
const navLinks = document.querySelectorAll('.landing-nav-link');
const sections = document.querySelectorAll('.landing-section');

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    const target = link.dataset.section;
    navLinks.forEach((l) => l.classList.remove('active'));
    link.classList.add('active');
    sections.forEach((s) => s.classList.toggle('active', s.id === `section-${target}`));
  });
});

// Photo gallery carousel
const slides = document.querySelectorAll('.gallery-slide');
const dotsContainer = document.getElementById('gallery-dots');
let current = 0;
let autoPlayTimer = null;

function renderDots() {
  dotsContainer.innerHTML = '';
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'gallery-dot' + (i === current ? ' active' : '');
    dot.setAttribute('aria-label', `Go to photo ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    dotsContainer.appendChild(dot);
  });
}

function goTo(index) {
  if (slides.length === 0) return;
  slides[current].classList.remove('active');
  current = (index + slides.length) % slides.length;
  slides[current].classList.add('active');
  renderDots();
}

function restartAutoPlay() {
  if (autoPlayTimer) clearInterval(autoPlayTimer);
  autoPlayTimer = setInterval(() => goTo(current + 1), 5000);
}

document.getElementById('gallery-prev').addEventListener('click', () => {
  goTo(current - 1);
  restartAutoPlay();
});
document.getElementById('gallery-next').addEventListener('click', () => {
  goTo(current + 1);
  restartAutoPlay();
});

if (slides.length > 0) {
  renderDots();
  restartAutoPlay();
}
