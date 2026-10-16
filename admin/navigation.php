<?php
// Админка: подробная программа, треки и названия помещений для навигации (navigation/) и стоек.
// Вход — тот же, что у основной админки (admin/index.php).
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../lib/schedule.php';

if (!is_logged_in()) {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') json_out(['ok' => false, 'error' => 'Войдите заново'], 401);
    redirect_self();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    check_csrf();
    $action = $_POST['action'] ?? '';
    if ($action === 'load') {
        json_out(['ok' => true, 'schedule' => load_schedule()]);
    }
    if ($action === 'save') {
        // Программу мог сохранить кто-то другой, пока страница была открыта
        if ((string)($_POST['base'] ?? '') !== schedule_version()) {
            json_out(['ok' => false, 'error' => 'Пока вы редактировали, программу сохранил кто-то другой.'], 409);
        }
        $data = json_decode((string)($_POST['schedule'] ?? ''), true);
        if (!is_array($data)) json_out(['ok' => false, 'error' => 'Не удалось прочитать данные'], 400);
        json_out(['ok' => true, 'schedule' => save_schedule($data)]);
    }
    json_out(['ok' => false, 'error' => 'Неизвестное действие'], 400);
}

$csrf = $_SESSION['csrf'];
$nav = '../navigation/';
?>
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Навигация и программа — админка форума</title>
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="<?= $nav ?>assets/fonts/fonts.css">
<link rel="stylesheet" href="<?= $nav ?>assets/plan.css?v=<?= asset_v('navigation/assets/plan.css') ?>">
<link rel="stylesheet" href="navigation.css?v=<?= asset_v('admin/navigation.css') ?>">
</head>
<body>

<header class="top">
  <div class="top__in">
    <p class="brand">Навигация и программа <small>админка</small></p>
    <a class="pagelink" href="./">← Основная админка</a>
    <div class="top__actions" id="actions">
      <span class="status" id="status" hidden></span>
      <a class="btn btn--ghost" href="<?= $nav ?>#program" target="_blank" rel="noopener">Открыть на сайте</a>
      <a class="btn btn--ghost" href="<?= $nav ?>stand.html?stand=1#program" target="_blank" rel="noopener">Открыть стойку</a>
      <button type="button" class="btn" id="btnDownload" title="Скачать файл программы на компьютер">Скачать файл</button>
      <button type="button" class="btn" id="btnReload">Загрузить заново</button>
      <button type="button" class="btn btn--primary" id="btnSave" title="Ctrl+S">Сохранить</button>
      <form method="post" action="./"><input type="hidden" name="action" value="logout"><input type="hidden" name="csrf" value="<?= e($csrf) ?>"><button type="submit" class="btn btn--ghost">Выйти</button></form>
    </div>
  </div>
</header>

