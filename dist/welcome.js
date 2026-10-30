// Reveal the central actions only after the logo and heading have reached the top.
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
    const measure = () => {
      if (!identity.offsetParent) return;
      const top = identity.offsetParent.getBoundingClientRect().top + identity.offsetTop;
      root.style.setProperty('--welcome-rise', `${8 - top}px`);
    };
    measure();
    if (motion.matches) finish();
    root.classList.add('welcome-ready');
    new ResizeObserver(measure).observe(document.querySelector('#empty'));
    try { sessionStorage.setItem(key, '1'); } catch { /* The current page still plays only once. */ }
  }, {once: true});
})();
