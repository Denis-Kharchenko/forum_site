<?php
// Общие функции: чтение/запись содержимого сайта.
// Данные админки лежат в data/ (только на сервере, в git и деплой не попадают).

declare(strict_types=1);

const ROOT_DIR     = __DIR__ . '/..';
const DATA_DIR     = ROOT_DIR . '/data';
const UPLOADS_DIR  = DATA_DIR . '/uploads';
const BACKUPS_DIR  = DATA_DIR . '/backups';
const CONTENT_FILE = DATA_DIR . '/content.json';
const DEFAULT_FILE = __DIR__ . '/content.default.json';
const MAX_BACKUPS  = 30;

function e(?string $s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function load_content(): array
{
    $file = is_file(CONTENT_FILE) ? CONTENT_FILE : DEFAULT_FILE;
    $data = json_decode((string)file_get_contents($file), true);
    if (!is_array($data)) {
        $data = json_decode((string)file_get_contents(DEFAULT_FILE), true) ?: [];
    }
    return normalize_content($data);
}

function ensure_data_dirs(): void
{
    foreach ([DATA_DIR, UPLOADS_DIR, BACKUPS_DIR] as $dir) {
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
    }
    // Apache: служебные файлы data/ закрыты, uploads/ — открыт
    $deny = DATA_DIR . '/.htaccess';
    if (!is_file($deny)) {
        file_put_contents($deny, "<FilesMatch \"\\.(json|php)$\">\n  Require all denied\n</FilesMatch>\n");
    }
    $bak = BACKUPS_DIR . '/.htaccess';
    if (!is_file($bak)) {
        file_put_contents($bak, "Require all denied\n");
    }
}

function save_content(array $data): void
{
    ensure_data_dirs();
    $data = normalize_content($data);

    if (is_file(CONTENT_FILE)) {
        copy(CONTENT_FILE, BACKUPS_DIR . '/content-' . date('Ymd-His') . '.json');
        $backups = glob(BACKUPS_DIR . '/content-*.json') ?: [];
        sort($backups);
        while (count($backups) > MAX_BACKUPS) {
            @unlink(array_shift($backups));
        }
    }

    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    $tmp = CONTENT_FILE . '.tmp';
    file_put_contents($tmp, $json, LOCK_EX);
    rename($tmp, CONTENT_FILE);
}

/* ---------- Нормализация: только известные поля, обрезка длины ---------- */

function str_field($v, int $max = 200): string
{
    $s = trim(is_scalar($v) ? (string)$v : '');
    $s = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $s) ?? '';
    return mb_substr($s, 0, $max);
}

function url_field($v): string
{
    $s = preg_replace('/\s+/u', '', str_field($v, 500)) ?? '';
    if ($s === '') return '';
    // «myrosmol.ru/…» или «//myrosmol.ru/…» — дописываем https://
    if (!preg_match('~^[a-z][a-z0-9+.-]*:~i', $s)) {
        $s = 'https://' . ltrim($s, '/');
    }
    // домен с точкой; кириллические домены (.рф) тоже подходят
    return preg_match('~^https?://[^\s/?#<>"\'`]+\.[^\s/?#<>"\'`]+([/?#][^\s<>"\'`]*)?$~iu', $s) ? $s : '';
}

function image_field($v): string
{
    $s = str_field($v, 300);
    // только свои картинки: assets/… или data/uploads/…
    return preg_match('~^(assets|data/uploads)/[A-Za-z0-9._/-]+\.(png|jpe?g|webp|svg)$~i', $s) && !str_contains($s, '..') ? $s : '';
}

function list_field($v, callable $fn, int $max = 60): array
{
    $out = [];
    foreach (is_array($v) ? array_slice($v, 0, $max) : [] as $item) {
        if (is_array($item)) {
            $out[] = $fn($item);
        }
    }
    return $out;
}

// Многострочный текст: сохраняем переносы строк, убираем прочие управляющие символы
function text_field($v, int $max = 3000): string
{
    $s = str_replace(["\r\n", "\r"], "\n", is_scalar($v) ? (string)$v : '');
    $s = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/u', ' ', $s) ?? '';
    return mb_substr(trim($s), 0, $max);
}

// Абзацы из многострочного текста (разделитель — пустая строка)
function paragraphs(string $text): array
{
    return array_values(array_filter(array_map('trim', preg_split('/\n\s*\n/', $text) ?: []), 'strlen'));
}

