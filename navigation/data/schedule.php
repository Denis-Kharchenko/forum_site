<?php
// Программа для навигации и стоек: то же, что раньше лежало в data/schedule.js,
// но берётся из админки сайта (admin/navigation.php).
declare(strict_types=1);

require_once __DIR__ . '/../../lib/schedule.php';

header('Content-Type: text/javascript; charset=utf-8');
header('X-Content-Type-Options: nosniff');
// Правки из админки видны сразу, без «подождите 1–2 минуты»
header('Cache-Control: no-cache, must-revalidate');

echo "/* Программа форума. Заполняется в админке сайта: /admin/ → «Навигация и программа». */\n";
echo 'window.FORUM_SCHEDULE = ', json_encode(load_schedule(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_PRETTY_PRINT), ";\n";
