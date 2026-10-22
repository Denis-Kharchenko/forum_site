<?php
// Программа форума в PDF — собирается из актуальной программы (админка «Навигация и программа»)
// при каждом скачивании: navigation/program-pdf.php.

declare(strict_types=1);

require_once __DIR__ . '/content.php';
require_once __DIR__ . '/schedule.php';
require_once __DIR__ . '/tfpdf/tfpdf.php';
require_once __DIR__ . '/tfpdf/font/unifont/ttfonts.php';   // в tFPDF 1.33 подключается автозагрузкой Composer

// Названия помещений и этажи: из navigation/data/rooms.js с правками из админки
function schedule_room_places(array $s): array
{
    $floors = [1 => '1 этаж', 2 => '2 этаж', 3 => '', 4 => '3 этаж'];   // план 3 — сам Главный холл
    $places = [];
    $js = (string)@file_get_contents(__DIR__ . '/../navigation/data/rooms.js');
    if (preg_match_all("~\{\s*id:\s*'([^']+)',\s*floor:\s*(\d)[^\n]*~u", $js, $m, PREG_SET_ORDER)) {
        foreach ($m as [$line, $id, $floor]) {
            if (!preg_match("~\bt1:\s*\[([^\]]*)\]~u", $line, $t)) continue;
            preg_match_all("~'([^']*)'~u", $t[1], $parts);
            $places[$id] = ['name' => str_replace('- ', '', implode(' ', $parts[1])), 'floor' => $floors[(int)$floor] ?? ''];
        }
    }
    foreach ((array)$s['rooms'] as $id => $o) {
        if (isset($places[$id]) && isset($o['name']) && trim($o['name']) !== '') $places[$id]['name'] = trim($o['name']);
    }
    return $places;
}

class SchedulePdf extends tFPDF
{
    public string $footer = '';

    function Footer(): void
    {
        $this->SetY(-12);
        $this->SetFont('DejaVu', '', 8);
        $this->SetTextColor(120, 120, 130);
        $this->Cell(0, 5, $this->footer, 0, 0, 'L');
        $this->Cell(0, 5, 'Стр. ' . $this->PageNo() . ' из {nb}', 0, 0, 'R');
    }
}