// Недостающие разделы и поля берём из значений по умолчанию —
// так старые сохранения продолжают работать после добавления новых полей
function with_defaults(array $d): array
{
    static $def = null;
    $def ??= json_decode((string)file_get_contents(DEFAULT_FILE), true) ?: [];
    foreach ($def as $key => $value) {
        if (!array_key_exists($key, $d)) {
            $d[$key] = $value;
        } elseif (is_array($value) && !array_is_list($value) && is_array($d[$key])) {
            $d[$key] += $value;
        }
    }
    return $d;
}

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

// «2026-10-23» → «23 октября 2026»
function date_human(string $iso, bool $withYear = true): string
{
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $iso, $m)) return '';
    return (int)$m[3] . ' ' . MONTHS_GEN[(int)$m[2] - 1] . ($withYear ? ' ' . $m[1] : '');
}

function normalize_content(array $d): array
{
    $d = with_defaults($d);
    $c = is_array($d['contacts'] ?? null) ? $d['contacts'] : [];
    $s = is_array($d['settings'] ?? null) ? $d['settings'] : [];
    $a = is_array($d['announcement'] ?? null) ? $d['announcement'] : [];
    $t = is_array($d['texts'] ?? null) ? $d['texts'] : [];
    $email = fn($v) => filter_var(str_field($v, 120), FILTER_VALIDATE_EMAIL) ?: '';
    $time = fn($v, $fallback) => preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', str_field($v, 5)) ? str_field($v, 5) : $fallback;
    $date = str_field($s['date'] ?? '', 10);

    return [
        'settings' => [
            'reg_url'    => url_field($s['reg_url'] ?? ''),
            'date'       => preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) && checkdate((int)substr($date, 5, 2), (int)substr($date, 8, 2), (int)substr($date, 0, 4)) ? $date : '2026-10-23',
            'time_start' => $time($s['time_start'] ?? '', '10:00'),
            'time_end'   => $time($s['time_end'] ?? '', '17:30'),
            'venue'      => str_field($s['venue'] ?? '', 120),
            'address'    => str_field($s['address'] ?? '', 200),
            'mode'       => ($s['mode'] ?? '') === 'after' ? 'after' : 'before',
        ],
        'announcement' => [
            'enabled'   => !empty($a['enabled']),
            'text'      => str_field($a['text'] ?? '', 200),
            'link_text' => str_field($a['link_text'] ?? '', 40),
            'link_url'  => url_field($a['link_url'] ?? '') ?: (preg_match('/^#[a-z-]+$/', str_field($a['link_url'] ?? '', 40)) ? str_field($a['link_url'] ?? '', 40) : ''),
        ],
        'texts' => [
            'about_title' => str_field($t['about_title'] ?? '', 120),
            'about_lead'  => text_field($t['about_lead'] ?? '', 600),
            'about_text'  => text_field($t['about_text'] ?? '', 3000),
            'program_note'  => str_field($t['program_note'] ?? '', 200),
            'partners_note' => str_field($t['partners_note'] ?? '', 200),
            'speakers_note' => str_field($t['speakers_note'] ?? '', 200),
            'cta_title'   => str_field($t['cta_title'] ?? '', 120),
            'cta_text'    => str_field($t['cta_text'] ?? '', 300),
            'thanks_title' => str_field($t['thanks_title'] ?? '', 120),
            'thanks_text'  => str_field($t['thanks_text'] ?? '', 300),
        ],
        'gallery' => list_field($d['gallery'] ?? [], fn($i) => [
            'src'     => image_field($i['src'] ?? ''),
            'caption' => str_field($i['caption'] ?? '', 200),
        ], 120),
        'program' => list_field($d['program'] ?? [], fn($i) => [
            'time'  => str_field($i['time'] ?? '', 20),
            'title' => str_field($i['title'] ?? '', 200),
            'place' => str_field($i['place'] ?? '', 120),
        ]),
        'speakers' => list_field($d['speakers'] ?? [], fn($i) => [
            'name'  => str_field($i['name'] ?? '', 120),
            'role'  => str_field($i['role'] ?? '', 200),
            'photo' => image_field($i['photo'] ?? ''),
            'crop'  => crop_field($i['crop'] ?? null),
            'bio'   => text_field($i['bio'] ?? '', 1500),
        ], 12),
        'speakers_more' => list_field($d['speakers_more'] ?? [], fn($i) => [
            'name' => str_field($i['name'] ?? '', 120),
            'role' => str_field($i['role'] ?? '', 200),
            'bio'  => text_field($i['bio'] ?? '', 1500),
        ]),
        'partners' => list_field($d['partners'] ?? [], fn($i) => [
            'name'   => str_field($i['name'] ?? '', 200),
            'logo'   => image_field($i['logo'] ?? ''),
            'main'   => !empty($i['main']),
            'hidden' => !empty($i['hidden']),
            'size'   => max(20, min(100, (int)($i['size'] ?? 60))),
            'invert' => !empty($i['invert']),
        ], 40),
        'contacts' => [
            'organizer' => str_field($c['organizer'] ?? '', 200),
            'phone'     => str_field($c['phone'] ?? '', 40),
            'email'     => $email($c['email'] ?? ''),
            'press'     => $email($c['press'] ?? ''),
            'vk'        => url_field($c['vk'] ?? ''),
            'telegram'  => url_field($c['telegram'] ?? ''),
        ],
    ];
}

