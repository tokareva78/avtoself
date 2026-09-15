<?php
/**
 * send-form.php — обработчик формы модалки #modalForm проекта "Автоселф".
 * Архитектура и уровни защиты — те же, что отработаны на проекте
 * "Форвард Плюс" (см. references/forms-system.md скилла website-design-studio):
 *   1. Origin/Referer  2. Обязательные тех.поля (honeypot, timer)
 *   3. Honeypot        4. Таймер заполнения     5. Rate-limit по IP
 *   6. Спам-метки      6.1 Одинаковое значение в разных полях
 *   7. Реестр полей — сервер сам решает подпись/правило/обязательность
 *      для каждого известного поля, полностью игнорируя то, что скажет
 *      об этом сам запрос. Неизвестные поля молча игнорируются.
 *   8. Rate-limit по контакту (телефон)
 *
 * Требования: PHP 7.4+, расширение curl. Для email — composer-пакет
 * phpmailer/phpmailer (папка vendor/ рядом с этим файлом).
 */

// ============================================================
//                      Н А С Т Р О Й К И
// ============================================================

// --- Email (через SMTP) -------------------------------------------------
define('SMTP_HOST', '');                 // например: smtp.yandex.ru — пусто = канал выключен
define('SMTP_PORT', 465);
define('SMTP_USER', '');
define('SMTP_PASS', '');                 // пароль ПРИЛОЖЕНИЯ, не обычный пароль от почты
define('MAIL_TO',   '');
define('MAIL_FROM_NAME', 'Заявка с сайта Автоселф');

// --- MAX ------------------------------------------------------------------
define('MAX_BOT_TOKEN', '');
define('MAX_CHAT_ID',   '');
define('MAX_API_BASE', 'https://platform-api2.max.ru'); // сверяться с https://dev.max.ru/docs-api при сбоях

// --- Telegram ---------------------------------------------------------------
define('TG_BOT_TOKEN', '');
define('TG_CHAT_ID',   '');

// Порядок = приоритет. Первый непустой (настроенный) канал — основной.
$CHANNELS = ['max', 'email', 'telegram'];

// Технические поля, обязательные в каждом запросе от настоящей формы сайта.
$REQUIRED_TECH_FIELDS = ['honeypot', 'timer'];
$MIN_FILL_TIME = 2.5; // сек — меньше считаем ботом

// --- Origin/Referer ---------------------------------------------------------
// Заполните доменом сайта перед боевым запуском, например 'avtoself.ru'.
define('ALLOWED_ORIGIN_HOST', '');

// --- Rate-limit ---------------------------------------------------------------
define('RATE_LIMIT_WINDOW', 600);
define('RATE_LIMIT_MAX_PER_IP', 3);
define('RATE_LIMIT_MAX_PER_CONTACT', 2);
define('RATE_LIMIT_FILE', __DIR__ . '/rate-limit-store.json');

// --- Спам-метки в тексте ---------------------------------------------------
define('SPAM_MARKERS', [
    'http://', 'https://', 'www.',
    'viagra', 'casino', 'казино', 'crypto', 'криптовалют', 'bitcoin', 'forex',
    'заработ', 'seo-продвижен', 'кредит без справок',
]);

// --- Реестр полей формы -----------------------------------------------------
// Ровно те поля, что реально есть в форме #modalForm (см. index.html).
// Подписи — те же, что уже указаны в data-form-send в разметке.
$KNOWN_FIELDS = [
    'name'         => ['label' => 'Имя',                    'rule' => 'text',  'required' => true, 'min' => 2, 'max' => 26],
    'phone'        => ['label' => 'Телефон',                 'rule' => 'phone', 'required' => true],
    'check'        => ['label' => '',                        'rule' => '',      'required' => true], // согласие — техническое, в сообщение не идёт
    'utm_source'   => ['label' => 'UTM Источник',             'rule' => '',      'required' => false],
    'utm_medium'   => ['label' => 'UTM Тип трафика',          'rule' => '',      'required' => false],
    'utm_campaign' => ['label' => 'UTM Кампания',             'rule' => '',      'required' => false],
    'utm_content'  => ['label' => 'UTM Объявление',           'rule' => '',      'required' => false],
    'utm_term'     => ['label' => 'UTM Ключевое слово',       'rule' => '',      'required' => false],
];

// ============================================================
//                 /Н А С Т Р О Й К И   К О Н Е Ц
// ============================================================

header('Content-Type: application/json; charset=utf-8');

