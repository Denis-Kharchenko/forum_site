(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Настройки (задаются в админке, приходят со страницы) ---------- */
  const FORUM_DATE = new Date(document.body.dataset.forumStart || '2026-10-23T10:00:00+03:00');

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* приватный режим — не страшно */ } }
  };

  /* ---------- Объявление ---------- */
  const announce = $('#announce');
  const root = document.documentElement;
  if (announce) {
    const key = 'announce-closed-' + announce.dataset.key;
    const setOffset = () => root.style.setProperty('--announce-h', announce.hidden ? '0px' : announce.offsetHeight + 'px');
    if (store.get(key)) announce.hidden = true;
    setOffset();
    addEventListener('resize', setOffset, { passive: true });
    $('.announce__close', announce).addEventListener('click', () => {
      announce.hidden = true;
      store.set(key, '1');
      setOffset();
    });
  }

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
  const links = new Map($$('a[href^="#"]:not(.js-reg):not(.nav__reg)', nav).map(a => [a.getAttribute('href').slice(1), a]));
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

  /* ---------- Кнопки регистрации без ссылки ---------- */
  // Если ссылка задана в админке, кнопки уже ведут на неё; класс js-reg остаётся только у кнопок без ссылки
  $$('.js-reg').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    showToast('Регистрация на платформе Росмолодёжи откроется совсем скоро');
  }));

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
  if (cd.d) {
    const pad = n => String(n).padStart(2, '0');
    const updateCountdown = () => {
      const diff = Math.max(0, FORUM_DATE - Date.now());
      cd.d.textContent = pad(Math.floor(diff / 864e5));
      cd.h.textContent = pad(Math.floor(diff / 36e5) % 24);
      cd.m.textContent = pad(Math.floor(diff / 6e4) % 60);
    };
    updateCountdown();
    setInterval(updateCountdown, 30000);
  }

  /* ---------- Окна (dialog) ---------- */
  const openDialog = d => { d.showModal(); document.body.style.overflow = 'hidden'; };
  $$('dialog').forEach(d => {
    d.addEventListener('close', () => { document.body.style.overflow = ''; d.returnFocusTo?.focus(); });
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
  });

  /* ---------- Спикер: подробнее ---------- */
  const modal = $('#speakerModal');
  const bios = JSON.parse($('#speakers-data')?.textContent || '[]');
  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const openSpeaker = el => {
    const s = bios[+el.dataset.bio];
    if (!s) return;
    const photo = $('#speakerModalPhoto');
    photo.innerHTML = s.photo ? `<img src="${esc(s.photo)}" alt=""${s.pos ? ` style="object-position:${esc(s.pos)}"` : ''}>` : '<svg aria-hidden="true"><use href="#i-person"/></svg>';
    $('.modal__body', modal).classList.toggle('no-photo', !s.photo && !el.closest('.speaker-grid'));
    $('#speakerModalName').textContent = s.name;
    $('#speakerModalRole').textContent = s.role;
    $('#speakerModalBio').innerHTML = s.bio.split(/\n\s*\n/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    modal.returnFocusTo = el;
    openDialog(modal);
  };
  $$('[data-bio]').forEach(el => {
    el.addEventListener('click', () => openSpeaker(el));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSpeaker(el); } });
  });

  /* ---------- Галерея: просмотр фото ---------- */
  const lightbox = $('#lightbox');
  if (lightbox) {
    const items = $$('.gallery__open');
    const img = $('#lightboxImg');
    const cap = $('#lightboxCaption');
    let current = 0;
    const show = i => {
      current = (i + items.length) % items.length;
      const it = items[current];
      img.src = it.dataset.src;
      img.alt = it.dataset.caption || '';
      cap.textContent = it.dataset.caption || '';
      cap.hidden = !it.dataset.caption;
    };
    items.forEach((btn, i) => btn.addEventListener('click', () => { show(i); lightbox.returnFocusTo = btn; openDialog(lightbox); }));
    $$('[data-step]', lightbox).forEach(b => b.addEventListener('click', () => show(current + +b.dataset.step)));
    $$('.lightbox__nav', lightbox).forEach(b => { b.hidden = items.length < 2; });
    lightbox.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') show(current + 1);
      if (e.key === 'ArrowLeft') show(current - 1);
    });
    // свайп на телефоне
    let x0 = null;
    lightbox.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    lightbox.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }
})();
