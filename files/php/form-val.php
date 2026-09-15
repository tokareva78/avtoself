<?php
// Ограничиваем доступ только для POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Method Not Allowed');
}

// Конфигурация
$tg_bot_token = 'YOUR_BOT_TOKEN'; // Заменить на токен
$tg_chat_id = 'YOUR_CHAT_ID';     // Заменить на chat_id
$email_to = 'admin@yoursite.ru';  // E-mail получателя
$email_from = 'no-reply@yoursite.ru'; // От кого (должен совпадать с доменом сайта)

// Читаем JSON
$raw_data = file_get_contents('php://input');
$data = json_decode($raw_data, true);

if (!$data || !isset($data['fields'])) {
    http_response_code(400);
    exit('Bad Request');
}

// Дополнительные данные сервера
$client_ip = $_SERVER['REMOTE_ADDR'];
$time_now = date('Y-m-d H:i:s');

// Формируем списки для писем и TG
$text_tg = "🔥 <b>Новая заявка с сайта!</b>\n\n";
$html_mail = "<h2>Новая заявка</h2><table border='1' cellpadding='8' cellspacing='0' style='border-collapse: collapse;'>";

foreach ($data['fields'] as $field) {
    $label = htmlspecialchars($field['label']);
    $value = $field['value'];
    
    // Пропускаем пустые необязательные поля
    if (empty($value)) continue;

    // Очистка номера телефона, если поле называется phone
    if ($field['name'] === 'phone') {
        $value = preg_replace('/[^0-9+]/', '', $value); // Оставит только +79999999999
    } else {
        $value = htmlspecialchars($value);
    }

    $text_tg .= "<b>{$label}:</b> {$value}\n";
    $html_mail .= "<tr><td style='background:#f9fafb; font-weight:bold;'>{$label}</td><td>{$value}</td></tr>";
}

// Добавляем технические данные в конец
$tech_info = "\n⚙️ <b>Тех. данные:</b>\n<b>IP:</b> {$client_ip}\n<b>Время (сервер):</b> {$time_now}";
$text_tg .= $tech_info;
$html_mail .= "<tr><td style='background:#f9fafb; font-weight:bold;'>IP клиента</td><td>{$client_ip}</td></tr>";
$html_mail .= "<tr><td style='background:#f9fafb; font-weight:bold;'>Время (сервер)</td><td>{$time_now}</td></tr></table>";

// === 1. Отправка в Telegram ===
if (!empty($tg_bot_token) && !empty($tg_chat_id) && $tg_bot_token !== 'YOUR_BOT_TOKEN') {
    $tg_url = "https://api.telegram.org/bot{$tg_bot_token}/sendMessage";
    $tg_post = [
        'chat_id' => $tg_chat_id,
        'text' => $text_tg,
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => true
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $tg_url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($tg_post));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_exec($ch);
    curl_close($ch);
}

// === 2. Отправка на Email ===
$subject = 'Новая заявка с сайта';
$headers = "From: {$email_from}\r\n";
$headers .= "Reply-To: {$email_from}\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/html; charset=UTF-8\r\n";

@mail($email_to, $subject, $html_mail, $headers);

http_response_code(200);
echo json_encode(['status' => 'ok']);