function respond($ok, $message, $extra = []) {
    echo json_encode(array_merge(['ok' => $ok, 'message' => $message], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Метод не поддерживается.');
}

// ---------- 1. Origin/Referer ----------
function check_origin() {
    if (ALLOWED_ORIGIN_HOST === '') return true;
    $ref    = $_SERVER['HTTP_REFERER'] ?? '';
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $host   = parse_url($ref ?: $origin, PHP_URL_HOST);
    return $host === ALLOWED_ORIGIN_HOST;
}
if (!check_origin()) {
    respond(false, 'Заявка отклонена.');
}

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    respond(false, 'Некорректный запрос.');
}

// ---------- 2. Обязательные технические поля ----------
foreach ($REQUIRED_TECH_FIELDS as $tech) {
    if (!array_key_exists($tech, $data)) {
        respond(false, 'Заявка отклонена.');
    }
}

// ---------- 3. Honeypot ----------
if (trim((string)$data['honeypot']) !== '') {
    respond(false, 'Заявка отклонена.');
}

// ---------- 4. Таймер заполнения ----------
$timer = isset($data['timer']) ? floatval($data['timer']) : 0;
if ($timer < $MIN_FILL_TIME) {
    respond(false, 'Заявка отклонена.');
}

// ---------- 5. Rate-limit по IP ----------
function check_rate_limit($key, $max, $window) {
    $fp = @fopen(RATE_LIMIT_FILE, 'c+');
    if (!$fp) return true;
    flock($fp, LOCK_EX);

    $raw   = stream_get_contents($fp);
    $store = json_decode($raw, true);
    if (!is_array($store)) $store = [];

    $now = time();
    foreach ($store as $k => $timestamps) {
        $store[$k] = array_values(array_filter((array)$timestamps, function ($t) use ($now, $window) {
            return ($now - $t) < $window;
        }));
        if (empty($store[$k])) unset($store[$k]);
    }

    $count   = isset($store[$key]) ? count($store[$key]) : 0;
    $allowed = $count < $max;
    if ($allowed) $store[$key][] = $now;

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($store));
    flock($fp, LOCK_UN);
    fclose($fp);

    return $allowed;
}

$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
if (!check_rate_limit('ip:' . $clientIp, RATE_LIMIT_MAX_PER_IP, RATE_LIMIT_WINDOW)) {
    respond(false, 'Слишком много попыток. Попробуйте немного позже.');
}

// ---------- 6. Спам-метки ----------
function contains_spam_markers($text) {
    $lower = mb_strtolower($text);
    foreach (SPAM_MARKERS as $marker) {
        if (mb_strpos($lower, mb_strtolower($marker)) !== false) return true;
    }
    return false;
}

$fields = (isset($data['fields']) && is_array($data['fields'])) ? $data['fields'] : [];

foreach ($fields as $f) {
    $value = isset($f['value']) ? trim((string)$f['value']) : '';
    if ($value !== '' && contains_spam_markers($value)) {
        respond(false, 'Заявка отклонена.');
    }
}

// ---------- 6.1. Одинаковое значение в нескольких разных полях ----------
$valueCounts = [];
foreach ($fields as $f) {
    $v = isset($f['value']) ? trim((string)$f['value']) : '';
    if (mb_strlen($v) < 2) continue;
    $valueCounts[$v] = ($valueCounts[$v] ?? 0) + 1;
}
foreach ($valueCounts as $v => $count) {
    if ($count >= 3) {
        respond(false, 'Заявка отклонена.');
    }
}

// ---------- 7. Валидация по реестру полей (сервер не доверяет rule/required/label из запроса) ----------
$errors = [];
$clean  = [];
$labels = [];

foreach ($fields as $f) {
    $name = isset($f['name']) ? (string)$f['name'] : '';
    if ($name === '' || !isset($KNOWN_FIELDS[$name])) continue; // неизвестное поле — молча игнорируем

    $schema   = $KNOWN_FIELDS[$name];
    $value    = isset($f['value']) ? trim((string)$f['value']) : '';
    $required = $schema['required'];
    $rule     = $schema['rule'];
    $label    = $schema['label'];

    if ($required && $value === '') {
        $errors[$name] = 'Поле обязательно для заполнения';
        continue;
    }

    if ($value !== '' && $rule !== '') {
        $bounds = ['minlength' => $schema['min'] ?? 1, 'maxlength' => $schema['max'] ?? 200];
        $err = validate_field($value, $rule, $bounds);
        if ($err) {
            $errors[$name] = $err;
            continue;
        }
    }

    $clean[$name] = normalize_value($value, $rule);
    if ($label !== '') {
        $labels[$name] = $label;
    }
}

if (!empty($errors)) {
    respond(false, 'Проверьте поля формы.', ['errors' => $errors]);
}

