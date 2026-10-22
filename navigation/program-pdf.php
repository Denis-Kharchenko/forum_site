<?php
// Скачать программу форума в PDF — всегда последняя версия из админки
declare(strict_types=1);

require_once __DIR__ . '/../lib/schedule-pdf.php';

$s = load_schedule();
$pdf = schedule_pdf($s, load_content()['settings']);
[$y, $m, $d] = explode('-', $s['date']);
$name = "Программа ФРМ {$d}.{$m}.{$y}.pdf";

header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="programma-frm-' . "{$d}-{$m}-{$y}" . '.pdf"; filename*=UTF-8\'\'' . rawurlencode($name));
header('Content-Length: ' . strlen($pdf));
header('Cache-Control: no-cache, must-revalidate');
echo $pdf;