/* ---------- Кадрирование фото спикера ----------
   Кадр хранится без изменения файла: x, y — точка фокуса (доля ширины/высоты фото),
   z — приближение (1 = фото целиком заполняет рамку), ar — пропорции фото (ширина / высота). */

const CROP_FRAME = 1.25; // рамка карточки 4:5 — высота = 1.25 ширины

function crop_field($v): ?array
{
    if (!is_array($v)) return null;
    $num = fn($k, $min, $max, $def) => is_numeric($v[$k] ?? null) ? max($min, min($max, (float)$v[$k])) : $def;
    $ar = $num('ar', 0.1, 10, 0);
    if ($ar <= 0) return null;
    return ['x' => round($num('x', 0, 1, .5), 4), 'y' => round($num('y', 0, 1, .5), 4), 'z' => round($num('z', 1, 4, 1), 3), 'ar' => round($ar, 4)];
}

// Размер и положение фото внутри рамки 4:5 в процентах. Та же формула — в admin.js (cropBox)
function crop_box(array $c): array
{
    $z = $c['z'];
    // ширина и высота фото в долях ширины рамки при заполнении рамки
    if ($c['ar'] >= 1 / CROP_FRAME) { $dh = CROP_FRAME * $z; $dw = $dh * $c['ar']; }
    else { $dw = $z; $dh = $dw / $c['ar']; }
    // фокус не даёт фото отойти от краёв рамки
    $x = max(.5 / $dw, min(1 - .5 / $dw, $c['x']));
    $y = max(CROP_FRAME / 2 / $dh, min(1 - CROP_FRAME / 2 / $dh, $c['y']));
    return [
        'w' => $dw * 100,
        'h' => $dh / CROP_FRAME * 100,
        'l' => (.5 - $x * $dw) * 100,
        't' => (CROP_FRAME / 2 - $y * $dh) / CROP_FRAME * 100,
        'x' => $x * 100,
        'y' => $y * 100,
    ];
}

// style для <img> в карточке спикера (пустая строка — кадр не задан, работает обычное заполнение)
function crop_style(?array $c): string
{
    if (!$c) return '';
    $b = crop_box($c);
    // inset:auto — первым, иначе он сбросит left/top
    return sprintf('inset:auto;left:%.3f%%;top:%.3f%%;width:%.3f%%;height:%.3f%%;max-width:none;object-fit:fill', $b['l'], $b['t'], $b['w'], $b['h']);
}

// object-position для окон другой пропорции (окно «Подробнее»)
function crop_position(?array $c): string
{
    if (!$c) return '';
    $b = crop_box($c);
    return sprintf('%.2f%% %.2f%%', $b['x'], $b['y']);
}

function tel_href(string $phone): string
{
    $digits = preg_replace('/[^\d+]/', '', $phone) ?? '';
    return $digits !== '' ? 'tel:' . $digits : '';
}

// Версия файла для адреса (?v=…): после изменения браузер скачает новый файл, а не возьмёт старый из кэша
function asset_v(string $path): string
{
    return (string)(@filemtime(ROOT_DIR . '/' . $path) ?: 0);
}
