<?php
// Подробная программа и правки помещений для навигации (navigation/).
// Редактируется в админке (admin/navigation.php), хранится в data/schedule.json — только на сервере.
// Пока файла нет, берётся lib/schedule.default.json.

declare(strict_types=1);

require_once __DIR__ . '/content.php';

const SCHEDULE_FILE    = DATA_DIR . '/schedule.json';
const SCHEDULE_DEFAULT = __DIR__ . '/schedule.default.json';
const MAX_TRACKS       = 8;     // больше не помещается в шапку программы на стойке
const MAX_ITEMS        = 400;

// Разовый перенос программы из файла (lib/schedule.import.json, например из Excel общей программы).
// Применяется один раз на сервере: прежняя программа уходит в data/backups, правки помещений сохраняются.
// Чтобы перенести новую версию, положите файл с другим import_id.
const SCHEDULE_IMPORT = __DIR__ . '/schedule.import.json';

function apply_schedule_import(): void
{
    if (!is_file(SCHEDULE_IMPORT)) return;
    $imp = json_decode((string)file_get_contents(SCHEDULE_IMPORT), true);
    $id = is_array($imp) ? id_field($imp['import_id'] ?? '', 60) : '';
    if ($id === '') return;
    $mark = DATA_DIR . '/schedule-import-' . $id . '.done';
    if (is_file($mark)) return;
    ensure_data_dirs();
    if (@file_put_contents($mark, gmdate('c'), LOCK_EX) === false) return;
    $cur = json_decode((string)file_get_contents(is_file(SCHEDULE_FILE) ? SCHEDULE_FILE : SCHEDULE_DEFAULT), true);
    $imp['rooms'] = is_array($cur) ? ($cur['rooms'] ?? []) : [];
    save_schedule($imp);
}

function load_schedule(): array
{
    apply_schedule_import();
    $file = is_file(SCHEDULE_FILE) ? SCHEDULE_FILE : SCHEDULE_DEFAULT;
    $data = json_decode((string)file_get_contents($file), true);
    if (!is_array($data)) {
        $data = json_decode((string)file_get_contents(SCHEDULE_DEFAULT), true) ?: [];
    }
    return normalize_schedule($data, (string)($data['updated'] ?? ''));
}

// Версия для проверки «пока вы редактировали, программу сохранил кто-то другой»
function schedule_version(): string
{
    return load_schedule()['updated'];
}

function save_schedule(array $data): array
{
    ensure_data_dirs();
    $data = normalize_schedule($data, gmdate('Y-m-d\TH:i:s\Z'));

    if (is_file(SCHEDULE_FILE)) {
        copy(SCHEDULE_FILE, BACKUPS_DIR . '/schedule-' . date('Ymd-His') . '.json');
        $backups = glob(BACKUPS_DIR . '/schedule-*.json') ?: [];
        sort($backups);
        while (count($backups) > MAX_BACKUPS) {
            @unlink(array_shift($backups));
        }
    }

    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    $tmp = SCHEDULE_FILE . '.tmp';
    file_put_contents($tmp, $json, LOCK_EX);
    rename($tmp, SCHEDULE_FILE);
    return $data;
}

/* ---------- Нормализация: только известные поля, обрезка длины ---------- */

function id_field($v, int $max = 40): string
{
    return mb_substr(preg_replace('/[^a-zA-Z0-9_-]/', '', is_scalar($v) ? (string)$v : '') ?? '', 0, $max);
}

function time_field($v): string
{
    $s = str_field($v, 5);
    return preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $s) ? $s : '';
}

