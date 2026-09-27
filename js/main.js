(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Дата форума (заглушка — поменять) ---------- */
  const FORUM_DATE = new Date('2026-11-20T10:00:00+03:00');

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
  const links = new Map($$('a', nav).map(a => [a.getAttribute('href').slice(1), a]));
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.classList.remove('is-active'));
      links.get(e.target.id)?.classList.add('is-active');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });

  /* ---------- Спикеры (заглушки) ---------- */
  const speakers = [
    ['Имя Фамилия', 'Руководитель, организация'],
    ['Имя Фамилия', 'Эксперт по молодёжной политике'],
    ['Имя Фамилия', 'Предприниматель, основатель проекта'],
    ['Имя Фамилия', 'Деятель культуры'],
    ['Имя Фамилия', 'Наставник трека «Команда и лидерство»'],
    ['Имя Фамилия', 'Представитель работодателя'],
    ['Имя Фамилия', 'Учёный, исследователь'],
    ['Имя Фамилия', 'Лидер молодёжного движения'],
  ];
  $('.speaker-grid').innerHTML = speakers.map(([name, role]) => `
    <article class="speaker reveal">
      <div class="speaker__photo"><svg aria-hidden="true"><use href="#i-person"/></svg></div>
      <h4>${name}</h4>
      <p>${role}</p>
    </article>`).join('');

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

  /* ---------- Счётчики ---------- */
  const counters = $$('[data-count]');
  const runCounter = el => {
    const target = +el.dataset.count;
    if (reduced) { el.textContent = target; return; }
    const t0 = performance.now(), dur = 1400;
    const tick = t => {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const cio = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { runCounter(e.target); cio.unobserve(e.target); } });
  }, { threshold: 0.6 });
  counters.forEach(c => cio.observe(c));

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

  /* ---------- Вкладки расписания ---------- */
  const tabs = $$('.tab');
  tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(t => { t.classList.toggle('is-active', t === tab); t.setAttribute('aria-selected', String(t === tab)); });
    $$('[data-day-panel]').forEach(p => { p.hidden = p.dataset.dayPanel !== tab.dataset.day; });
  }));

  /* ---------- Форма (демо) ---------- */
  const form = $('#regForm');
  const validate = input => {
    const field = input.closest('.field');
    if (!field) return input.checkValidity();
    let msg = '';
    if (input.validity.valueMissing) msg = 'Заполните это поле';
    else if (input.validity.typeMismatch) msg = 'Проверьте формат email';
    field.classList.toggle('has-error', !!msg);
    $('.err', field).textContent = msg;
    return !msg;
  };
  $$('input[required]', form).forEach(i => i.addEventListener('blur', () => validate(i)));
  form.addEventListener('submit', e => {
    e.preventDefault();
    const required = $$('input[required]', form);
    const bad = required.filter(i => !validate(i));
    if (bad.length) { bad[0].focus(); return; }
    $('.form__ok', form).hidden = false;
    form.reset();
  });
})();
