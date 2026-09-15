<?php
$logFile = __DIR__ . '/logs/form-antispam.log'; // Путь к твоему лог-файлу
$top = [];
if (file_exists($logFile)) {
    foreach (file($logFile) as $line) {
        // Вытаскиваем IP по шаблону "IP: x.x.x.x;"
        if (preg_match('/IP: ([\d\.]+);/', $line, $m)) {
            $ip = $m[1];
            @$top[$ip]++;
        }
    }
}
arsort($top);
echo "Топ 10 атакующих IP:\n";
$n = 1;
foreach (array_slice($top, 0, 10, true) as $ip => $count) {
    echo "$n. $ip — $count\n";
    $n++;
}
