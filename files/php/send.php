<?php

function sendSpamTelegramAlert($count, $minutes) {
    $token_admin = '6236659804:AAEuwjUmHeBxPMyjxDGKXyjq3brEITVytBU'; // админский - для проверки спама
    $chat_id_admin = '-1001986825172';   // админский - для проверки спама
    $text = "‼️ СПАМ-атака: за последние {$minutes} минут отклонено {$count} заявок!\nПроверьте логи и добавьте ограничения.";
    file_get_contents("https://api.telegram.org/bot{$token_admin}/sendMessage?chat_id={$chat_id_admin}&text=" . urlencode($text));
}

function logAntispam($reason, $extra = []) {
    $line = '['.date('Y-m-d H:i:s').'] ';
    $line .= 'IP: '.($_SERVER['REMOTE_ADDR'] ?? '-') . '; ';
    $line .= 'UA: '.($_SERVER['HTTP_USER_AGENT'] ?? '-') . '; ';
    $line .= 'Reason: ' . $reason . '; ';
    if ($extra) $line .= "Details: " . json_encode($extra, JSON_UNESCAPED_UNICODE);
    $line .= PHP_EOL;
    $logFile = __DIR__.'/logs/form-antispam.log';
    file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);

    // --- ПРОВЕРКА ЧАСТОТЫ СПАМА ---
    $threshold = 100;       // сколько событий за X минут считаем "атакой"
    $windowMinutes = 10;    // X минут
    $since = time() - $windowMinutes*60;
    $recent = 0;
    if (file_exists($logFile)) {
        $lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach (array_reverse($lines) as $row) {
            preg_match('/\[(.*?)\]/', $row, $m);
            $time = isset($m[1]) ? strtotime($m[1]) : 0;
            if ($time && $time >= $since) ++$recent;
            else break;
        }
    }
    if ($recent >= $threshold) {
        sendSpamTelegramAlert($recent, $windowMinutes);
    }
}




error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Обработка preflight-запроса
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Проверяем метод запроса
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Метод не разрешён'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Получаем данные из POST
$json = file_get_contents('php://input');
$data = json_decode($json, true);



