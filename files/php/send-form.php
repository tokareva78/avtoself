<?php

/**
 * send-form.php — универсальный обработчик форм сайта.
 *
 * Уровни защиты от спама (проверяются по возрастанию цены — дешёвые и быстрые сначала,
 * чтобы не тратить время/ресурсы на дорогие проверки для запросов, которые и так отсеются):
 *   1. Origin/Referer          — запрос вообще пришёл с вашего сайта?
 *   2. Обязательные тех.поля   — honeypot и timer вообще присутствуют?
 *   3. Honeypot                — скрытое поле заполнено?
 *   4. Таймер заполнения       — форму отправили подозрительно быстро?
 *   5. Rate-limit по IP        — не слишком ли часто шлют с этого адреса?
 *   6. Спам-метки в тексте     — ссылки/стоп-слова в значениях полей?
 *   7. Валидация полей         — те же правила, что и на фронтенде (JS можно обойти).
 *   8. Rate-limit по контакту  — не шлют ли повторно с одного и того же телефона/email?
 *
 * Как это работает целиком:
 * Фронтенд шлёт сюда JSON (не обычный FormData) — так в одном запросе приезжают
 * и значения полей, и правила их проверки (data-js-required, data-js-validate,
 * подписи data-js-label) — форма сама себя описывает, поэтому один и тот же
 * send-form.php обслуживает ЛЮБУЮ форму сайта без правок под конкретную форму.
 *
 * Требования: PHP 7.4+, расширение curl. Для email — composer-пакет phpmailer/phpmailer.
 * Директория должна быть доступна на запись — сюда пишется rate-limit-store.json.
 */

// ============================================================
//                      Н А С Т Р О Й К И
// ============================================================

// --- Email (через SMTP) -------------------------------------------------
define('SMTP_HOST', 'smtp.yandex.ru');                 // например: smtp.yandex.ru — пусто = канал выключен
define('SMTP_PORT', 465);
define('SMTP_USER', 'aprepod@yandex.ru');                 // например: aprepod@yandex.ru
define('SMTP_PASS', '');                 // пароль ПРИЛОЖЕНИЯ, не обычный пароль от почты
define('MAIL_TO',   '');
define('MAIL_FROM_NAME', 'Заявка с сайта Автоселф');

// --- MAX ------------------------------------------------------------------
// Токен — у @MasterBot внутри MAX (команда /newbot).
define('MAX_BOT_TOKEN', '');
define('MAX_CHAT_ID',   '');
// Домен API менялся в 2026 — если отправка перестанет работать, сверьтесь с
// https://dev.max.ru/docs-api
define('MAX_API_BASE', 'https://platform-api2.max.ru');

// --- Telegram ---------------------------------------------------------------
// Токен — от @BotFather; chat_id — из https://api.telegram.org/bot<ТОКЕН>/getUpdates
// после того как вы один раз напишете боту любое сообщение.
define('TG_BOT_TOKEN', '');
define('TG_CHAT_ID',   '');

// Порядок = приоритет. Первый непустой (настроенный) канал — основной.
$CHANNELS = ['email', 'max', 'telegram'];

// Технические поля, обязательные в КАЖДОМ запросе от настоящей формы сайта.
$REQUIRED_TECH_FIELDS = ['honeypot', 'timer'];

// Меньше этого времени (сек) от открытия формы до отправки — считаем ботом.
$MIN_FILL_TIME = 2.5;

// --- Origin/Referer ---------------------------------------------------------
// Домен вашего сайта без протокола, например 'forward-plus.ru'. Пока пусто — проверка отключена (удобно на этапе разработки/тестирования). Заполните перед боевым запуском.
define('ALLOWED_ORIGIN_HOST', '');

// --- Rate-limit ---------------------------------------------------------------
define('RATE_LIMIT_WINDOW', 600);        // окно в секундах (10 минут)
define('RATE_LIMIT_MAX_PER_IP', 3);      // не больше стольки заявок с одного IP за окно
define('RATE_LIMIT_MAX_PER_CONTACT', 2); // не больше стольки заявок с одного телефона/email за окно
define('RATE_LIMIT_FILE', __DIR__ . '/rate-limit-store.json');

// --- Спам-метки в тексте ---------------------------------------------------
// Если в значении любого поля встречается ссылка или одно из стоп-слов — отклоняем.
// Это не тонкая лингвистика, а грубый быстрый фильтр против массовых заливок рекламы.
define('SPAM_MARKERS', [
    'http://', 'https://', 'www.',
    'viagra', 'casino', 'казино', 'crypto', 'криптовалют', 'bitcoin', 'forex',
    'заработ', 'seo-продвижен', 'кредит без справок',
]);

