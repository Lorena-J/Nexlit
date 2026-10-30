// Reveal the central actions only after the logo and heading have settled above them.
(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const key = 'nexlit-welcome-seen';
  let seen = false;
  try { seen = !!sessionStorage.getItem(key); } catch { /* Storage may be disabled. */ }
  if (!motion.matches && !seen) root.classList.add('welcome-intro');

  const finish = () => {
    root.classList.remove('welcome-intro');
    motion.removeEventListener('change', onMotionChange);
    document.removeEventListener('animationend', onAnimationEnd);
    document.removeEventListener('animationcancel', onAnimationEnd);
  };
  const onMotionChange = () => { if (motion.matches) finish(); };
  const onAnimationEnd = event => {
    if (event.animationName === 'welcome-rise') finish();
  };
  motion.addEventListener('change', onMotionChange);
  document.addEventListener('animationend', onAnimationEnd);
  document.addEventListener('animationcancel', onAnimationEnd);
  document.addEventListener('DOMContentLoaded', () => {
    const identity = document.querySelector('.welcome-identity');
    const actions = document.querySelector('.welcome-actions');
    const measure = () => {
      if (!identity.offsetParent) return;
      const top = identity.offsetParent.getBoundingClientRect().top + identity.offsetTop;
      const scale = parseFloat(getComputedStyle(identity).getPropertyValue('--welcome-final-scale'));
      const destination = Math.max(8, actions.getBoundingClientRect().top - identity.offsetHeight * scale - 16);
      root.style.setProperty('--welcome-rise', `${destination - top}px`);
    };
    measure();
    if (motion.matches) finish();
    root.classList.add('welcome-ready');
    const observer = new ResizeObserver(measure);
    for (const element of [document.querySelector('#empty'), identity, actions]) observer.observe(element);
    try { sessionStorage.setItem(key, '1'); } catch { /* The current page still plays only once. */ }
  }, {once: true});
})();
