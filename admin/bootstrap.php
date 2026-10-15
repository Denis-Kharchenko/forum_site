<?php
// Общее для страниц админки: сессия, вход по паролю, CSRF, ответы в JSON.
declare(strict_types=1);

require_once __DIR__ . '/../lib/content.php';

const AUTH_FILE     = DATA_DIR . '/auth.php';
const ATTEMPTS_FILE = DATA_DIR . '/attempts.php';
const MAX_ATTEMPTS  = 5;
const LOCK_SECONDS  = 900;

header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('forum_admin');
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_start();

if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

/* ---------- Хранилище пароля и попыток входа ---------- */

function php_store_read(string $file): array
{
    if (!is_file($file)) return [];
    $raw = (string)file_get_contents($file);
    $json = substr($raw, strpos($raw, "\n") + 1);
    return json_decode($json, true) ?: [];
}

function php_store_write(string $file, array $data): void
{
    ensure_data_dirs();
    // Первая строка не даёт прочитать файл через браузер: PHP просто завершится
    file_put_contents($file, "<?php http_response_code(404); exit; ?>\n" . json_encode($data), LOCK_EX);
}

function client_ip(): string
{
    return (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

function is_locked(): int
{
    $a = php_store_read(ATTEMPTS_FILE)[client_ip()] ?? null;
    if (!$a || $a['count'] < MAX_ATTEMPTS) return 0;
    $left = $a['time'] + LOCK_SECONDS - time();
    return max(0, $left);
}

function register_attempt(bool $ok): void
{
    $all = php_store_read(ATTEMPTS_FILE);
    $ip = client_ip();
    if ($ok) {
        unset($all[$ip]);
    } else {
        $prev = $all[$ip] ?? ['count' => 0, 'time' => time()];
        if (time() - $prev['time'] > LOCK_SECONDS) $prev = ['count' => 0, 'time' => time()];
        $all[$ip] = ['count' => $prev['count'] + 1, 'time' => time()];
    }
    // старые записи не копим
    foreach ($all as $k => $v) {
        if (time() - $v['time'] > LOCK_SECONDS * 4) unset($all[$k]);
    }
    php_store_write(ATTEMPTS_FILE, $all);
}

function is_logged_in(): bool
{
    return !empty($_SESSION['admin']);
}

function csrf_ok(): bool
{
    $token = $_POST['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    return is_string($token) && hash_equals($_SESSION['csrf'], $token);
}

// Для запросов из JS (сохранение, загрузка) — ответ в JSON
function check_csrf(): void
{
    if (!csrf_ok()) {
        json_out(['ok' => false, 'error' => 'Сессия устарела, обновите страницу'], 403);
    }
}

function json_out(array $data, int $code = 200): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function redirect_self(): never
{
    header('Location: ./');
    exit;
}