// ============================================================
//                 /Н А С Т Р О Й К И   К О Н Е Ц
// ============================================================

header('Content-Type: application/json; charset=utf-8');

function respond($ok, $message, $extra = [])
{
    echo json_encode(array_merge(['ok' => $ok, 'message' => $message], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Метод не поддерживается.');
}

// ---------- 1. Origin/Referer ----------
function check_origin()
{
    if (ALLOWED_ORIGIN_HOST === '') return true; // проверка отключена, пока не указан домен
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
/**
 * Простой файловый rate-limiter — без БД, достаточно для формы небольшого сайта.
 * Хранит { "ключ": [timestamp, timestamp, ...] } и сам чистит устаревшие записи.
 * При проблеме с файлом (нет прав на запись и т.п.) — не блокирует реальных
 * пользователей из-за технической неполадки, просто пропускает проверку.
 */
function check_rate_limit($key, $max, $window)
{
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
    if ($allowed) {
        $store[$key][] = $now;
    }

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($store));
    flock($fp, LOCK_UN);
    fclose($fp);

    return $allowed;
}

$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
if (!check_rate_limit('ip:' . $clientIp, RATE_LIMIT_MAX_PER_IP, RATE_LIMIT_WINDOW)) {
    respond(false, 'Слишком много попыток. Попробуйте немного позже или позвоните нам напрямую.');
}

// ---------- 6. Спам-метки в значениях полей ----------
function contains_spam_markers($text)
{
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

// ---------- 6.1. Одно и то же значение в нескольких разных полях ----------
// Характерный след примитивного бота, который вставляет один и тот же токен
// во все видимые поля подряд, не разбирая структуру формы (например
// "Имя: Иван, Категория: Иван, Тип заявки: Иван"). Живой человек так не заполняет.
$valueCounts = [];
foreach ($fields as $f) {
    $v = isset($f['value']) ? trim((string)$f['value']) : '';
    if (mb_strlen($v) < 2) continue; // короткие/пустые значения не показательны, пропускаем
    $valueCounts[$v] = ($valueCounts[$v] ?? 0) + 1;
}
foreach ($valueCounts as $v => $count) {
    if ($count >= 3) {
        respond(false, 'Заявка отклонена.');
    }
}

// ---------- 7. Реестр полей сайта — сервер сам знает, что реально есть в формах ----------
// Полный список полей со всех форм сайта: подпись для сообщения, правило проверки, обязательность и (для текстовых правил) границы длины — всё задаётся ЗДЕСЬ, а не берётся из запроса. Что бы клиент ни прислал в rule/required/label для поля — это игнорируется полностью, используется только то, что описано в этом списке.
// Любое поле в запросе, которого здесь нет, — молча игнорируется целиком: не проверяется и не попадает в сообщение, даже если у него есть value и свой label.
// Так бот не может ни подделать подпись существующего поля, ни придумать своё.
// Важно: если меняете data-js-minlength/maxlength или добавляете/убираете поле в HTML — обязательно продублируйте это здесь. Раз сервер больше не доверяет границам длины из запроса, несовпадение с HTML не вызовет ошибку, а просто тихо будет проверяться по старым цифрам.
$KNOWN_FIELDS = [
    // технические
    'name_form'          => ['label' => 'Тип заявки',             'rule' => '',        'required' => true],
    'utm_source'          => ['label' => 'UTM-источник',           'rule' => '',        'required' => false],
    'utm_medium'          => ['label' => 'UTM-канал',              'rule' => '',        'required' => false],
    'utm_campaign'        => ['label' => 'UTM-кампания',           'rule' => '',        'required' => false],
    'utm_content'         => ['label' => 'UTM-содержание',         'rule' => '',        'required' => false],
    'utm_term'            => ['label' => 'UTM-ключевое слово',     'rule' => '',        'required' => false],
    // общие для всех форм
    'client_name'         => ['label' => 'Имя',                    'rule' => 'text',    'required' => true,  'min' => 2, 'max' => 20],
    'client_surname'         => ['label' => 'Фамилия',                    'rule' => 'text',    'required' => true,  'min' => 2, 'max' => 20],
    'client_city'         => ['label' => 'Город',                    'rule' => 'text',    'required' => true,  'min' => 2, 'max' => 20],
    'client_driving'         => ['label' => 'Название автошколы',                    'rule' => 'text',    'required' => false,  'min' => 4, 'max' => 20],
    'client_phone'        => ['label' => 'Телефон',                'rule' => 'phone',   'required' => true],
    'client_email'        => ['label' => 'Email',                  'rule' => 'email',   'required' => true],
    'contact_way'         => ['label' => 'Как удобнее ответить',   'rule' => '',        'required' => true], 
    'client_message_title'      => ['label' => 'Тема обращения',                 'rule' => 'text', 'required' => true, 'min' => 5, 'max' => 200],   
    'client_message'      => ['label' => 'Текст обращения',                 'rule' => 'message', 'required' => true, 'max' => 500],
    'privacy_agree'       => ['label' => '',                       'rule' => '',        'required' => true], // техническое: валидируется, в сообщение НЕ идёт (пустой label)
    // форма "Оставить заявку"   
];

$errors = [];
$clean  = [];   // name => очищенное значение (телефон приведён к +7XXXXXXXXXX)
$labels = [];   // name => подпись — только для полей с непустым label в реестре

foreach ($fields as $f) {
    $name = isset($f['name']) ? (string)$f['name'] : '';
    if ($name === '' || !isset($KNOWN_FIELDS[$name])) continue; // неизвестное серверу поле — молча игнорируем

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

function validate_field($value, $rule, $bounds)
{
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

function normalize_value($value, $rule)
{
    if ($rule === 'phone') {
        $digits = preg_replace('/\D/', '', $value);
        if (strlen($digits) === 11 && $digits[0] === '8') {
            $digits = '7' . substr($digits, 1);
        }
        return '+' . $digits;
    }
    return $value;
}

// ---------- 8. Rate-limit по контакту (телефон/email) ----------
// Отдельно от лимита по IP: ловит повторные заявки с одного и того же номера/почты
// даже если бот шлёт их с разных IP (например, через прокси-пул).
foreach (['client_phone', 'client_email'] as $contactField) {
    if (isset($clean[$contactField]) && $clean[$contactField] !== '') {
        if (!check_rate_limit('contact:' . $clean[$contactField], RATE_LIMIT_MAX_PER_CONTACT, RATE_LIMIT_WINDOW)) {
            respond(false, 'Заявка с этими контактными данными уже отправлена недавно.');
        }
    }
}

// ---------- 9. Собираем текст сообщения из подписанных полей ----------
$lines = [];
foreach ($labels as $name => $label) {
    if (isset($clean[$name]) && $clean[$name] !== '') {
        $lines[] = $label . ': ' . $clean[$name];
    }
}
$messageText = $lines ? implode("\n", $lines) : 'Новая заявка с сайта';

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
        $ok = false; // один упавший канал не должен ронять весь скрипт
    }
    if ($ok) {
        $sentVia[] = $channel;
    }
}

if (empty($sentVia)) {
    respond(false, 'Не удалось отправить заявку. Позвоните нам, пожалуйста, напрямую.');
}

respond(true, 'Заявка отправлена!', ['sent_via' => $sentVia]);


// ============================================================
//                      К А Н А Л Ы
// ============================================================

/** Email через SMTP (PHPMailer). composer require phpmailer/phpmailer */
function send_via_email($text)
{
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
    $mail->Subject = 'Новая заявка с сайта';
    $mail->Body    = $text;

    return $mail->send();
}

/** MAX — см. https://dev.max.ru/docs-api
 *  В разных источниках документация показывает chat_id то в теле JSON, то
 *  как query-параметр URL — на момент написания единой формулировки в
 *  открытых источниках не нашлось. Передаём обоими способами сразу —
 *  лишний параметр API просто проигнорирует, зато не промахнёмся с форматом. */
function send_via_max($text)
{
    $url = MAX_API_BASE . '/messages?chat_id=' . urlencode(MAX_CHAT_ID);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'Authorization: ' . MAX_BOT_TOKEN,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode(
            ['chat_id' => MAX_CHAT_ID, 'text' => $text],
            JSON_UNESCAPED_UNICODE
        ),
        CURLOPT_TIMEOUT => 8,
    ]);
    curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code >= 200 && $code < 300;
}

/** Telegram — https://core.telegram.org/bots/api#sendmessage */
function send_via_telegram($text)
{
    $ch = curl_init('https://api.telegram.org/bot' . TG_BOT_TOKEN . '/sendMessage');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POSTFIELDS     => http_build_query([
            'chat_id' => TG_CHAT_ID,
            'text'    => $text,
        ]),
        CURLOPT_TIMEOUT => 8,
    ]);
    curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code >= 200 && $code < 300;
}
