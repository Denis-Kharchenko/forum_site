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
    $s = str_field($v, 500);
    return preg_match('~^https?://~i', $s) ? $s : '';
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

function normalize_content(array $d): array
{
    $c = is_array($d['contacts'] ?? null) ? $d['contacts'] : [];
    $email = fn($v) => filter_var(str_field($v, 120), FILTER_VALIDATE_EMAIL) ?: '';

    return [
        'program' => list_field($d['program'] ?? [], fn($i) => [
            'time'  => str_field($i['time'] ?? '', 20),
            'title' => str_field($i['title'] ?? '', 200),
            'place' => str_field($i['place'] ?? '', 120),
        ]),
        'speakers' => list_field($d['speakers'] ?? [], fn($i) => [
            'name'  => str_field($i['name'] ?? '', 120),
            'role'  => str_field($i['role'] ?? '', 200),
            'photo' => image_field($i['photo'] ?? ''),
        ], 12),
        'speakers_more' => list_field($d['speakers_more'] ?? [], fn($i) => [
            'name' => str_field($i['name'] ?? '', 120),
            'role' => str_field($i['role'] ?? '', 200),
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