function hex_rgb(string $hex): array
{
    $hex = ltrim($hex, '#');
    if (!preg_match('/^[0-9a-f]{6}$/i', $hex)) return [36, 80, 236];
    return [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
}

function schedule_pdf(array $s, array $settings): string
{
    $months = [1 => 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    [$y, $mo, $d] = array_map('intval', explode('-', $s['date']));
    $dateText = $d . ' ' . $months[$mo] . ' ' . $y;
    $updated = $s['updated'] !== '' ? (new DateTime($s['updated']))->setTimezone(new DateTimeZone('Europe/Moscow'))->format('d.m.Y H:i') : '';

    $tracks = array_column($s['tracks'], null, 'id');
    $places = schedule_room_places($s);
    $placeOf = function (array $it) use ($places): string {
        if ($it['room'] === '') return $it['place'];
        $p = $places[$it['room']] ?? null;
        return $p ? $p['name'] . ($p['floor'] !== '' ? ', ' . $p['floor'] : '') : '';
    };

    // Интервалы по времени; одинаковые записи в разных треках — одна запись со списком треков
    $slots = [];
    foreach ($s['items'] as $it) {
        if ($it['start'] === '' || $it['title'] === '') continue;
        $key = $it['start'] . '|' . $it['end'];
        $slots[$key] ??= ['start' => $it['start'], 'end' => $it['end'], 'entries' => []];
        $sig = json_encode([$it['kind'], $it['title'], $it['speaker'], $it['room'], $it['place']]);
        $entry = &$slots[$key]['entries'][$sig];
        $entry ??= ['item' => $it, 'tracks' => []];
        if ($it['track'] !== 'all' && isset($tracks[$it['track']])) $entry['tracks'][] = $it['track'];
        else $entry['all'] = true;
        unset($entry);
    }
    ksort($slots);

    $pdf = new SchedulePdf('P', 'mm', 'A4');
    $pdf->SetTitle('Программа форума работающей молодёжи — ' . $dateText, true);
    $pdf->SetAuthor('Форум работающей молодёжи Санкт-Петербурга', true);
    $pdf->AddFont('DejaVu', '', 'DejaVuSansCondensed.ttf', true);
    $pdf->AddFont('DejaVu', 'B', 'DejaVuSansCondensed-Bold.ttf', true);
    $pdf->footer = 'Форум работающей молодёжи · ' . $dateText . ($updated !== '' ? ' · версия программы от ' . $updated : '');
    $pdf->AliasNbPages();
    $pdf->SetMargins(16, 14, 16);
    $pdf->SetAutoPageBreak(true, 16);
    $pdf->AddPage();
    $w = $pdf->GetPageWidth() - 32;
    $bottom = $pdf->GetPageHeight() - 16;

    // Шапка
    $pdf->SetFillColor(208, 11, 18);
    $pdf->Rect(16, 14, 3, 21, 'F');
    $pdf->SetXY(22, 14);
    $pdf->SetFont('DejaVu', 'B', 10);
    $pdf->SetTextColor(17, 17, 20);
    $pdf->Cell(0, 5, 'ФОРУМ РАБОТАЮЩЕЙ МОЛОДЁЖИ САНКТ-ПЕТЕРБУРГА', 0, 2);
    $pdf->SetFont('DejaVu', 'B', 20);
    $pdf->SetTextColor(36, 80, 236);
    $pdf->Cell(0, 9, 'Программа ' . $dateText, 0, 2);
    $pdf->SetFont('DejaVu', '', 10);
    $pdf->SetTextColor(80, 80, 90);
    $where = trim(implode(', ', array_filter([$settings['venue'] ?? '', $settings['address'] ?? ''])));
    $pdf->Cell(0, 6, $where !== '' ? $where : 'Санкт-Петербург', 0, 2);
    $pdf->SetY(40);

    // Высота записи до вывода — чтобы запись не рвалась между страницами, а время не отрывалось от первой записи
    $lines = function (string $text, string $style, float $size, float $width) use ($pdf): int {
        $pdf->SetFont('DejaVu', $style, $size);
        $n = 0;
        foreach (explode("\n", $text) as $para) {
            $line = '';
            $n++;
            foreach (preg_split('/\s+/u', $para) as $word) {
                $try = $line === '' ? $word : $line . ' ' . $word;
                if ($line !== '' && $pdf->GetStringWidth($try) > $width - 2) { $n++; $line = $word; } else $line = $try;
            }
        }
        return $n;
    };
    $tw = $w - 5;
    $height = function (array $e) use ($lines, $tw, $tracks, $placeOf): float {
        $it = $e['item'];
        $h = 4 * $lines('ДЛЯ ВСЕХ ' . mb_strtoupper($it['kind'] . ' ' . implode(' · ', array_map(fn($id) => $tracks[$id]['name'], $e['tracks']))), 'B', 7.5, $tw)
            + 5.2 * $lines($it['title'], 'B', 11, $tw) + 3;
        if ($it['speaker'] !== '' && $it['speaker'] !== '?') $h += 4.4 * $lines($it['speaker'], '', 9, $tw);
        if ($placeOf($it) !== '') $h += 4.6;
        return $h;
    };

    foreach ($slots as $slot) {
        $time = $slot['start'] . ($slot['end'] !== '' ? '–' . $slot['end'] : '');
        // Сначала общие для всех, затем в порядке треков
        $entries = array_values($slot['entries']);
        $order = array_flip(array_keys($tracks));
        usort($entries, fn($a, $b) => (empty($a['all']) <=> empty($b['all'])) ?: (($order[$a['tracks'][0] ?? ''] ?? -1) <=> ($order[$b['tracks'][0] ?? ''] ?? -1)));

        // Строка времени — только вместе с первой записью
        if ($pdf->GetY() + 11.5 + $height($entries[0]) > $bottom) $pdf->AddPage();
        $pdf->Ln(2);
        $pdf->SetFillColor(233, 238, 254);
        $pdf->SetFont('DejaVu', 'B', 12);
        $pdf->SetTextColor(36, 80, 236);
        $pdf->Cell($w, 8, '  ' . $time, 0, 1, 'L', true);
        $pdf->Ln(1.5);

        foreach ($entries as $e) {
            $it = $e['item'];
            $all = !empty($e['all']) || count($e['tracks']) === count($tracks);
            $color = $all ? [17, 17, 20] : hex_rgb($tracks[$e['tracks'][0]]['color']);
            $label = $all ? 'Для всех участников' : implode(' · ', array_map(fn($id) => $tracks[$id]['name'], $e['tracks']));
            if ($pdf->GetY() + $height($e) > $bottom) $pdf->AddPage();
            $y0 = $pdf->GetY();
            $x = 21;

            $pdf->SetXY($x, $y0);
            $pdf->SetFont('DejaVu', 'B', 7.5);
            $pdf->SetTextColor(...$color);
            $kind = $it['kind'] !== '' && $it['kind'] !== 'Общее' ? mb_strtoupper($it['kind']) . '  ·  ' : '';
            $pdf->MultiCell($tw, 4, $kind . mb_strtoupper($label), 0, 'L');
            $pdf->SetX($x);
            $pdf->SetFont('DejaVu', 'B', 11);
            $pdf->SetTextColor(17, 17, 20);
            $pdf->MultiCell($tw, 5.2, $it['title'], 0, 'L');
            if ($it['speaker'] !== '' && $it['speaker'] !== '?') {
                $pdf->SetX($x);
                $pdf->SetFont('DejaVu', '', 9);
                $pdf->SetTextColor(80, 80, 90);
                $pdf->MultiCell($tw, 4.4, $it['speaker'], 0, 'L');
            }
            $place = $placeOf($it);
            if ($place !== '') {
                $pdf->SetX($x);
                $pdf->SetFont('DejaVu', 'B', 9);
                $pdf->SetTextColor(36, 80, 236);
                $pdf->MultiCell($tw, 4.6, 'Где: ' . $place, 0, 'L');
            }
            $y1 = $pdf->GetY();
            // цветная черта трека слева
            $pdf->SetFillColor(...$color);
            if ($y1 > $y0) $pdf->Rect(16, $y0, 1.6, $y1 - $y0, 'F');
            $pdf->Ln(3);
        }
    }
    return $pdf->Output('S');
}
