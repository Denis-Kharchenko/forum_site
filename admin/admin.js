(() => {
  const data = JSON.parse(document.getElementById('content-data').textContent);
  const app = document.getElementById('app');
  const statusEl = document.getElementById('status');
  const saveBtn = document.getElementById('save');
  let tab = 'settings';
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

  const textarea = (obj, key, label, opts = {}) => h('label', { class: 'field field--wide' },
    h('span', {}, label),
    h('textarea', {
      rows: opts.rows || 4, maxlength: opts.max || 3000, placeholder: opts.placeholder || '',
      oninput: e => { obj[key] = e.target.value; markDirty(); }
    }, obj[key] ?? ''),
    opts.hint ? h('small', { class: 'hint' }, opts.hint) : '');

  const choice = (obj, key, label, options) => h('fieldset', { class: 'field field--wide choice' },
    h('legend', {}, label),
    options.map(([value, title, hint]) => h('label', { class: 'choice__item' + (obj[key] === value ? ' is-active' : '') },
      h('input', { type: 'radio', name: key, value, checked: obj[key] === value, onchange: () => { obj[key] = value; markDirty(); render(); } }),
      h('b', {}, title), hint ? h('small', {}, hint) : '')));

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

  const uploadMany = async (files, kind, onEach) => {
    let done = 0;
    for (const f of files) {
      setStatus(`Загружаю фото ${done + 1} из ${files.length}…`);
      const path = await upload(f, kind);
      if (!path) return; // сообщение об ошибке уже показано
      onEach(path); done++;
    }
    dirty = true;
    setStatus(`Загружено фото: ${done}. Не забудьте сохранить`, 'warn');
    render();
  };

  const section = (title, hint, ...body) => h('section', { class: 'card' },
    h('div', { class: 'card__head' }, h('h2', {}, title), hint ? h('p', { class: 'muted' }, hint) : ''),
    ...body);

  /* ---------- Вкладки ---------- */
  const views = {
    settings: () => [
      section('Событие', 'Дата и время начала управляют таймером на сайте.',
        h('div', { class: 'grid2' },
          input(data.settings, 'date', 'Дата', { type: 'date', max: 10 }),
          h('div', { class: 'grid2 grid2--tight' },
            input(data.settings, 'time_start', 'Начало', { type: 'time', max: 5 }),
            input(data.settings, 'time_end', 'Окончание', { type: 'time', max: 5 })),
          input(data.settings, 'venue', 'Площадка', { max: 120 }),
          input(data.settings, 'address', 'Адрес', { max: 200 })),
        h('p', { class: 'muted small' }, 'Метка на карте стоит на здании «АТС» (Некрасова, 3–5). Если площадка сменится, напишите разработчику — карту нужно перенастроить.')),
      section('Регистрация', 'Ссылка на форму регистрации на платформе Росмолодёжи. Пока поле пустое, кнопки «Зарегистрироваться» показывают «Регистрация откроется совсем скоро».',
        input(data.settings, 'reg_url', 'Ссылка на регистрацию', { type: 'url', placeholder: 'https://…', max: 500, wide: true })),
      section('Режим сайта', '',
        choice(data.settings, 'mode', 'Что показывать', [
          ['before', 'До форума', 'Таймер и кнопки регистрации'],
          ['after', 'Форум прошёл', 'Вместо таймера — благодарность, кнопки ведут к фотографиям. Тексты благодарности — во вкладке «Тексты»']
        ])),
      section('Объявление вверху сайта', 'Красная плашка над меню. Посетитель может её закрыть — после изменения текста она покажется снова.',
        checkbox(data.announcement, 'enabled', 'Показывать объявление'),
        h('div', { class: 'grid2' + (data.announcement.enabled ? '' : ' is-disabled') },
          input(data.announcement, 'text', 'Текст объявления', { max: 200, wide: true, placeholder: 'Регистрация на форум открыта!' }),
          input(data.announcement, 'link_text', 'Текст кнопки (необязательно)', { max: 40, placeholder: 'Зарегистрироваться' }),
          input(data.announcement, 'link_url', 'Ссылка кнопки', { max: 500, placeholder: 'пусто — ссылка на регистрацию' })))
    ],

    texts: () => [
      section('О форуме', 'Пустая строка между абзацами — новый абзац.',
        input(data.texts, 'about_title', 'Подзаголовок (синим после «О форуме —»)', { max: 120, wide: true }),
        textarea(data.texts, 'about_lead', 'Вводный абзац (крупным шрифтом)', { rows: 3, max: 600 }),
        textarea(data.texts, 'about_text', 'Основной текст', { rows: 10, max: 3000 })),
      section('Подписи к разделам', 'Короткие пояснения рядом с заголовками. Пустое поле — подпись не показывается.',
        input(data.texts, 'program_note', 'Под заголовком «Программа»', { max: 200, wide: true }),
        input(data.texts, 'partners_note', 'Рядом с заголовком «Партнёры»', { max: 200, wide: true }),
        input(data.texts, 'speakers_note', 'Рядом с заголовком «Спикеры»', { max: 200, wide: true })),
      section('Синяя карточка в «Контактах»', 'Показывается в режиме «До форума».',
        input(data.texts, 'cta_title', 'Заголовок', { max: 120, wide: true }),
        input(data.texts, 'cta_text', 'Текст', { max: 300, wide: true })),
      section('После форума', 'Показывается в режиме «Форум прошёл»: на первом экране вместо таймера и в синей карточке.',
        input(data.texts, 'thanks_title', 'Заголовок', { max: 120, wide: true }),
        input(data.texts, 'thanks_text', 'Текст', { max: 300, wide: true }))
    ],

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
            input(it, 'role', 'Должность, организация', { max: 200 }),
            textarea(it, 'bio', 'Описание (необязательно)', { rows: 3, max: 1500, hint: 'Если заполнено — на сайте карточка открывается по клику' })),
          rowTools(data.speakers, i, 'спикера')))),
        data.speakers.length < 12
          ? h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { data.speakers.push({ name: '', role: '', photo: '', bio: '' }); markDirty(); render(); } }, '+ Добавить спикера')
          : ''),
      section('«А также» — списком без фото', '',
        h('div', { class: 'list' }, data.speakers_more.map((it, i) => h('div', { class: 'row' },
          h('div', { class: 'row__num' }, String(i + 1)),
          h('div', { class: 'row__fields' },
            input(it, 'name', 'Имя и фамилия', { max: 120 }),
            input(it, 'role', 'Должность, организация', { max: 200 }),
            textarea(it, 'bio', 'Описание (необязательно)', { rows: 2, max: 1500 })),
          rowTools(data.speakers_more, i, 'спикера')))),
        h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { data.speakers_more.push({ name: '', role: '', bio: '' }); markDirty(); render(); } }, '+ Добавить в список'))
    ],

    partners: () => section('Партнёры', '«Первый ряд» — крупные плитки. Порядок на сайте такой же, как здесь. Скрытые партнёры на сайте не показываются.',
      h('div', { class: 'list' }, data.partners.map((it, i) => h('div', { class: 'row' + (it.hidden ? ' row--muted' : '') },
        h('div', { class: 'row__num' }, String(i + 1)),
        imagePicker(it, 'logo', 'partner', 'Загрузить логотип'),
        h('div', { class: 'row__fields' },
          input(it, 'name', 'Название (показывается при наведении)', { max: 200, wide: true }),
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

    gallery: () => section('Галерея', 'Блок «Фото с форума» появится на сайте, как только здесь будет хотя бы одно фото. Можно выбрать сразу несколько файлов. Большие фото уменьшаются автоматически.',
      h('label', { class: 'btn' }, '+ Загрузить фото',
        h('input', { type: 'file', accept: '.jpg,.jpeg,.png,.webp', multiple: true, hidden: true,
          onchange: e => uploadMany([...e.target.files], 'gallery', path => data.gallery.push({ src: path, caption: '' })) })),
      data.gallery.length
        ? h('div', { class: 'gallery-admin' }, data.gallery.map((it, i) => h('div', { class: 'gallery-admin__item' },
            h('div', { class: 'gallery-admin__img' }, it.src ? h('img', { src: '../' + it.src, alt: '' }) : ''),
            input(it, 'caption', 'Подпись', { max: 200 }),
            rowTools(data.gallery, i, 'фото'))))
        : h('p', { class: 'muted' }, 'Фото пока нет.')),

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
      // Поля, которые сервер не принял (например, неверная ссылка или email), не должны пропадать молча
      const rejected = [
        [data.settings.reg_url, json.content.settings.reg_url, 'ссылка на регистрацию'],
        [data.announcement.link_url, json.content.announcement.link_url, 'ссылка кнопки объявления'],
        [data.contacts.vk, json.content.contacts.vk, 'ссылка на VK'],
        [data.contacts.telegram, json.content.contacts.telegram, 'ссылка на Telegram'],
        [data.contacts.email, json.content.contacts.email, 'email'],
        [data.contacts.press, json.content.contacts.press, 'email для СМИ']
      ].filter(([sent, saved]) => String(sent || '').trim() !== '' && !saved).map(([, , name]) => name);
      Object.assign(data, json.content); // сервер вернул очищенные данные
      dirty = false;
      const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      if (rejected.length) setStatus(`Сохранено ${time}, но не принято: ${rejected.join(', ')} — проверьте, что написано без ошибок`, 'error');
      else setStatus('Сохранено ' + time, 'ok');
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
