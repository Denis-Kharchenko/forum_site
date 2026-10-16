/* Админка сайта → «Навигация и подробная программа». Перенесено из admin.html проекта навигации:
   программа хранится на сервере (data/schedule.json), сохраняется запросом к navigation.php. */
const SAVE_URL = 'navigation.php';
const KINDS = ['Лекция', 'Кейс-лекция', 'Мастер-класс', 'Тренинг', 'Воркшоп', 'Пленарная сессия', 'Дискуссия', 'Общее'];
const OTHER = '__other';
const ALL = 'all';
const DEFAULT_TRACKS = [
  { id: 't1', name: 'Трек 1', color: '#2450EC' },
  { id: 't2', name: 'Трек 2', color: '#D00B12' },
  { id: 't3', name: 'Трек 3', color: '#6E35D8' },
  { id: 't4', name: 'Трек 4', color: '#0E7C70' },
  { id: 't5', name: 'Трек 5', color: '#C45A00' },
];
// Цвета для новых треков (по порядку, пропуская уже занятые)
const PALETTE = ['#2450EC', '#D00B12', '#6E35D8', '#0E7C70', '#C45A00', '#B0247A', '#3B6E0A', '#0B5FA5'];
const MAX_TRACKS = 8;   // больше не помещается в шапку программы на стойке
let tracks = DEFAULT_TRACKS.map(t => ({ ...t }));
let trackTab = ALL;   // какой трек показан в таблице
const trackColor = id => tracks.find(t => t.id === id)?.color || '#9a9aa5';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };

// Названия и штриховка помещений (из data/schedule.js → rooms). Поворот этажей — один раз
let roomsOv = {};
prepareRooms(roomsOv);
const roomById = id => ROOMS.find(r => r.id === id);
const FLOOR_IDS = Object.keys(FLOORS).map(Number);
const floorName = f => FLOORS[f].label || `${f} этаж`;
const roomLabel = r => r.title + (r.sub && r.type === 'hall' ? ' · ' + r.sub : '');
// Места, которые можно выбрать: незаштрихованные помещения
const places = () => ROOMS.filter(r => r.list).map(r => ({ id: r.id, floor: r.floor, name: roomLabel(r) }));
const placeName = it => it.room ? (roomById(it.room)?.title || it.room) : (it.place || '');

let version = '', dirty = false;   // version — метка последнего сохранения, по ней сервер замечает чужие правки

/* ---------- Статус ---------- */
function setStatus(text, kind = 'ok') {
  const s = $('#status');
  s.textContent = text; s.className = 'status status--' + kind; s.hidden = !text;
}
function setDirty(v) {
  dirty = v;
  if (v) { setStatus('Есть несохранённые изменения', 'warn'); saveDraft(); }
}

/* ---------- Черновик: несохранённые правки живут в этом браузере, пока их не сохранят ---------- */
const DRAFT_KEY = 'forum-nav-draft';
let draftTimer = null;
function saveDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), data: readAll() })); } catch {} }, 800);
}
function clearDraft() {
  clearTimeout(draftTimer);
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
  $('#draft').hidden = true;
}
let pendingDraft = null;
function offerDraft() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch {}
  if (!d || !d.data) return;
  const same = (a, b) => JSON.stringify([a.date, a.tracks, a.rooms, a.items]) === JSON.stringify([b.date, b.tracks, b.rooms, b.items]);
  if (same(d.data, readAll())) { clearDraft(); return; }
  pendingDraft = d.data;
  const when = new Date(d.at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  $('#draftText').textContent = `Есть несохранённый черновик от ${when}. Восстановить его?`;
  $('#draft').hidden = false;
}
$('#btnDraftRestore').addEventListener('click', () => {
  if (!pendingDraft) return;
  fill(pendingDraft); setDirty(true); $('#draft').hidden = true;
  setStatus('Черновик восстановлен — не забудьте сохранить', 'warn');
});
$('#btnDraftDrop').addEventListener('click', () => { if (confirm('Удалить черновик? Эти правки пропадут.')) clearDraft(); });
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- Файл программы для «Скачать файл» ---------- */
function buildFile(data) {
  const items = data.items.map(it => '    ' + JSON.stringify(it)).join(',\n');
  return `/* Программа форума. Копия из админки сайта (admin/navigation.php). */
window.FORUM_SCHEDULE = {
  "date": ${JSON.stringify(data.date)},
  "updated": ${JSON.stringify(new Date().toISOString())},
  "tracks": [
${data.tracks.map(t => '    ' + JSON.stringify(t)).join(',\n')}
  ],
  "rooms": {
${Object.entries(data.rooms || {}).map(([id, o]) => '    ' + JSON.stringify(id) + ': ' + JSON.stringify(o)).join(',\n')}
  },
  "items": [
${items}
  ]
};
`;
}

/* ---------- Запросы к серверу ---------- */
async function api(body) {
  const fd = new FormData();
  Object.entries(body).forEach(([k, v]) => fd.append(k, v));
  let res;
  try {
    res = await fetch(SAVE_URL, { method: 'POST', body: fd, headers: { 'X-CSRF-Token': window.CSRF }, credentials: 'same-origin', cache: 'no-store' });
  } catch { const err = new Error('network'); err.network = true; throw err; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) { const err = new Error(data.error || res.statusText); err.status = res.status; throw err; }
  return data;
}
const explain = e =>
  e.status === 401 ? 'Сессия закончилась. Войдите заново в соседней вкладке (/admin/) и нажмите «Сохранить» ещё раз — правки не пропадут.' :
  e.status === 409 ? 'Пока вы редактировали, программу сохранил кто-то другой.' :
  e.network ? (navigator.onLine === false
    ? 'Нет интернета. Подключитесь к сети и попробуйте ещё раз.'
    : 'Не удалось связаться с сайтом. Изменения не потеряны: попробуйте ещё раз или «Скачать файл».') :
  e.message || 'Не удалось сохранить';

