<?php
// Админка сайта: вход, редактирование содержимого, загрузка картинок.
declare(strict_types=1);

require __DIR__ . '/../lib/content.php';

const AUTH_FILE     = DATA_DIR . '/auth.php';
const ATTEMPTS_FILE = DATA_DIR . '/attempts.php';
const MAX_ATTEMPTS  = 5;
const LOCK_SECONDS  = 900;
const MAX_UPLOAD    = 5 * 1024 * 1024;

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

function check_csrf(): void
{
    $token = $_POST['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (!is_string($token) || !hash_equals($_SESSION['csrf'], $token)) {
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

/* ---------- Загрузка картинок ---------- */

function handle_upload(string $kind): array
{
    $f = $_FILES['file'] ?? null;
    if (!$f || !is_array($f) || $f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
        return ['ok' => false, 'error' => 'Файл не загрузился. Попробуйте ещё раз'];
    }
    if ($f['size'] > MAX_UPLOAD) {
        return ['ok' => false, 'error' => 'Файл больше 5 МБ'];
    }
    $ext = strtolower(pathinfo((string)$f['name'], PATHINFO_EXTENSION));
    $ext = $ext === 'jpeg' ? 'jpg' : $ext;
    if (!in_array($ext, ['jpg', 'png', 'webp', 'svg'], true)) {
        return ['ok' => false, 'error' => 'Подходят только JPG, PNG, WebP или SVG'];
    }

    ensure_data_dirs();
    $name = $kind . '-' . date('Ymd') . '-' . bin2hex(random_bytes(5)) . '.' . $ext;
    $dest = UPLOADS_DIR . '/' . $name;

    if ($ext === 'svg') {
        $svg = (string)file_get_contents($f['tmp_name']);
        if (!preg_match('/<svg[\s>]/i', $svg)
            || preg_match('/<script|<foreignObject|<iframe|<!ENTITY|javascript:|\son[a-z]+\s*=|xlink:href\s*=\s*["\']\s*(?!#)|href\s*=\s*["\']\s*(?!#)/i', $svg)) {
            return ['ok' => false, 'error' => 'SVG содержит недопустимые элементы. Сохраните логотип как PNG'];
        }
        file_put_contents($dest, $svg);
        return ['ok' => true, 'path' => 'data/uploads/' . $name];
    }

    $info = @getimagesize($f['tmp_name']);
    $types = ['jpg' => IMAGETYPE_JPEG, 'png' => IMAGETYPE_PNG, 'webp' => IMAGETYPE_WEBP];
    if (!$info || $info[2] !== $types[$ext]) {
        return ['ok' => false, 'error' => 'Файл не похож на картинку'];
    }

    $max = $kind === 'speaker' ? 900 : 700;
    if (!resize_image($f['tmp_name'], $dest, $ext, $info[0], $info[1], $max)) {
        move_uploaded_file($f['tmp_name'], $dest);
    }
    return ['ok' => true, 'path' => 'data/uploads/' . $name];
}

// Уменьшает большие картинки, чтобы сайт не тормозил. Без GD просто сохраняет как есть.
function resize_image(string $src, string $dest, string $ext, int $w, int $h, int $max): bool
{
    if (!extension_loaded('gd') || max($w, $h) <= $max) return false;
    $open = ['jpg' => 'imagecreatefromjpeg', 'png' => 'imagecreatefrompng', 'webp' => 'imagecreatefromwebp'][$ext];
    if (!function_exists($open) || !($img = @$open($src))) return false;

    $k = $max / max($w, $h);
    $nw = (int)round($w * $k);
    $nh = (int)round($h * $k);
    $out = imagecreatetruecolor($nw, $nh);
    imagealphablending($out, false);
    imagesavealpha($out, true);
    imagecopyresampled($out, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);

    $ok = match ($ext) {
        'jpg'  => imagejpeg($out, $dest, 85),
        'png'  => imagepng($out, $dest, 6),
        'webp' => imagewebp($out, $dest, 85),
    };
    imagedestroy($img);
    imagedestroy($out);
    return $ok;
}

/* ---------- Действия ---------- */

$action = $_POST['action'] ?? '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $hasPassword = is_file(AUTH_FILE);

    if ($action === 'setup' && !$hasPassword) {
        check_csrf();
        $p1 = (string)($_POST['password'] ?? '');
        $p2 = (string)($_POST['password2'] ?? '');
        if (strlen($p1) < 10) {
            $error = 'Пароль должен быть не короче 10 символов';
        } elseif ($p1 !== $p2) {
            $error = 'Пароли не совпадают';
        } else {
            php_store_write(AUTH_FILE, ['hash' => password_hash($p1, PASSWORD_DEFAULT)]);
            session_regenerate_id(true);
            $_SESSION['admin'] = true;
            redirect_self();
        }
    } elseif ($action === 'login' && $hasPassword) {
        check_csrf();
        if ($left = is_locked()) {
            $error = 'Слишком много попыток. Попробуйте через ' . ceil($left / 60) . ' мин.';
        } else {
            $hash = php_store_read(AUTH_FILE)['hash'] ?? '';
            $ok = $hash !== '' && password_verify((string)($_POST['password'] ?? ''), $hash);
            register_attempt($ok);
            if ($ok) {
                session_regenerate_id(true);
                $_SESSION['admin'] = true;
                redirect_self();
            }
            $error = 'Неверный пароль';
        }
    } elseif ($action === 'logout') {
        check_csrf();
        $_SESSION = [];
        session_destroy();
        redirect_self();
    } elseif ($action === 'save' || $action === 'upload') {
        if (!is_logged_in()) json_out(['ok' => false, 'error' => 'Войдите заново'], 401);
        check_csrf();
        if ($action === 'upload') {
            $kind = ($_POST['kind'] ?? '') === 'partner' ? 'partner' : 'speaker';
            $res = handle_upload($kind);
            json_out($res, $res['ok'] ? 200 : 400);
        }
        $data = json_decode((string)($_POST['content'] ?? ''), true);
        if (!is_array($data)) json_out(['ok' => false, 'error' => 'Не удалось прочитать данные'], 400);
        save_content($data);
        json_out(['ok' => true, 'content' => load_content()]);
    }
}

$needsSetup = !is_file(AUTH_FILE);
$csrf = $_SESSION['csrf'];
?>
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Админка — Форум работающей молодёжи</title>
  <link rel="icon" href="../favicon.svg" type="image/svg+xml">
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="admin.css?v=<?= asset_v('admin/admin.css') ?>">
</head>
<body>
<?php if (!is_logged_in()): ?>
  <main class="auth">
    <form class="auth__card" method="post">
      <h1>Админка форума</h1>
      <?php if ($needsSetup): ?>
        <p class="muted">Первый вход: придумайте пароль. Он понадобится для всех следующих входов.</p>
        <label>Пароль (не короче 10 символов)<input type="password" name="password" autocomplete="new-password" minlength="10" required autofocus></label>
        <label>Пароль ещё раз<input type="password" name="password2" autocomplete="new-password" minlength="10" required></label>
        <input type="hidden" name="action" value="setup">
      <?php else: ?>
        <label>Пароль<input type="password" name="password" autocomplete="current-password" required autofocus></label>
        <input type="hidden" name="action" value="login">
      <?php endif; ?>
      <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
      <?php if ($error): ?><p class="error" role="alert"><?= e($error) ?></p><?php endif; ?>
      <button class="btn" type="submit"><?= $needsSetup ? 'Создать пароль и войти' : 'Войти' ?></button>
      <a class="muted small" href="../">← На сайт</a>
    </form>
  </main>
<?php else: ?>
  <header class="bar">
    <b class="bar__title">Админка форума</b>
    <nav class="tabs" role="tablist">
      <button type="button" class="tab is-active" data-tab="program">Программа</button>
      <button type="button" class="tab" data-tab="speakers">Спикеры</button>
      <button type="button" class="tab" data-tab="partners">Партнёры</button>
      <button type="button" class="tab" data-tab="contacts">Контакты</button>
    </nav>
    <div class="bar__actions">
      <span class="status" id="status" aria-live="polite"></span>
      <button type="button" class="btn" id="save">Сохранить</button>
      <a class="btn btn--ghost" href="../" target="_blank" rel="noopener">Открыть сайт</a>
      <form method="post"><input type="hidden" name="action" value="logout"><input type="hidden" name="csrf" value="<?= e($csrf) ?>"><button class="link" type="submit">Выйти</button></form>
    </div>
  </header>
  <main class="wrap" id="app"></main>
  <script id="content-data" type="application/json"><?= json_encode(load_content(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?></script>
  <script>window.CSRF = <?= json_encode($csrf) ?>;</script>
  <script src="admin.js?v=<?= asset_v('admin/admin.js') ?>"></script>
<?php endif; ?>
</body>
</html>