function normalize_schedule(array $d, string $updated): array
{
    $date = str_field($d['date'] ?? '', 10);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) $date = '';

    $tracks = [];
    foreach (array_slice(is_array($d['tracks'] ?? null) ? $d['tracks'] : [], 0, MAX_TRACKS) as $t) {
        if (!is_array($t) || ($id = id_field($t['id'] ?? '')) === '' || $id === 'all') continue;
        $color = str_field($t['color'] ?? '', 7);
        $tracks[$id] = [
            'id'    => $id,
            'name'  => str_field($t['name'] ?? '', 40) ?: $id,
            'color' => preg_match('/^#[0-9a-fA-F]{6}$/', $color) ? $color : '#2450EC',
        ];
    }
    $tracks = array_values($tracks);

    // Правки помещений: только отличия от data/rooms.js
    $rooms = [];
    foreach (is_array($d['rooms'] ?? null) ? $d['rooms'] : [] as $id => $o) {
        if (!is_array($o) || ($id = id_field($id)) === '') continue;
        $r = [];
        if (array_key_exists('name', $o)) $r['name'] = str_field($o['name'], 60);
        if (array_key_exists('sub', $o)) $r['sub'] = str_field($o['sub'], 60);
        if (array_key_exists('hatched', $o)) $r['hatched'] = (bool)$o['hatched'];
        if ($r) $rooms[$id] = $r;
    }

    $items = [];
    foreach (array_slice(is_array($d['items'] ?? null) ? $d['items'] : [], 0, MAX_ITEMS) as $it) {
        if (!is_array($it)) continue;
        $track = id_field($it['track'] ?? '');
        $items[] = [
            'start'   => time_field($it['start'] ?? ''),
            'end'     => time_field($it['end'] ?? ''),
            'kind'    => str_field($it['kind'] ?? '', 40),
            'title'   => str_field($it['title'] ?? '', 300),
            'speaker' => str_field($it['speaker'] ?? '', 300),
            'room'    => id_field($it['room'] ?? ''),
            'place'   => str_field($it['place'] ?? '', 120),
            'track'   => $track === '' ? 'all' : $track,
        ];
    }

    // Пустой объект rooms должен остаться объектом {}, а не массивом []
    return ['date' => $date, 'updated' => $updated, 'tracks' => $tracks, 'rooms' => (object)$rooms, 'items' => $items];
}

/* ---------- Сетка «время × треки» для общей программы на сайте ----------
   Тот же расчёт, что у вкладки «Таблица» в админке (admin/navigation.js → buildGrid):
   строка — интервал «начало–конец», столбец — трек. Одинаковые записи в соседних треках
   сливаются в одну ячейку на несколько столбцов, запись «для всех треков» — на всю строку. */

function schedule_grid(array $s): array
{
    $trackIds = array_column($s['tracks'], 'id');
    $slots = [];
    foreach ($s['items'] as $it) {
        if ($it['start'] === '' || $it['title'] === '') continue;
        $key = $it['start'] . '|' . $it['end'];
        $slots[$key] ??= ['start' => $it['start'], 'end' => $it['end'], 'all' => [], 'by' => []];
        if ($it['track'] === 'all') $slots[$key]['all'][] = $it;
        elseif (in_array($it['track'], $trackIds, true)) $slots[$key]['by'][$it['track']][] = $it;
    }
    uasort($slots, fn($a, $b) => [$a['start'], $a['end']] <=> [$b['start'], $b['end']]);

    $sig = fn(array $list) => json_encode(array_map(fn($i) => [$i['kind'], $i['title'], $i['speaker'], $i['room'], $i['place']], $list));
    $rows = [];
    foreach ($slots as $slot) {
        $cells = [];
        if ($slot['by']) {
            for ($c = 0, $n = count($trackIds); $c < $n; $c++) {
                $list = $slot['by'][$trackIds[$c]] ?? [];
                $span = [$trackIds[$c]];
                while ($list && $c + 1 < $n && $sig($slot['by'][$trackIds[$c + 1]] ?? []) === $sig($list)) {
                    $span[] = $trackIds[++$c];
                }
                $cells[] = ['tracks' => $span, 'items' => $list];
            }
        }
        $rows[] = ['start' => $slot['start'], 'end' => $slot['end'], 'all' => $slot['all'], 'cells' => $cells];
    }
    return $rows;
}

// Названия помещений: из navigation/data/rooms.js (t1, иначе t3) с правками из админки
function schedule_room_names(array $s): array
{
    $names = [];
    $js = (string)@file_get_contents(__DIR__ . '/../navigation/data/rooms.js');
    if (preg_match_all("~\{\s*id:\s*'([^']+)'[^\n]*~u", $js, $m, PREG_SET_ORDER)) {
        foreach ($m as [$line, $id]) {
            if (preg_match("~\bt1:\s*\[([^\]]*)\]~u", $line, $t) || preg_match("~\bt3:\s*\[([^\]]*)\]~u", $line, $t)) {
                preg_match_all("~'([^']*)'~u", $t[1], $parts);
                $names[$id] = str_replace('- ', '', implode(' ', $parts[1]));
            }
        }
    }
    foreach ((array)$s['rooms'] as $id => $o) {
        if (isset($o['name']) && trim($o['name']) !== '') $names[$id] = trim($o['name']);
    }
    return $names;
}