async function loadRemote() {
  setStatus('Загрузка…', 'warn');
  const { schedule } = await api({ action: 'load' });
  version = schedule.updated;
  fill(schedule);
  setDirty(false);
  setStatus('Загружена актуальная версия', 'ok');
}

/* ---------- Таблица ---------- */
function placeSelect(it) {
  const list = places(), cur = it.room && roomById(it.room);
  // помещение заштриховано, но в записи выбрано — оставляем в списке, чтобы не потерять
  if (cur && !cur.list) list.push({ id: cur.id, floor: cur.floor, name: roomLabel(cur) + ' (заштриховано)' });
  const byFloor = f => list.filter(p => p.floor === f)
    .map(p => `<option value="${p.id}"${it.room === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
  const isOther = !it.room && it.place;
  return `<select data-f="room">
      <option value=""${!it.room && !it.place ? ' selected' : ''}>— выберите —</option>
      ${FLOOR_IDS.map(f => `<optgroup label="${esc(floorName(f))}">${byFloor(f)}</optgroup>`).join('')}
      <option value="${OTHER}"${isOther ? ' selected' : ''}>Другое место…</option>
    </select>
    <input class="other" data-f="place" placeholder="Например: Лобби" value="${esc(it.place)}"${isOther ? '' : ' hidden'}>`;
}
function trackCell(it) {
  const all = (it.track || ALL) === ALL;
  const cur = all ? (trackTab !== ALL ? trackTab : tracks[0].id) : it.track;
  return `<select data-f="track"${all ? ' disabled' : ''}>${tracks.map(t => `<option value="${t.id}"${t.id === cur ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
    <label class="all-check"><input type="checkbox" data-f="all"${all ? ' checked' : ''}> Применить ко всем трекам</label>`;
}
function rowHTML(it = {}) {
  const tr = it.track || ALL;
  return `<tr style="--c:${tr === ALL ? '#9a9aa5' : trackColor(tr)}">
    <td class="num"></td>
    <td><input type="time" data-f="start" value="${esc(it.start)}" required></td>
    <td><input type="time" data-f="end" value="${esc(it.end)}"></td>
    <td>${trackCell(it)}</td>
    <td><select data-f="kind">${KINDS.map(k => `<option${(it.kind || 'Лекция') === k ? ' selected' : ''}>${k}</option>`).join('')}</select></td>
    <td><input data-f="title" value="${esc(it.title)}" placeholder="Название лекции" required></td>
    <td><input data-f="speaker" value="${esc(it.speaker)}" placeholder="Имя, должность"></td>
    <td>${placeSelect(it)}</td>
    <td><div class="row-acts">
      <button type="button" class="dup" aria-label="Копировать запись" title="Копировать: такая же запись сразу после этой"><svg class="ico"><use href="#i-copy"/></svg></button>
      <button type="button" class="del" aria-label="Удалить запись" title="Удалить"><svg class="ico"><use href="#i-trash"/></svg></button>
    </div></td>
  </tr>`;
}
function renderTracks() {
  $('#tracksEdit').innerHTML = tracks.map((t, i) => `<div class="track-edit">
      <span class="track-pos" aria-hidden="true">${i + 1}</span>
      <input type="color" value="${esc(t.color)}" data-t="${i}" data-k="color" aria-label="Цвет: ${esc(t.name)}">
      <input type="text" value="${esc(t.name)}" data-t="${i}" data-k="name" aria-label="Название трека ${i + 1}" maxlength="40">
      <button type="button" class="move" data-move-track="${i}" data-dir="-1" aria-label="Сдвинуть трек «${esc(t.name)}» раньше" title="Раньше"${i === 0 ? ' disabled' : ''}><svg class="ico"><use href="#i-left"/></svg></button>
      <button type="button" class="move" data-move-track="${i}" data-dir="1" aria-label="Сдвинуть трек «${esc(t.name)}» позже" title="Позже"${i === tracks.length - 1 ? ' disabled' : ''}><svg class="ico"><use href="#i-right"/></svg></button>
      <button type="button" class="del" data-del-track="${i}" aria-label="Удалить трек ${esc(t.name)}"${tracks.length <= 1 ? ' disabled' : ''}><svg class="ico"><use href="#i-trash"/></svg></button>
    </div>`).join('');
  $('#btnAddTrack').disabled = tracks.length >= MAX_TRACKS;
  renderTabs();
  if (view === 'grid') renderGrid();
}
// После добавления или удаления трека — пересобрать выбор трека в строках, сохранив выбранное
function refreshTrackCells() {
  $$('#rows tr').forEach(tr => {
    const it = readRow(tr);
    tr.querySelector('[data-f="track"]').closest('td').innerHTML = trackCell(it);
    tr.style.setProperty('--c', it.track === ALL ? '#9a9aa5' : trackColor(it.track));
  });
}
function renderTabs() {
  const count = id => $$('#rows tr').filter(tr => readRow(tr).track === id).length;
  $('#trackTabs').innerHTML = [{ id: ALL, name: 'Все треки' }, ...tracks].map(t =>
    `<button type="button" class="ttab" role="tab" style="${t.color ? esc(trackVars(t.color)) : ''}" aria-selected="${trackTab === t.id}" data-tab="${t.id}">${esc(t.name)}<small>${t.id === ALL ? $$('#rows tr').length : count(t.id)}</small></button>`).join('');
}
function fill(data) {
  roomsOv = JSON.parse(JSON.stringify(data.rooms || {}));
  prepareRooms(roomsOv);
  renderRoomsEditor();
  if (data.tracks && data.tracks.length) tracks = data.tracks.map(t => ({ ...t }));
  renderTracks();
  $('#evDate').value = data.date || '';
  $('#rows').innerHTML = (data.items || []).map(rowHTML).join('');
  refresh();
}
function readRow(tr) {
  const v = f => tr.querySelector(`[data-f="${f}"]`).value.trim();
  const room = v('room');
  return {
    start: v('start'), end: v('end'), kind: v('kind'), title: v('title'), speaker: v('speaker'),
    room: room === OTHER ? '' : room,
    place: room === OTHER ? v('place') : '',
    track: tr.querySelector('[data-f="all"]').checked ? ALL : v('track'),
  };
}
const readAll = () => ({ date: $('#evDate').value, tracks: tracks.map(t => ({ ...t, name: t.name.trim() || t.id })), rooms: roomsDiff(), items: $$('#rows tr').map(readRow) });

/* ---------- Проверки ---------- */
function validate() {
  const rows = $$('#rows tr'), items = rows.map(readRow), issues = [];
  rows.forEach((tr, i) => { tr.querySelectorAll('td').forEach(td => td.classList.remove('bad')); tr.cells[0].textContent = i + 1; });
  const mark = (i, f) => rows[i].querySelector(`[data-f="${f}"]`).closest('td').classList.add('bad');
  // замечание о строке — ссылка: по нажатию админка показывает строку и ставит курсор в нужное поле
  const at = (i, f, text) => issues.push({ text, row: i, f });
  items.forEach((it, i) => {
    const n = `Строка ${i + 1}`;
    if (!it.start) { mark(i, 'start'); at(i, 'start', `${n}: не указано время начала`); }
    if (!it.title) { mark(i, 'title'); at(i, 'title', `${n}: не указано название`); }
    if (it.start && it.end && toMin(it.end) <= toMin(it.start)) { mark(i, 'end'); at(i, 'end', `${n}: конец раньше начала`); }
    if (!it.room && !it.place) { mark(i, 'room'); at(i, 'room', `${n}: не выбрано место`); }
    if (it.room && roomById(it.room) && !roomById(it.room).list) { mark(i, 'room'); at(i, 'room', `${n}: «${placeName(it)}» заштриховано на плане — на стойке не будет маршрута`); }
  });
  // Пересечения в одном зале
  items.forEach((a, i) => items.forEach((b, j) => {
    if (j <= i || !a.room || a.room !== b.room || !a.start || !b.start) return;
    const a1 = toMin(a.start), a2 = a.end ? toMin(a.end) : a1 + 1, b1 = toMin(b.start), b2 = b.end ? toMin(b.end) : b1 + 1;
    if (a1 < b2 && b1 < a2) {
      mark(i, 'room'); mark(j, 'room');
      at(j, 'room', `Строки ${i + 1} и ${j + 1}: «${placeName(a)}» занят в одно время`);
    }
  }));
  tracks.forEach((t, i) => { if (!t.name.trim()) issues.push({ text: `Трек ${i + 1}: не указано название`, track: i }); });
  $('#issues').innerHTML = issues.map((t, k) => `<li><button type="button" data-issue="${k}">${esc(t.text)}</button></li>`).join('');
  lastIssues = issues;
  $('#issues').hidden = !issues.length;
  return issues;
}

let lastIssues = [];
$('#issues').addEventListener('click', e => {
  const b = e.target.closest('[data-issue]');
  if (!b) return;
  const it = lastIssues[+b.dataset.issue];
  if (it.track !== undefined) { $$('#tracksEdit input[type=text]')[it.track]?.focus(); return; }
  const tr = $$('#rows tr')[it.row];
  if (!tr) return;
  if (tr.classList.contains('is-hidden')) {   // строка скрыта фильтром — сбрасываем фильтры
    trackTab = ALL; $('#filter').value = 'all'; $('#search').value = ''; applyFilter();
  }
  tr.scrollIntoView({ block: 'center', behavior: 'smooth' });
  tr.querySelector(`[data-f="${it.f}"]`)?.focus({ preventScroll: true });
});

function refresh() {
  const n = $$('#rows tr').length;
  $('#empty').hidden = n > 0;
  $('#counter').textContent = n ? `Записей: ${n}` : '';
  // фильтр по месту
  const cur = $('#filter').value || 'all';
  $('#filter').innerHTML = `<option value="all">Все места</option>` +
    places().map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('') + `<option value="${OTHER}">Другие места</option>`;
  $('#filter').value = cur;
  applyFilter();
  validate();
  if (view === 'grid') renderGrid();
}
function applyFilter() {
  const f = $('#filter').value, q = $('#search').value.trim().toLowerCase();
  $$('#rows tr').forEach(tr => {
    const it = readRow(tr);
    const byPlace = f !== 'all' && (f === OTHER ? !!it.room : it.room !== f);
    const byTrack = trackTab !== ALL && it.track !== ALL && it.track !== trackTab;
    const byText = q && !(it.title + ' ' + it.speaker).toLowerCase().includes(q);
    tr.classList.toggle('is-hidden', byPlace || byTrack || byText);
  });
  renderTabs();
}
function sortRows() {
  const data = readAll();
  data.items.sort((a, b) => (toMin(a.start) || 0) - (toMin(b.start) || 0) || placeName(a).localeCompare(placeName(b), 'ru'));
  fill(data);
}

/* ---------- События таблицы ---------- */
$('#rows').addEventListener('input', () => { setDirty(true); validate(); });
$('#rows').addEventListener('change', e => {
  if (e.target.dataset.f === 'all' || e.target.dataset.f === 'track') {
    const tr = e.target.closest('tr'), sel = tr.querySelector('[data-f="track"]');
    sel.disabled = tr.querySelector('[data-f="all"]').checked;
    const it = readRow(tr);
    tr.style.setProperty('--c', it.track === ALL ? '#9a9aa5' : trackColor(it.track));
    applyFilter();
  }
  if (e.target.dataset.f === 'room') {
    const other = e.target.parentElement.querySelector('.other');
    other.hidden = e.target.value !== OTHER;
    if (!other.hidden) other.focus();
  }
  setDirty(true); validate();
});
$('#rows').addEventListener('click', e => {
  const d = e.target.closest('.dup');
  if (d) {
    // копия встаёт сразу после записи и начинается, когда та заканчивается (той же длительности)
    const tr = d.closest('tr'), it = readRow(tr);
    const pad = n => String(n).padStart(2, '0'), fmt = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
    if (it.start && it.end) { const len = toMin(it.end) - toMin(it.start); it.start = it.end; it.end = len > 0 ? fmt(toMin(it.end) + len) : ''; }
    tr.insertAdjacentHTML('afterend', rowHTML(it));
    const copy = tr.nextElementSibling;
    copy.classList.add('is-new');
    setDirty(true); refresh();
    const title = copy.querySelector('[data-f="title"]');
    title.focus(); title.select();
    return;
  }
  const b = e.target.closest('.del');
  if (!b) return;
  const tr = b.closest('tr'), title = readRow(tr).title || 'без названия';
  if (!confirm(`Удалить запись «${title}»?`)) return;
  tr.remove(); setDirty(true); refresh();
});
$('#btnAdd').addEventListener('click', () => {
  const last = $$('#rows tr').at(-1);
  const prev = last ? readRow(last) : {};
  const f = $('#filter').value;
  // новая запись начинается там, где закончилась предыдущая, и в выбранном в фильтре зале
  $('#rows').insertAdjacentHTML('beforeend', rowHTML({
    start: prev.end || '', room: f !== 'all' && f !== OTHER ? f : '',
    track: trackTab !== ALL ? trackTab : (prev.track && prev.track !== ALL ? prev.track : tracks[0].id),
  }));
  setDirty(true); refresh();
  $$('#rows tr').at(-1).querySelector('[data-f="title"]').focus();
});
$('#evDate').addEventListener('input', () => setDirty(true));
$('#tracksEdit').addEventListener('input', e => {
  const i = +e.target.dataset.t, k = e.target.dataset.k;
  if (Number.isNaN(i)) return;
  tracks[i][k] = e.target.value;
  const id = tracks[i].id;
  // обновить названия в выпадающих списках и цвет строк этого трека
  $$(`#rows [data-f="track"] option[value="${id}"]`).forEach(o => { o.textContent = tracks[i].name; });
  $$('#rows tr').forEach(tr => { if (readRow(tr).track === id) tr.style.setProperty('--c', tracks[i].color); });
  renderTabs(); setDirty(true); validate();
  if (view === 'grid') renderGrid();
});
$('#btnAddTrack').addEventListener('click', () => {
  if (tracks.length >= MAX_TRACKS) return;
  let n = 1;
  while (tracks.some(t => t.id === 't' + n)) n++;
  const color = PALETTE.find(c => !tracks.some(t => t.color.toLowerCase() === c.toLowerCase())) || PALETTE[n % PALETTE.length];
  tracks.push({ id: 't' + n, name: 'Трек ' + (tracks.length + 1), color });
  renderTracks(); refreshTrackCells(); setDirty(true); validate();
  $$('#tracksEdit input[type=text]').at(-1).select();
});
$('#tracksEdit').addEventListener('click', e => {
  // Порядок треков: так же они идут в навигации, на стойках и столбцами в таблице
  const m = e.target.closest('[data-move-track]');
  if (m) {
    const i = +m.dataset.moveTrack, j = i + +m.dataset.dir;
    if (j < 0 || j >= tracks.length) return;
    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    renderTracks(); refreshTrackCells(); setDirty(true); validate();
    // фокус остаётся на той же кнопке у сдвинутого трека (если она стала неактивной — на соседней)
    const same = $(`#tracksEdit [data-move-track="${j}"][data-dir="${m.dataset.dir}"]`);
    (same && !same.disabled ? same : $(`#tracksEdit [data-move-track="${j}"][data-dir="${-m.dataset.dir}"]`))?.focus();
    return;
  }
  const b = e.target.closest('[data-del-track]');
  if (!b || tracks.length <= 1) return;
  const t = tracks[+b.dataset.delTrack];
  const rows = $$('#rows tr').filter(tr => readRow(tr).track === t.id);
  const msg = rows.length
    ? `Удалить трек «${t.name}» вместе с его записями (${rows.length})? Записи «Применить ко всем трекам» останутся.`
    : `Удалить трек «${t.name}»?`;
  if (!confirm(msg)) return;
  rows.forEach(tr => tr.remove());
  tracks = tracks.filter(x => x !== t);
  if (trackTab === t.id) trackTab = ALL;
  renderTracks(); refreshTrackCells(); setDirty(true); refresh();
});
$('#trackTabs').addEventListener('click', e => {
  const b = e.target.closest('.ttab');
  if (!b) return;
  trackTab = b.dataset.tab;
  applyFilter();
});
$('#filter').addEventListener('change', applyFilter);
$('#search').addEventListener('input', applyFilter);

/* ---------- Таблица: та же программа сеткой «время × треки», как в общей программе (Excel) ----------
   Строка — интервал «начало–конец», столбец — трек. Одинаковые записи в соседних треках показываются
   одной ячейкой на несколько столбцов, запись «для всех треков» — на всю строку.
   Правка в таблице меняет записи списка, поэтому навигация, стойки и сайт получают её после «Сохранить».
   Тот же расчёт на сайте — lib/schedule.php → schedule_grid(). */
let view = 'list';
let extraSlots = [];    // строки времени, добавленные в таблице, пока в них нет ни одной записи
let gridItems = [], gridRefs = [];
const sig = it => JSON.stringify([it.kind, it.title, it.speaker, it.room, it.place]);
const byTime = (a, b) => (toMin(a.start) || 0) - (toMin(b.start) || 0) || (a.end ? toMin(a.end) : 0) - (b.end ? toMin(b.end) : 0);

function buildGrid(items) {
  const ids = tracks.map(t => t.id), slots = new Map();
  const slot = (start, end) => {
    const k = start + '|' + end;
    if (!slots.has(k)) slots.set(k, { start, end, all: [], by: {} });
    return slots.get(k);
  };
  items.forEach((it, i) => {
    if (!it.start) return;
    const s = slot(it.start, it.end);
    if (it.track === ALL) s.all.push(i);
    else if (ids.includes(it.track)) (s.by[it.track] ||= []).push(i);
  });
  extraSlots.forEach(s => slot(s.start, s.end));
  const rows = [...slots.values()].sort(byTime);
  const cellSig = list => list.map(i => sig(items[i])).join('\n');
  rows.forEach(r => {
    r.cells = [];
    for (let c = 0; c < ids.length; c++) {
      const list = r.by[ids[c]] || [], span = [ids[c]];
      while (list.length && c + 1 < ids.length && cellSig(r.by[ids[c + 1]] || []) === cellSig(list)) span.push(ids[++c]);
      r.cells.push({ tracks: span, items: list });
    }
  });
  return rows;
}

const ref = o => gridRefs.push(o) - 1;
function cardHTML(it, r) {
  const place = placeName(it);
  return `<button type="button" class="gcard" data-ref="${r}">
    ${it.kind && it.kind !== 'Общее' ? `<small>${esc(it.kind)}</small>` : ''}
    <b>${it.title ? esc(it.title) : '<i>Без названия</i>'}</b>
    ${it.speaker ? `<span>${esc(it.speaker)}</span>` : ''}
    ${place ? `<em>${esc(place)}</em>` : ''}
  </button>`;
}
function renderGrid() {
  gridItems = readAll().items;
  gridRefs = [];
  const rows = buildGrid(gridItems), ids = tracks.map(t => t.id), n = ids.length;
  const timeTh = (r, span) => `<th scope="row" class="gtime"${span > 1 ? ` rowspan="${span}"` : ''}>
      <button type="button" class="gtime__btn" data-ref="${ref({ kind: 'slot', start: r.start, end: r.end })}" title="Изменить время строки">
        <b>${esc(r.start)}</b>${r.end ? `<span>до ${esc(r.end)}</span>` : ''}
      </button></th>`;
  const body = rows.map(r => {
    const hasTrack = r.cells.some(c => c.items.length), showCells = hasTrack || !r.all.length;
    let html = '';
    if (r.all.length) {
      html += `<tr class="grow--all">${timeTh(r, showCells ? 2 : 1)}<td colspan="${n}">
        <div class="gcell">${r.all.map(i => cardHTML(gridItems[i], ref({ kind: 'items', idx: [i], start: r.start, end: r.end }))).join('')}
        <div class="gacts"><button type="button" class="gact" data-ref="${ref({ kind: 'add', tracks: [ALL], start: r.start, end: r.end })}" title="Добавить ещё одну запись для всех треков">+ Для всех</button></div></div></td></tr>`;
    }
    if (showCells) {
      html += `<tr>${r.all.length ? '' : timeTh(r, 1)}${r.cells.map(c => {
        const span = c.tracks, last = ids.indexOf(span.at(-1)), next = ids[last + 1];
        const canGrow = next && !(r.by[next] || []).length && c.items.length;
        // k-я запись ячейки — это k-е записи всех её треков
        const cards = c.items.map((_, k) => cardHTML(gridItems[r.by[span[0]][k]], ref({ kind: 'items', idx: span.map(t => r.by[t][k]), start: r.start, end: r.end, tracks: span })));
        const acts = [
          `<button type="button" class="gact" data-ref="${ref({ kind: 'add', tracks: span, start: r.start, end: r.end })}" title="${c.items.length ? 'Добавить ещё запись в эту ячейку' : 'Добавить запись'}" aria-label="Добавить запись">+</button>`,
          span.length > 1 ? `<button type="button" class="gact" data-ref="${ref({ kind: 'shrink', start: r.start, end: r.end, tracks: span, by: r.by })}" title="Убрать из трека «${esc(tracks.find(t => t.id === span.at(-1)).name)}»" aria-label="Сузить ячейку">←</button>` : '',
          canGrow ? `<button type="button" class="gact" data-ref="${ref({ kind: 'grow', next, start: r.start, end: r.end, tracks: span, by: r.by })}" title="Растянуть на трек «${esc(tracks.find(t => t.id === next).name)}»" aria-label="Растянуть ячейку вправо">→</button>` : '',
        ].join('');
        const t0 = tracks.find(t => t.id === span[0]);
        return `<td${span.length > 1 ? ` colspan="${span.length}"` : ''} class="${c.items.length ? '' : 'is-empty'}" style="--c:${esc(t0.color)}"><div class="gcell">${cards.join('')}<div class="gacts">${acts}</div></div></td>`;
      }).join('')}</tr>`;
    }
    return html;
  }).join('');
  $('#grid').style.setProperty('--n', n);
  $('#grid').innerHTML = `<thead><tr><th class="gtime">Время</th>${tracks.map(t => `<th style="--c:${esc(t.color)}">${esc(t.name)}</th>`).join('')}</tr></thead>
    <tbody>${body || `<tr><td class="gempty" colspan="${n + 1}">Пока ни одной записи. Нажмите «+ Добавить время».</td></tr>`}</tbody>`;
  const orphans = gridItems.filter(it => it.start && it.track !== ALL && !ids.includes(it.track)).length;
  const noTime = gridItems.filter(it => !it.start).length;
  $('#gridNote').hidden = !(orphans || noTime);
  $('#gridNote').textContent = [noTime && `Без времени начала: ${noTime} — в таблице не показаны, заполните их во вкладке «Список».`, orphans && `Записи без трека: ${orphans}.`].filter(Boolean).join(' ');
}
function commitItems(items) {
  $('#rows').innerHTML = items.map(rowHTML).join('');
  setDirty(true); refresh();
}

/* Окно правки: запись (или одинаковые записи нескольких треков), новая запись, строка времени */
let dlg = null;
function openDialog(o) {
  dlg = o;
  const isSlot = o.kind === 'slot' || o.kind === 'newslot';
  const it = o.kind === 'items' ? gridItems[o.idx[0]] : { start: o.start || '', end: o.end || '', kind: 'Лекция', title: '', speaker: '', room: '', place: '', track: o.tracks?.[0] };
  const names = (o.tracks || []).filter(t => t !== ALL).map(id => tracks.find(t => t.id === id)?.name).filter(Boolean);
  $('#gTitle').textContent = { items: 'Запись программы', add: 'Новая запись', slot: 'Время строки', newslot: 'Новая строка времени' }[o.kind];
  const times = `<div class="gf-row">
      <label class="gf">Начало<input type="time" data-f="start" value="${esc(it.start)}" required></label>
      <label class="gf">Конец<input type="time" data-f="end" value="${esc(it.end)}"></label>
    </div>`;
  if (isSlot) {
    const count = o.kind === 'slot' ? gridItems.filter(x => x.start === o.start && x.end === o.end).length : 0;
    $('#gFields').innerHTML = times + (o.kind === 'slot' ? `<p class="gf-note">Новое время получат все записи этой строки (${count}).</p>` : '');
  } else {
    const all = (it.track || '') === ALL || (o.tracks || [])[0] === ALL;
    $('#gFields').innerHTML = times + `
      ${names.length > 1 ? `<p class="gf-note">Ячейка объединяет треки: ${esc(names.join(', '))}. Правка применится ко всем.</p>` : names.length ? `<p class="gf-note">Трек: ${esc(names[0])}</p>` : ''}
      <label class="gf">Формат<select data-f="kind">${KINDS.map(k => `<option${(it.kind || 'Лекция') === k ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
      <label class="gf">Название<input data-f="title" value="${esc(it.title)}" required placeholder="Название лекции"></label>
      <label class="gf">Спикер<input data-f="speaker" value="${esc(it.speaker)}" placeholder="Имя, должность"></label>
      <div class="gf">Место${placeSelect(it)}</div>
      <label class="gf-check"><input type="checkbox" data-f="all"${all ? ' checked' : ''}> Для всех треков — на всю строку (открытие, обед, нетворкинг)</label>`;
  }
  $('#gDel').hidden = o.kind !== 'items' && o.kind !== 'slot';
  $('#gDel').textContent = o.kind === 'slot' ? 'Удалить строку' : 'Удалить';
  $('#gdlg').showModal();
  $('#gFields').querySelector(isSlot ? '[data-f="start"]' : '[data-f="title"]')?.focus();
}
$('#gFields').addEventListener('change', e => {
  if (e.target.dataset.f !== 'room') return;
  const other = e.target.parentElement.querySelector('.other');
  other.hidden = e.target.value !== OTHER;
  if (!other.hidden) other.focus();
});
const dv = f => $('#gFields').querySelector(`[data-f="${f}"]`);
$('#gform').addEventListener('submit', e => {
  if (e.submitter?.value !== 'ok' || !dlg) return;
  const items = gridItems.map(x => ({ ...x })), start = dv('start').value, end = dv('end').value;
  const o = dlg;
  if (o.kind === 'slot' || o.kind === 'newslot') {
    if (o.kind === 'slot') {
      items.forEach(x => { if (x.start === o.start && x.end === o.end) { x.start = start; x.end = end; } });
      extraSlots = extraSlots.filter(s => !(s.start === o.start && s.end === o.end));
      if (!items.some(x => x.start === start && x.end === end)) extraSlots.push({ start, end });
    } else if (!extraSlots.some(s => s.start === start && s.end === end)) extraSlots.push({ start, end });
    commitItems(items);
    return;
  }
  const room = dv('room').value;
  const patch = {
    start, end, kind: dv('kind').value, title: dv('title').value.trim(), speaker: dv('speaker').value.trim(),
    room: room === OTHER ? '' : room, place: room === OTHER ? dv('place').value.trim() : '',
  };
  const all = dv('all').checked;
  if (o.kind === 'add') {
    // «+ Для всех» со снятой галочкой — запись уходит в первый трек
    const list = all ? [ALL] : o.tracks[0] === ALL ? [tracks[0].id] : o.tracks;
    list.forEach(track => items.push({ ...patch, track }));
  } else {
    const wasAll = items[o.idx[0]].track === ALL;
    o.idx.forEach(i => Object.assign(items[i], patch));
    if (all) {
      items[o.idx[0]].track = ALL;
      o.idx.slice(1).forEach(i => { items[i] = null; });
    } else if (wasAll) items[o.idx[0]].track = tracks[0].id;
  }
  extraSlots = extraSlots.filter(s => !(s.start === start && s.end === end));
  commitItems(items.filter(Boolean));
});
$('#gDel').addEventListener('click', () => {
  const o = dlg;
  if (!o) return;
  if (o.kind === 'slot') {
    const n = gridItems.filter(x => x.start === o.start && x.end === o.end).length;
    if (n && !confirm(`Удалить строку ${o.start}${o.end ? '–' + o.end : ''} вместе с записями (${n})?`)) return;
    extraSlots = extraSlots.filter(s => !(s.start === o.start && s.end === o.end));
    $('#gdlg').close();
    commitItems(gridItems.filter(x => !(x.start === o.start && x.end === o.end)));
    return;
  }
  const it = gridItems[o.idx[0]];
  if (!confirm(`Удалить «${it.title || 'без названия'}»${o.idx.length > 1 ? ` из всех треков ячейки (${o.idx.length})` : ''}?`)) return;
  $('#gdlg').close();
  commitItems(gridItems.filter((_, i) => !o.idx.includes(i)));
});
$('#grid').addEventListener('click', e => {
  const b = e.target.closest('[data-ref]');
  if (!b) return;
  const o = gridRefs[+b.dataset.ref];
  if (o.kind === 'grow') {
    // копии записей первого трека ячейки — в следующий трек
    const items = gridItems.map(x => ({ ...x }));
    (o.by[o.tracks[0]] || []).forEach(i => items.push({ ...gridItems[i], track: o.next }));
    commitItems(items);
    return;
  }
  if (o.kind === 'shrink') {
    const drop = o.by[o.tracks.at(-1)] || [];
    commitItems(gridItems.filter((_, i) => !drop.includes(i)));
    return;
  }
  openDialog(o);
});
$('#btnAddSlot').addEventListener('click', () => {
  const last = buildGrid(readAll().items).at(-1);
  openDialog({ kind: 'newslot', start: last?.end || '', end: '' });
});
$$('.vtab').forEach(b => b.addEventListener('click', () => {
  view = b.dataset.view;
  $$('.vtab').forEach(x => x.setAttribute('aria-selected', String(x === b)));
  $$('[data-for="list"]').forEach(el => { el.hidden = view !== 'list'; });
  $$('[data-for="grid"]').forEach(el => { el.hidden = view !== 'grid'; });
  if (view === 'grid') renderGrid(); else applyFilter();
}));

/* ---------- Помещения ---------- */
let roomFloor = FLOOR_IDS.find(f => !FLOORS[f].placeholder) || 1, roomSel = null;   // первый этаж с готовым планом
// Отличия от исходных данных — только они попадают в файл
function roomDiff(r) {
  const o = {};
  if (r.title !== r.base.title) o.name = r.title;
  if (r.sub !== r.base.sub) o.sub = r.sub;
  if (isHatched(r) !== (r.base.type === 'service')) o.hatched = isHatched(r);
  return o;
}
function roomsDiff() {
  const out = {};
  ROOMS.filter(isEditable).forEach(r => { const o = roomDiff(r); if (Object.keys(o).length) out[r.id] = o; });
  return out;
}
function drawAdminPlan() {
  const { w, h } = FLOORS[roomFloor];
  $('#adminPlan').setAttribute('viewBox', `-12 -12 ${w + 24} ${h + 24}`);
  $('#adminPlan').style.aspectRatio = `${w + 24} / ${h + 24}`;   // высота по пропорциям этажа
  renderPlan($('#adminWorld'), roomFloor, { clickable: isEditable, onSelect: id => selectEditRoom(id, true) });
  markRoomSel();
}
function roomRowHTML(r) {
  const changed = Object.keys(roomDiff(r)).length > 0;
  // у заштрихованного помещения поле пустое: подпись на плане появится, только если вписать название
  const hatched = isHatched(r), o = roomsOv[r.id] || {};
  const name = hatched ? (o.name || '') : r.title, sub = hatched ? (o.sub || '') : r.sub;
  return `<div class="room-row${hatched ? ' is-hatched' : ''}" data-id="${r.id}">
    <span class="room-badge room-badge--${r.type}" aria-hidden="true">${esc(r.badge || '')}</span>
    <div class="room-fields">
      <input data-k="name" value="${esc(name)}" placeholder="${hatched ? 'Без подписи на плане' : esc(r.base.title)}" aria-label="Название помещения" maxlength="60">
      <input data-k="sub" value="${esc(sub)}" placeholder="Подзаголовок (необязательно)" aria-label="Подзаголовок" maxlength="60">
    </div>
    <label class="hatch-check"><input type="checkbox" data-k="hatched"${isHatched(r) ? ' checked' : ''}> Заштриховать</label>
    <button type="button" class="reset" data-k="reset" title="Вернуть как было" aria-label="Вернуть как было"${changed ? '' : ' disabled'}><svg class="ico"><use href="#i-undo"/></svg></button>
  </div>`;
}
function renderRoomsEditor() {
  $$('.rfloor').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.floor === roomFloor)));
  $('#roomList').innerHTML = ROOMS.filter(r => r.floor === roomFloor && isEditable(r)).map(roomRowHTML).join('');
  drawAdminPlan();
}
function markRoomSel() {
  $$('#adminWorld [data-id]').forEach(el => el.classList.toggle('is-active', el.dataset.id === roomSel));
  $$('.room-row').forEach(el => el.classList.toggle('is-sel', el.dataset.id === roomSel));
}
function selectEditRoom(id, fromPlan) {
  roomSel = id; markRoomSel();
  if (!fromPlan) return;
  const row = $(`.room-row[data-id="${id}"]`);
  if (row) { row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); row.querySelector('[data-k="name"]').focus(); }
}
// Названия мест в таблице программы — после переименования или штриховки
function refreshPlaceCells() {
  $$('#rows tr').forEach(tr => {
    const it = readRow(tr);
    tr.querySelector('[data-f="room"]').closest('td').innerHTML = placeSelect(it);
  });
}
// Изменение помещения: сохранить в roomsOv, пересчитать и перерисовать
function updateRoom(id, patch, fullRender) {
  roomsOv[id] = { ...(roomsOv[id] || {}), ...patch };
  prepareRooms(roomsOv);
  if (fullRender) renderRoomsEditor(); else drawAdminPlan();
  const r = roomById(id), row = $(`.room-row[data-id="${id}"]`);
  if (row) row.querySelector('[data-k="reset"]').disabled = !Object.keys(roomDiff(r)).length;
  refreshPlaceCells(); refresh(); setDirty(true);
}
$('#roomList').addEventListener('input', e => {
  const k = e.target.dataset.k, id = e.target.closest('.room-row')?.dataset.id;
  if (k === 'name' || k === 'sub') updateRoom(id, { [k]: e.target.value }, false);
});
$('#roomList').addEventListener('change', e => {
  const id = e.target.closest('.room-row')?.dataset.id;
  if (e.target.dataset.k === 'hatched') { roomSel = id; updateRoom(id, { hatched: e.target.checked }, true); }
});
$('#roomList').addEventListener('click', e => {
  const b = e.target.closest('[data-k="reset"]');
  if (!b) return;
  const id = b.closest('.room-row').dataset.id;
  delete roomsOv[id];
  prepareRooms(roomsOv); renderRoomsEditor(); refreshPlaceCells(); refresh(); setDirty(true);
});
$('#roomList').addEventListener('focusin', e => {
  const id = e.target.closest('.room-row')?.dataset.id;
  if (id && id !== roomSel) selectEditRoom(id, false);
});
$('#rfloors').innerHTML = FLOOR_IDS.map(f => `<button type="button" class="rfloor" data-floor="${f}" aria-pressed="${f === roomFloor}">${esc(floorName(f))}</button>`).join('');
$$('.rfloor').forEach(b => b.addEventListener('click', () => { roomFloor = +b.dataset.floor; roomSel = null; renderRoomsEditor(); }));
$$('.stab').forEach(b => b.addEventListener('click', () => {
  $$('.stab').forEach(x => x.setAttribute('aria-selected', String(x === b)));
  $('#secProgram').hidden = b.dataset.sec !== 'program';
  $('#secRooms').hidden = b.dataset.sec !== 'rooms';
  if (b.dataset.sec === 'rooms') renderRoomsEditor();
}));
installPlanDefs($('#adminPlan'));

/* ---------- Сохранение и скачивание ---------- */
$('#btnSave').addEventListener('click', async () => {
  const issues = validate();
  if (issues.length && !confirm(`Есть замечания (${issues.length}). Всё равно сохранить?`)) return;
  sortRows();
  const btn = $('#btnSave');
  btn.disabled = true; setStatus('Сохранение…', 'warn');
  try {
    const res = await api({ action: 'save', base: version, schedule: JSON.stringify(readAll()) });
    version = res.schedule.updated;
    setDirty(false); clearDraft();
    setStatus('Сохранено. Навигация на сайте и стойки уже показывают новую версию', 'ok');
  } catch (e) {
    setStatus(explain(e) + (e.status === 409 || e.status === 422 ? ' Скачайте свой файл, затем «Загрузить заново».' : ''), 'err');
  } finally { btn.disabled = false; }
});
$('#btnDownload').addEventListener('click', () => {
  sortRows();
  const blob = new Blob([buildFile(readAll())], { type: 'text/javascript;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'schedule.js' });
  a.click(); URL.revokeObjectURL(a.href);
});
$('#btnReload').addEventListener('click', async () => {
  if (dirty && !confirm('Несохранённые изменения пропадут. Загрузить заново?')) return;
  if (dirty) clearDraft();
  try { await loadRemote(); } catch (e) { setStatus(explain(e), 'err'); }
});
// Ctrl+S — сохранить
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
    e.preventDefault();
    $('#btnSave').click();
  }
});

/* ---------- Старт: данные пришли вместе со страницей ---------- */
version = window.SCHEDULE_DATA.updated;
fill(window.SCHEDULE_DATA);
setDirty(false);
offerDraft();