<!-- ===== Редактор ===== -->
<main class="wrap" id="editor">
  <div class="draft" id="draft" hidden role="status">
    <span id="draftText"></span>
    <button type="button" class="btn btn--primary" id="btnDraftRestore">Восстановить</button>
    <button type="button" class="btn btn--ghost" id="btnDraftDrop">Удалить черновик</button>
  </div>
  <div class="sections" role="tablist" aria-label="Разделы админки">
    <button type="button" class="stab" role="tab" data-sec="program" aria-selected="true">Программа</button>
    <button type="button" class="stab" role="tab" data-sec="rooms" aria-selected="false">Помещения</button>
  </div>

  <section id="secRooms" hidden>
    <section class="panel">
      <h2>Помещения</h2>
      <p>Нажмите на помещение на плане или в списке, чтобы переименовать его. «Заштриховать» убирает помещение из навигации (на сайте и на стойках): на плане оно заштриховано и без подписи. Чтобы подписать заштрихованное помещение, впишите ему название. Снимите галочку, чтобы вернуть.</p>
      <div class="rfloors" id="rfloors" role="group" aria-label="Этаж"></div>
      <div class="rooms-edit">
        <div class="mini-plan"><svg id="adminPlan" preserveAspectRatio="xMidYMid meet" role="img" aria-label="План этажа"><g id="adminWorld"></g></svg></div>
        <div class="room-list" id="roomList"></div>
      </div>
    </section>
  </section>

  <section id="secProgram">
  <div class="meta">
    <div class="field">
      <label for="evDate">Дата форума</label>
      <input type="date" id="evDate">
    </div>
    <div class="field">
      <label for="filter">Показать</label>
      <select id="filter"></select>
    </div>
    <div class="field">
      <label for="search">Поиск</label>
      <input type="search" id="search" placeholder="Название или спикер" autocomplete="off">
    </div>
    <span class="counter" id="counter"></span>
  </div>

  <section class="panel" aria-labelledby="tracksTitle">
    <h2 id="tracksTitle">Треки</h2>
    <p>Названия, цвета и порядок треков — так они выглядят во вкладке «Программа» в навигации, на стойках и в программе на главной сайта. Стрелки двигают трек раньше или позже.</p>
    <div class="tracks-edit" id="tracksEdit"></div>
    <button type="button" class="btn add-track" id="btnAddTrack">+ Добавить трек</button>
  </section>

  <ul class="issues" id="issues" hidden></ul>

  <div class="views" role="tablist" aria-label="Вид программы">
    <button type="button" class="vtab" role="tab" data-view="list" aria-selected="true">Список</button>
    <button type="button" class="vtab" role="tab" data-view="grid" aria-selected="false">Таблица</button>
  </div>

  <!-- Таблица: время × треки, как в общей программе. Правки сразу попадают в список -->
  <div data-for="grid" hidden>
    <p class="grid-note" id="gridNote" hidden></p>
    <div class="grid-wrap"><table class="grid" id="grid"></table></div>
    <button type="button" class="btn add-row" id="btnAddSlot">+ Добавить время</button>
    <p class="hint">Таблица показывает ту же программу, что и список: строки — время, столбцы — треки в заданном порядке. Нажмите на запись, чтобы изменить её, на время — чтобы сдвинуть всю строку. «+» добавляет запись в ячейку, «→» растягивает ячейку на соседний трек (одна и та же лекция в нескольких треках), «←» сужает обратно. Запись «для всех треков» занимает всю строку. После правок нажмите «Сохранить» — изменения попадут в навигацию, на стойки и в программу на сайте.</p>
  </div>

  <div data-for="list">
  <div class="track-tabs" id="trackTabs" role="tablist" aria-label="Показать трек"></div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th class="col-num">№</th>
          <th class="col-time">Начало</th>
          <th class="col-time">Конец</th>
          <th class="col-track">Трек</th>
          <th class="col-kind">Формат</th>
          <th>Название</th>
          <th>Спикер</th>
          <th class="col-place">Место</th>
          <th class="col-del"><span class="sr" hidden>Удалить</span></th>
        </tr>
      </thead>
      <tbody id="rows"></tbody>
    </table>
    <div class="empty" id="empty" hidden>Пока ни одной записи. Нажмите «Добавить лекцию».</div>
  </div>
  <button type="button" class="btn add-row" id="btnAdd">+ Добавить лекцию</button>
  <p class="hint">Сохранить — <kbd>Ctrl</kbd>+<kbd>S</kbd>. Пока вы работаете, черновик хранится в этом браузере: если вкладка закроется или пропадёт связь, при следующем открытии страницы админка предложит его восстановить. Кнопка «Копировать» рядом с записью добавляет такую же лекцию сразу после неё. Записи автоматически сортируются по времени при сохранении. Галочка «Применить ко всем трекам» показывает запись во всех треках — для открытия, обеда, нетворкинга. Если одно и то же место занято двумя лекциями одновременно, админка предупредит.</p>
  </div>
  </section>

  <dialog class="gdlg" id="gdlg" aria-labelledby="gTitle">
    <form method="dialog" id="gform">
      <h3 id="gTitle"></h3>
      <div class="gfields" id="gFields"></div>
      <div class="gdlg__acts">
        <button type="button" class="btn btn--danger" id="gDel">Удалить</button>
        <span class="gdlg__sp"></span>
        <button type="submit" class="btn btn--ghost" value="cancel" formnovalidate>Отмена</button>
        <button type="submit" class="btn btn--primary" value="ok">Готово</button>
      </div>
    </form>
  </dialog>
</main>

<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-undo" viewBox="0 0 24 24"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></symbol>
  <symbol id="i-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="13" height="13" rx="1"/><path d="M4 16V4a1 1 0 0 1 1-1h11"/></symbol>
  <symbol id="i-left" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></symbol>
  <symbol id="i-right" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></symbol>
  <symbol id="i-trash" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></symbol>
</svg>

<script src="<?= $nav ?>data/rooms.js?v=<?= asset_v('navigation/data/rooms.js') ?>"></script>
<script src="<?= $nav ?>assets/plan.js?v=<?= asset_v('navigation/assets/plan.js') ?>"></script>
<script>
window.CSRF = <?= json_encode($csrf) ?>;
window.SCHEDULE_DATA = <?= json_encode(load_schedule(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?>;
</script>
<script src="navigation.js?v=<?= asset_v('admin/navigation.js') ?>"></script>
</body>
</html>