// Проверяем, что данные пришли и это массив
if (!$data || !is_array($data) || count($data) === 0) {
    http_response_code(400);
    echo json_encode([
        'success' => false, 
        'message' => 'Неверные данные'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}


// ====== АНТИСПАМ ======
// Honeypot базовая защита
if (!empty($_POST['middle_name']) || (!empty($data['middle_name']) && $data['middle_name']['value'] !== '')) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'СПАМ!'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// honeypot (поля могут прилетать и как обычные POST, и через $data если JSON)
$honeypot = '';
if (!empty($_POST['middle_name'])) {
    $honeypot = $_POST['middle_name'];
} elseif (!empty($data['middle_name']['value'])) {
    $honeypot = $data['middle_name']['value'];
}
if (!empty($honeypot)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'CПАМ! (honeypot)'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// timestamp
$formStart = 0;
if (!empty($_POST['form_start'])) {
    $formStart = (int)$_POST['form_start'];
} elseif (!empty($data['form_start']['value'])) {
    $formStart = (int)$data['form_start']['value'];
}
$now = time();
if (!$formStart || $now - $formStart < 3) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Форма отправлена слишком быстро'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}


session_start();

// Обычный rate-limit: минимум 30 секунд между отправками с одного IP/session
// Можно использовать 10, 20, 30 секунд — в зависимости от степени критичности.
if (!empty($_SESSION['last_form_submit'])) {
    $seconds_ago = time() - $_SESSION['last_form_submit'];
    if ($seconds_ago < 30) {
        http_response_code(429);
        echo json_encode([
            'success' => false,
            'message' => 'Пожалуйста, подождите перед повторной отправкой (' . (30 - $seconds_ago) . ' сек.)'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
$_SESSION['last_form_submit'] = time();




// АНАЛИЗ USER-AGENT accept-language
$user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
if (empty($user_agent) || stripos($user_agent, 'bot') !== false || stripos($user_agent, 'curl') !== false) {
    logAntispam('bad user-agent', ['ua'=>$user_agent]);
    http_response_code(400);
    echo json_encode(['success'=>false,'message'=>'Подозрительный User-Agent'], JSON_UNESCAPED_UNICODE); exit;
}
$accept_lang = $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '';
if (empty($accept_lang)) {
    logAntispam('no accept-language', []);
    http_response_code(400);
    echo json_encode(['success'=>false,'message'=>'Нет языка браузера'], JSON_UNESCAPED_UNICODE); exit;
}


// ВАЛИДАЦИЯ ИМЕНИ
$name = !empty($data['name']['value']) ? trim($data['name']['value']) : '';
if (!preg_match('/^[а-яёА-ЯЁ\s-]{2,26}$/u', $name)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Имя: только русские буквы, пробел или дефис, длина 2–26 символов'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
if (preg_match('/(.)\1\1+/u', $name)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Имя: не может быть более двух одинаковых символов подряд'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ВАЛИДАЦИЯ ТЕЛЕФОНА (обязателен)
$phone = !empty($data['phone']['value']) ? preg_replace('/\D+/', '', $data['phone']['value']) : '';

if ($phone === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Телефон обязателен'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Нормализация как во фронте
if (strlen($phone) === 11 && $phone[0] === '8') {
    $phone = '7' . substr($phone, 1);
} elseif (strlen($phone) === 10) {
    $phone = '7' . $phone;
}

if (!preg_match('/^79\d{9}$/', $phone)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Телефон должен быть в формате +7 (9XX) XXX-XX-XX'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// при желании можно сохранить обратно в $data:
$data['phone']['value'] = '+7' . substr($phone, 1);


// ВАЛИДАЦИЯ EMAIL (обязателен, если поле вообще есть в форме)
$email = null;
$emailFieldExists = array_key_exists('email', $data) && isset($data['email']['value']);

if ($emailFieldExists) {
    $email = trim((string)$data['email']['value']);

    // 1) Пусто — ошибка
    if ($email === '') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Email обязателен'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // 2) Заполнен, но кривой — тоже ошибка
    if (!preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/u', $email)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Email: введите адрес вида name@mail.ru'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // при желании можно сохранить нормализованный email обратно
    $data['email']['value'] = $email;
}
// =====================================
// НАСТРОЙКИ (ЗАМЕНИТЕ НА СВОИ!)
// =====================================

/// Telegram Bot
$telegram_token = '6236659804:AAEuwjUmHeBxPMyjxDGKXyjq3brEITVytBU';
$telegram_chat_id = '-1001986825172';

// Max API
$max_token = 'f9LHodD0cOIc95Y2QruUCZ17BbztuoF3Whca2-K-cgHVS0QQt4eGxauCl4J92ngSXJBIX-eehyiTE7K5mliN'; 
$max_chat_id = -72456063800786;


// Email
$to_email = 'tokareva78@internet.ru'; 
$from_email = 'noreply@' . $_SERVER['HTTP_HOST'];

// =====================================
// 1. ФОРМИРУЕМ СООБЩЕНИЕ (HTML формат для Max и TG)
// =====================================

// --- сформируем сообщение ---
$message = "<b>📨 Новая заявка с сайта " . ($_SERVER['HTTP_HOST'] ?? 'сайт') . "</b>\n\n";

// Эти поля валидируются, НО в сообщение не попадают
$SKIP_IN_MESSAGE = ['form_start', 'agreement'];

foreach ($data as $key => $field) {
    if (in_array($key, $SKIP_IN_MESSAGE, true)) continue;

    if (isset($field['label']) && isset($field['value'])) {
        
        // Если значение пустое (просто пробелы или ничего), пропускаем это поле
        if (trim((string)$field['value']) === '') {
            continue; 
        }
        
        $label = htmlspecialchars($field['label'], ENT_QUOTES, 'UTF-8');
        $raw = $field['value'];
        
        if (is_array($raw)) {
            if (array_key_exists('text', $raw)) $value = (string)$raw['text'];
            elseif (array_key_exists('value', $raw)) $value = (string)$raw['value'];
            elseif (array_is_list($raw)) {
                $parts = [];
                foreach ($raw as $item) {
                    if (is_array($item)) $parts[] = isset($item['text']) ? (string)$item['text'] : (isset($item['value']) ? (string)$item['value'] : '');
                    else $parts[] = (string)$item;
                }
                $value = implode(', ', array_filter($parts, fn($s) => $s !== ''));
            } else $value = json_encode($raw, JSON_UNESCAPED_UNICODE);
        } else $value = (string)$raw;

        if ($value === 'on') $value = 'Да';

        if ($key === 'phone') {
            $digits = preg_replace('/[^\d]/', '', $value);
            if (strlen($digits) === 11 && $digits[0] === '8') $digits[0] = '7';
            if (strlen($digits) === 10) $digits = '7' . $digits;
            $valueFormatted = preg_match('/^79\d{9}$/', $digits) ? '+7' . substr($digits, 1) : ($digits !== '' ? $digits : $value);
        } else {
            $valueFormatted = $value;
        }

        $labelEsc = $label;
        $valueEsc = htmlspecialchars($valueFormatted, ENT_QUOTES, 'UTF-8');
        $message .= "<b>{$labelEsc}:</b> {$valueEsc}\n";
    }
}

$message .= "\n⏰ <b>Дата:</b> " . date('d.m.Y H:i:s');
$message .= "\n🌐 <b>IP:</b> " . $_SERVER['REMOTE_ADDR'];

// =====================================
// 2. ОТПРАВКА В MAX (ПРИОРИТЕТ)
// =====================================

$max_success = false;
$max_error_log = '';

if (!empty($max_token) && $max_token !== 'ТВОЙ_ТОКЕН_MAX_ЗДЕСЬ') {
    // chat_id передаём в URL
    $max_url = "https://platform-api.max.ru/messages?chat_id=" . urlencode($max_chat_id);

    $max_payload = [
    'text'   => $message,
    'format' => 'html',
];

  $max_options = [
        'http' => [
            'method'  => 'POST',
            'header'  => "Content-Type: application/json\r\n" .
                         "Authorization: " . $max_token . "\r\n",
            'content' => json_encode($max_payload, JSON_UNESCAPED_UNICODE),
            'timeout' => 15,
            'ignore_errors' => true
        ]
    ];

    $max_context  = stream_context_create($max_options);
    $max_response = @file_get_contents($max_url, false, $max_context);

    if ($max_response !== false) {
        $http_response_header = $http_response_header ?? [];
        if (!empty($http_response_header[0]) && strpos($http_response_header[0], '200') !== false) {
            $max_success = true;
        } else {
            $max_error_log = "Max API HTTP Error: " . $http_response_header[0] . " | Response: " . $max_response;
        }
    } else {
        $max_error_log = "Max API Connection failed";
    }
}

// =====================================
// 3. ОТПРАВКА В TELEGRAM (ФОНОВАЯ, БЕЗ БЛОКИРОВКИ)
// =====================================
$telegram_success = false;

if ($telegram_token !== 'YOUR_BOT_TOKEN' && $telegram_chat_id !== 'YOUR_CHAT_ID') {
    $telegram_url = "https://api.telegram.org/bot{$telegram_token}/sendMessage";
    $telegram_data = [
        'chat_id' => $telegram_chat_id,
        'text' => $message,
        'parse_mode' => 'HTML'
    ];
    
    $tg_options = [
        'http' => [
            'method'  => 'POST',
            'header'  => 'Content-Type: application/x-www-form-urlencoded',
            'content' => http_build_query($telegram_data),
            'timeout' => 3, 
            'ignore_errors' => true
        ]
    ];
    
    $tg_context = stream_context_create($tg_options);
    $telegram_response = @file_get_contents($telegram_url, false, $tg_context);
    
    if ($telegram_response !== false) {
        $telegram_result = json_decode($telegram_response, true);
        $telegram_success = isset($telegram_result['ok']) && $telegram_result['ok'];
    }
}

// =====================================
// 4. ОТПРАВКА НА EMAIL
// =====================================
$email_success = false;
if ($to_email !== 'your-email@example.com') {
    $subject = 'Новая заявка с сайта ' . $_SERVER['HTTP_HOST'];
    $email_message = nl2br($message);
    $headers = "MIME-Version: 1.0\r\nContent-type: text/html; charset=utf-8\r\nFrom: {$from_email}\r\nReply-To: {$from_email}\r\n";
    $email_success = @mail($to_email, $subject, $email_message, $headers);
}

// =====================================
// 5. ЛОГИРОВАНИЕ И ОТВЕТ
// =====================================
$log_file = __DIR__ . '/form-logs.txt';
$log_message = "[" . date('Y-m-d H:i:s') . "]\n";
$log_message .= "Max: " . ($max_success ? 'OK' : 'FAIL (' . $max_error_log . ')') . "\n";
$log_message .= "Telegram: " . ($telegram_success ? 'OK' : 'FAIL/TIMEOUT') . "\n";
$log_message .= "Email: " . ($email_success ? 'OK' : 'FAIL') . "\n";
$log_message .= "Data:\n" . strip_tags($message) . "\n";
$log_message .= str_repeat('-', 50) . "\n\n";
@file_put_contents($log_file, $log_message, FILE_APPEND);

// Считаем успешным, если ушло ХОТЯ БЫ куда-то (желательно в Max)
if ($max_success || $telegram_success || $email_success) {
    echo json_encode(['success' => true, 'message' => 'Сообщение успешно отправлено'], JSON_UNESCAPED_UNICODE);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка отправки данных'], JSON_UNESCAPED_UNICODE);
}
?>
