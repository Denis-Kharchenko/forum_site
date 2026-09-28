(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Настройки ---------- */
  const FORUM_DATE = new Date('2026-10-23T10:00:00+03:00');
  // Ссылка на регистрацию на платформе Росмолодёжи. Пока пусто — кнопки показывают подсказку.
  const REG_URL = '';

  /* ---------- Header / burger ---------- */
  const header = $('#header');
  const nav = $('#nav');
  const burger = $('#burger');
  const setMenu = open => {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  };
  burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  $$('a', nav).forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  const onScroll = () => header.classList.toggle('is-scrolled', scrollY > 10);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Активный пункт меню ---------- */
  const links = new Map($$('a[href^="#"]:not(.js-reg)', nav).map(a => [a.getAttribute('href').slice(1), a]));
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.classList.remove('is-active'));
      links.get(e.target.id)?.classList.add('is-active');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });

  /* ---------- Подсказка ---------- */
  const toast = $('#toast');
  let toastTimer;
  const showToast = text => {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4000);
  };

  /* ---------- Кнопки регистрации ---------- */
  $$('.js-reg').forEach(a => {
    if (REG_URL) {
      a.href = REG_URL;
      a.target = '_blank';
      a.rel = 'noopener';
    } else {
      a.addEventListener('click', e => {
        e.preventDefault();
        showToast('Регистрация на платформе Росмолодёжи откроется совсем скоро');
      });
    }
  });

  /* ---------- Появление при скролле ---------- */
  const reveals = $$('.reveal');
  // каскад для соседних элементов
  reveals.forEach(el => {
    const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
    const i = sibs.indexOf(el);
    if (i > 0) el.style.setProperty('--d', `${Math.min(i, 8) * 0.06}s`);
  });
  if (reduced || !('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(el => io.observe(el));
  }

  /* ---------- Обратный отсчёт ---------- */
  const cd = { d: $('[data-cd="d"]'), h: $('[data-cd="h"]'), m: $('[data-cd="m"]') };
  const pad = n => String(n).padStart(2, '0');
  const updateCountdown = () => {
    const diff = Math.max(0, FORUM_DATE - Date.now());
    cd.d.textContent = pad(Math.floor(diff / 864e5));
    cd.h.textContent = pad(Math.floor(diff / 36e5) % 24);
    cd.m.textContent = pad(Math.floor(diff / 6e4) % 60);
  };
  updateCountdown();
  setInterval(updateCountdown, 30000);
})();
