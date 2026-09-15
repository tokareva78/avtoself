<?php
// === Ваши настройки для Telegram ===
$token = '6236659804:AAEuwjUmHeBxPMyjxDGKXyjq3brEITVytBU'; // ЗАМЕНИ на админский - для проверки спама
$chat_id = '-1001986825172';   // ЗАМЕНИ на админский - для проверки спама
// === Параметры анализа ===
$logFile = __DIR__ . '/logs/form-antispam.log';
$minutes = 60;    // За какой промежуток анализировать (например, за последний час)
$topN = 5;        // Сколько IP в топе отправлять
$minCount = 10;   // Минимальное число попыток для отчёта

// === Собираем статистику по логам ===
$since = time() - $minutes*60;
$top = [];

if (file_exists($logFile)) {
    foreach (file($logFile) as $line) {
        if (preg_match('/\[(.*?)\].*IP: ([\d\.]+);/', $line, $m)) {
            $when = strtotime($m[1]);
            if ($when >= $since) {
                $ip = $m[2];
                @$top[$ip]++;
            }
        }
    }
}

arsort($top);
$filtered = array_filter($top, fn($cnt) => $cnt >= $minCount);

if ($filtered) {
    $msg = "⚠️ Топ атакующих IP за {$minutes} минут:";
    $n = 1;
    foreach (array_slice($filtered, 0, $topN, true) as $ip => $cnt) {
        $msg .= "\n$n. $ip — $cnt";
        $n++;
    }
    file_get_contents("https://api.telegram.org/bot{$token}/sendMessage?chat_id={$chat_id}&text=".urlencode($msg));
}
