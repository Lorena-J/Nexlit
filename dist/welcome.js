// Set the initial state before the welcome markup paints. Without JS, show the final view.
(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const key = 'nexlit-welcome-seen';
  if (motion.matches) return;
  try { if (sessionStorage.getItem(key)) return; } catch { /* Storage may be disabled. */ }

  root.classList.add('welcome-intro');
  const finish = () => {
    root.classList.remove('welcome-intro', 'welcome-intro-ready');
    motion.removeEventListener('change', onMotionChange);
    document.removeEventListener('animationend', onAnimationEnd);
    document.removeEventListener('animationcancel', onAnimationEnd);
  };
  const onMotionChange = () => { if (motion.matches) finish(); };
  const onAnimationEnd = event => {
    if (event.animationName === 'welcome-reveal') finish();
  };
  motion.addEventListener('change', onMotionChange);
  document.addEventListener('animationend', onAnimationEnd);
  document.addEventListener('animationcancel', onAnimationEnd);
  document.addEventListener('DOMContentLoaded', () => {
    if (motion.matches) return finish();
    const area = document.querySelector('.universe').getBoundingClientRect();
    const mark = document.querySelector('.welcome-mark').getBoundingClientRect();
    root.style.setProperty('--welcome-offset', `${area.top + area.height / 2 - mark.top - mark.height / 2}px`);
    root.classList.add('welcome-intro-ready');
    // Keep navigation home and reloads in this tab from replaying the introduction.
    try { sessionStorage.setItem(key, '1'); } catch { /* The current page still plays only once. */ }
  }, {once: true});
})();
