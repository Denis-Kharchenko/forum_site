(() => {
  const data = JSON.parse(document.getElementById('content-data').textContent);
  const app = document.getElementById('app');
  const statusEl = document.getElementById('status');
  const saveBtn = document.getElementById('save');
  let tab = 'program';
  let dirty = false;

  /* ---------- Помощники ---------- */
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    kids.flat().forEach(c => el.append(c instanceof Node ? c : document.createTextNode(c ?? '')));
    return el;
  };
  const setStatus = (text, type = '') => { statusEl.textContent = text; statusEl.dataset.type = type; };
  const markDirty = () => { dirty = true; setStatus('Есть несохранённые изменения', 'warn'); };

  const input = (obj, key, label, opts = {}) => h('label', { class: 'field' + (opts.wide ? ' field--wide' : '') },
    h('span', {}, label),
    h('input', {
      type: opts.type || 'text', value: obj[key] ?? '', placeholder: opts.placeholder || '', maxlength: opts.max || 200,
      oninput: e => { obj[key] = e.target.value; markDirty(); }
    }));

  const checkbox = (obj, key, label) => h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: !!obj[key], onchange: e => { obj[key] = e.target.checked; markDirty(); render(); } }),
    h('span', {}, label));

  // Кнопки порядка и удаления для элемента списка
  const rowTools = (list, i, what) => h('div', { class: 'row__tools' },
    h('button', { type: 'button', class: 'icon', title: 'Выше', 'aria-label': 'Переместить выше', disabled: i === 0,
      onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; markDirty(); render(); } }, '↑'),
    h('button', { type: 'button', class: 'icon', title: 'Ниже', 'aria-label': 'Переместить ниже', disabled: i === list.length - 1,
      onclick: () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; markDirty(); render(); } }, '↓'),
    h('button', { type: 'button', class: 'icon icon--danger', title: 'Удалить', 'aria-label': 'Удалить ' + what,
      onclick: e => {
        const btn = e.currentTarget;
        if (btn.dataset.confirm) { list.splice(i, 1); markDirty(); render(); return; }
        btn.dataset.confirm = '1'; btn.textContent = 'Удалить?'; btn.classList.add('icon--confirm');
        setTimeout(() => { if (btn.isConnected) { delete btn.dataset.confirm; btn.textContent = '✕'; btn.classList.remove('icon--confirm'); } }, 3000);
      } }, '✕'));

  const upload = async (file, kind) => {
    const fd = new FormData();
    fd.append('action', 'upload'); fd.append('kind', kind); fd.append('csrf', window.CSRF); fd.append('file', file);
    setStatus('Загружаю картинку…');
    const res = await fetch('./', { method: 'POST', body: fd, credentials: 'same-origin' });
    const json = await res.json().catch(() => ({ ok: false, error: 'Ошибка сервера' }));
    if (!json.ok) { setStatus(json.error || 'Не удалось загрузить', 'error'); return null; }
    setStatus('Картинка загружена — не забудьте сохранить', 'warn');
    return json.path;
  };

  const imagePicker = (obj, key, kind, label) => {
    const src = obj[key] ? '../' + obj[key] : '';
    return h('div', { class: 'picker picker--' + kind },
      h('div', { class: 'picker__preview' }, src ? h('img', { src, alt: '', style: obj.invert ? 'filter: invert(1) brightness(1.2); mix-blend-mode: multiply' : null }) : h('span', {}, 'Нет картинки')),
      h('div', { class: 'picker__actions' },
        h('label', { class: 'btn btn--small' }, label,
          h('input', { type: 'file', accept: '.jpg,.jpeg,.png,.webp,.svg', hidden: true,
            onchange: async e => {
              const f = e.target.files[0]; if (!f) return;
              const path = await upload(f, kind);
              if (path) { obj[key] = path; dirty = true; render(); }
            } })),
        obj[key] ? h('button', { type: 'button', class: 'link', onclick: () => { obj[key] = ''; markDirty(); render(); } }, 'Убрать') : ''));
  };

  const section = (title, hint, ...body) => h('section', { class: 'card' },
    h('div', { class: 'card__head' }, h('h2', {}, title), hint ? h('p', { class: 'muted' }, hint) : ''),
    ...body);

  /* ---------- Вкладки ---------- */
  const views = {
    program: () => section('Программа', 'Пункты показываются на сайте в этом порядке.',
      h('div', { class: 'list' }, data.program.map((it, i) => h('div', { class: 'row' },
        h('div', { class: 'row__num' }, String(i + 1)),
        h('div', { class: 'row__fields row__fields--program' },
          input(it, 'time', 'Время', { placeholder: '10:00', max: 20 }),
          input(it, 'title', 'Название', { max: 200 }),
          input(it, 'place', 'Место (необязательно)', { max: 120 })),
        rowTools(data.program, i, 'пункт')))),
      h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { data.program.push({ time: '', title: '', place: '' }); markDirty(); render(); } }, '+ Добавить пункт')),

    speakers: () => [
      section('Спикеры с фото', 'Лучше всего смотрятся 6 спикеров. Фото вертикальное, примерно 4:5.',
        h('div', { class: 'list' }, data.speakers.map((it, i) => h('div', { class: 'row' },
          h('div', { class: 'row__num' }, String(i + 1)),
          imagePicker(it, 'photo', 'speaker', 'Загрузить фото'),
          h('div', { class: 'row__fields' },
            input(it, 'name', 'Имя и фамилия', { max: 120 }),
            input(it, 'role', 'Должность, организация', { max: 200 })),
          rowTools(data.speakers, i, 'спикера')))),
        data.speakers.length < 12
          ? h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { data.speakers.push({ name: '', role: '', photo: '' }); markDirty(); render(); } }, '+ Добавить спикера')
          : ''),
      section('«А также» — списком без фото', '',
        h('div', { class: 'list' }, data.speakers_more.map((it, i) => h('div', { class: 'row' },
          h('div', { class: 'row__num' }, String(i + 1)),
          h('div', { class: 'row__fields' },
            input(it, 'name', 'Имя и фамилия', { max: 120 }),
            input(it, 'role', 'Должность, организация', { max: 200 })),
          rowTools(data.speakers_more, i, 'спикера')))),
        h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { data.speakers_more.push({ name: '', role: '' }); markDirty(); render(); } }, '+ Добавить в список'))
    ],

    partners: () => section('Партнёры', '«Первый ряд» — крупные плитки. Порядок на сайте такой же, как здесь. Скрытые партнёры на сайте не показываются.',
      h('div', { class: 'list' }, data.partners.map((it, i) => h('div', { class: 'row' + (it.hidden ? ' row--muted' : '') },
        h('div', { class: 'row__num' }, String(i + 1)),
        imagePicker(it, 'logo', 'partner', 'Загрузить логотип'),
        h('div', { class: 'row__fields' },
          input(it, 'name', 'Название (для подсказки и поисковиков)', { max: 200, wide: true }),
          h('div', { class: 'checks' },
            checkbox(it, 'main', 'Первый ряд'),
            checkbox(it, 'hidden', 'Скрыть'),
            checkbox(it, 'invert', 'Инвертировать цвета')),
          h('label', { class: 'field field--range' },
            h('span', {}, 'Размер логотипа: ' + it.size + '%'),
            h('input', { type: 'range', min: 20, max: 100, step: 2, value: it.size,
              oninput: e => { it.size = +e.target.value; e.target.previousSibling.textContent = 'Размер логотипа: ' + it.size + '%'; markDirty(); } }))),
        rowTools(data.partners, i, 'партнёра')))),
      h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { data.partners.push({ name: '', logo: '', main: false, hidden: false, size: 60, invert: false }); markDirty(); render(); } }, '+ Добавить партнёра')),

    contacts: () => section('Контакты', 'Пустые поля на сайте не показываются.',
      h('div', { class: 'grid2' },
        input(data.contacts, 'organizer', 'Организатор', { max: 200 }),
        input(data.contacts, 'phone', 'Телефон', { type: 'tel', placeholder: '+7 (812) 000-00-00', max: 40 }),
        input(data.contacts, 'email', 'Email', { type: 'email', max: 120 }),
        input(data.contacts, 'press', 'Email для СМИ и партнёров', { type: 'email', max: 120 }),
        input(data.contacts, 'vk', 'Ссылка на VK', { type: 'url', placeholder: 'https://vk.com/…', max: 500 }),
        input(data.contacts, 'telegram', 'Ссылка на Telegram', { type: 'url', placeholder: 'https://t.me/…', max: 500 })))
  };

  function render() {
    const y = scrollY;
    app.replaceChildren(...[views[tab]()].flat());
    scrollTo(0, y);
  }

  const tabs = document.querySelectorAll('.tab');
  const openTab = (name, scroll = true) => {
    if (!views[name]) return;
    tab = name;
    tabs.forEach(b => b.classList.toggle('is-active', b.dataset.tab === name));
    history.replaceState(null, '', '#' + name); // вкладка сохраняется при обновлении страницы
    if (scroll) scrollTo(0, 0);
    render();
  };
  tabs.forEach(btn => btn.addEventListener('click', () => openTab(btn.dataset.tab)));
  tab = views[location.hash.slice(1)] ? location.hash.slice(1) : tab;
  tabs.forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));

  /* ---------- Сохранение ---------- */
  async function save() {
    saveBtn.disabled = true;
    setStatus('Сохраняю…');
    try {
      const fd = new FormData();
      fd.append('action', 'save'); fd.append('csrf', window.CSRF); fd.append('content', JSON.stringify(data));
      const res = await fetch('./', { method: 'POST', body: fd, credentials: 'same-origin' });
      const json = await res.json().catch(() => ({ ok: false, error: 'Ошибка сервера' }));
      if (!json.ok) { setStatus(json.error || 'Не удалось сохранить', 'error'); return; }
      Object.assign(data, json.content); // сервер вернул очищенные данные
      dirty = false;
      setStatus('Сохранено ' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), 'ok');
      render();
    } catch {
      setStatus('Нет связи с сервером', 'error');
    } finally {
      saveBtn.disabled = false;
    }
  }
  saveBtn.addEventListener('click', save);
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } });
  addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  render();
})();