function validate_field($value, $rule, $bounds) {
    switch ($rule) {
        case 'email':
            if (!preg_match('/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/', $value)) {
                return 'Введите корректный email';
            }
            break;
        case 'phone':
            $digits = preg_replace('/\D/', '', $value);
            if (strlen($digits) !== 11) {
                return 'Введите телефон полностью';
            }
            break;
        case 'text':
            $min = $bounds['minlength'];
            $max = $bounds['maxlength'];
            $len = mb_strlen($value);
            if ($len < $min || $len > $max) {
                return "От {$min} до {$max} символов";
            }
            if (!preg_match('/^[a-zA-Zа-яА-ЯёЁ\s\-]+$/u', $value)) {
                return 'Разрешены только буквы, пробел и дефис';
            }
            break;
        case 'message':
            $max = $bounds['maxlength'];
            $len = mb_strlen($value);
            if ($len > $max) {
                return "Не более {$max} символов";
            }
            if (preg_match('/(https?:\/\/|www\.|[a-zA-Zа-яА-ЯёЁ0-9-]+\.(ru|com|рф|net|org|io|me))/iu', $value)) {
                return 'Ссылки в этом поле не разрешены';
            }
            if (!preg_match('/^[а-яА-ЯёЁ0-9\s.,!?()\-:;\n]+$/u', $value)) {
                return 'Разрешены только русские буквы и знаки препинания';
            }
            break;
    }
    return null;
}

function normalize_value($value, $rule) {
    if ($rule === 'phone') {
        $digits = preg_replace('/\D/', '', $value);
        if (strlen($digits) === 11 && $digits[0] === '8') {
            $digits = '7' . substr($digits, 1);
        }
        return '+' . $digits;
    }
    return $value;
}

// ---------- 8. Rate-limit по контакту ----------
foreach (['phone', 'email'] as $contactField) {
    if (isset($clean[$contactField]) && $clean[$contactField] !== '') {
        if (!check_rate_limit('contact:' . $clean[$contactField], RATE_LIMIT_MAX_PER_CONTACT, RATE_LIMIT_WINDOW)) {
            respond(false, 'Заявка с этими контактными данными уже отправлена недавно.');
        }
    }
}

// ---------- 9. Сообщение из подписанных полей ----------
$lines = [];
foreach ($labels as $name => $label) {
    if (isset($clean[$name]) && $clean[$name] !== '') {
        $lines[] = $label . ': ' . $clean[$name];
    }
}
$messageText = $lines ? implode("\n", $lines) : 'Новая заявка с сайта Автоселф';

// ---------- 10. Рассылка по каналам ----------
$sentVia = [];
foreach ($CHANNELS as $channel) {
    $ok = false;
    try {
        if ($channel === 'email' && SMTP_HOST !== '' && MAIL_TO !== '') {
            $ok = send_via_email($messageText);
        } elseif ($channel === 'max' && MAX_BOT_TOKEN !== '' && MAX_CHAT_ID !== '') {
            $ok = send_via_max($messageText);
        } elseif ($channel === 'telegram' && TG_BOT_TOKEN !== '' && TG_CHAT_ID !== '') {
            $ok = send_via_telegram($messageText);
        }
    } catch (Throwable $e) {
        $ok = false;
    }
    if ($ok) $sentVia[] = $channel;
}

if (empty($sentVia)) {
    respond(false, 'Не удалось отправить заявку. Позвоните нам, пожалуйста, напрямую.');
}

respond(true, 'Заявка отправлена!', ['sent_via' => $sentVia]);


// ============================================================
//                      К А Н А Л Ы
// ============================================================

function send_via_email($text) {
    $autoload = __DIR__ . '/vendor/autoload.php';
    if (!file_exists($autoload)) return false;
    require_once $autoload;

    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    $mail->isSMTP();
    $mail->Host       = SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = SMTP_USER;
    $mail->Password   = SMTP_PASS;
    $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = SMTP_PORT;
    $mail->CharSet    = 'UTF-8';

    $mail->setFrom(SMTP_USER, MAIL_FROM_NAME);
    $mail->addAddress(MAIL_TO);
    $mail->Subject = 'Новая заявка с сайта Автоселф';
    $mail->Body    = $text;

    return $mail->send();
}

function send_via_max($text) {
    $ch = curl_init(MAX_API_BASE . '/messages?chat_id=' . urlencode(MAX_CHAT_ID));
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Authorization: ' . MAX_BOT_TOKEN, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode(['chat_id' => MAX_CHAT_ID, 'text' => $text], JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT        => 8,
    ]);
    curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code >= 200 && $code < 300;
}

function send_via_telegram($text) {
    $ch = curl_init('https://api.telegram.org/bot' . TG_BOT_TOKEN . '/sendMessage');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POSTFIELDS     => http_build_query(['chat_id' => TG_CHAT_ID, 'text' => $text]),
        CURLOPT_TIMEOUT        => 8,
    ]);
    curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code >= 200 && $code < 300;
}
