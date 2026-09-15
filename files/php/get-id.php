<?php
$max_token = "f9LHodD0cOIba-gNZpKFXQD-q2wgAGZVyH6APSrXoiNlCWyjkgFrBuvGBj6HUmBW7dDVr4wpBzpUYK9efPbL"; // Вставьте ваш токен max бота
$url = "https://platform-api.max.ru/updates";

$opts = [
    'http' => [
        'method'  => 'GET',
        'header'  => "Authorization: $max_token\r\n" // Токен передается в заголовке
    ]
];

$context = stream_context_create($opts);
$response = file_get_contents($url, false, $context);

// Выводим полученный JSON на экран в читаемом виде
echo "<pre>";
print_r(json_decode($response, true));
echo "</pre>";
