<?php
/**
 * SmartForm Backend v1.0
 * Обработка, Антиспам и Рассылка
 */

header('Content-Type: application/json');

// --- НАСТРОЙКИ ---
$tg_token = "6236659804:AAEuwjUmHeBxPMyjxDGKXyjq3brEITVytBU"; 
$tg_chat_id = "-1001986825172";   
$email_to = "tokareva78@internet.ru";
$google_script_url = "https://script.google.com/macros/s/AKfycbzH1MXI9iLEyCg9-veXC2n9cVbkJsAMhN8Zf81djcm5ixu9X9z2GA4IdCVGaZ_wMQVPkA/exec"; 

// --- НАСТРОЙКИ MAX ---
$max_token = "f9LHodD0cOIba-gNZpKFXQD-q2wgAGZVyH6APSrXoiNlCWyjkgFrBuvGBj6HUmBW7dDVr4wpBzpUYK9efPbL"; 
$max_chat_id = "-72446505899474"; // Вставьте сюда полученный chat_id

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!empty($_POST['user_email_confirmation'])) die(json_encode(['status'=>'error','message'=>'Bot']));

    $titles_map = isset($_POST['_titles_map']) ? json_decode($_POST['_titles_map'], true) : [];
    $google_payload = [];
    $email_rows = [];

    foreach ($_POST as $key => $value) {
        if (strpos($key, '_') === 0 || $key === 'user_email_confirmation') continue;

        $clean_key = str_replace('[]', '', $key);
        $pretty_key = null;

        if (isset($titles_map[$key])) {
            $pretty_key = $titles_map[$key];
        } elseif (isset($titles_map[$clean_key])) {
            $pretty_key = $titles_map[$clean_key];
        }

        if (!$pretty_key) continue;

        $val = is_array($value) ? implode(", ", $value) : trim($value);

        if (stripos($pretty_key, 'телефон') !== false || stripos($key, 'phone') !== false) {
            $digits = preg_replace('/\D/', '', $val);
            $val_google = "8" . substr($digits, -10);
            $val_notify = "+7" . substr($digits, -10);
            
            $google_payload[$pretty_key] = $val_google;
            $email_rows[$pretty_key] = "<b>$pretty_key:</b> $val_notify";
        } else {
            $final_val = htmlspecialchars($val);
            $google_payload[$pretty_key] = $final_val;
            $email_rows[$pretty_key] = "<b>$pretty_key:</b> " . $final_val;
        }
    }

    if (empty($google_payload)) die(json_encode(['status'=>'success', 'info'=>'No data']));

    $message = "<b>Новая заявка с сайта</b>\n\n" . implode("\n", $email_rows);

    // Отправка ТГ
    @file_get_contents("https://api.telegram.org/bot$tg_token/sendMessage?chat_id=$tg_chat_id&parse_mode=HTML&text=".urlencode($message));

    // Отправка Google
    if ($google_script_url) {
        $opts = ['http'=>['method'=>'POST','header'=>'Content-type: application/json','content'=>json_encode($google_payload)]];
        @file_get_contents($google_script_url, false, stream_context_create($opts));
    }

    // Отправка MAX
    if (!empty($max_token) && !empty($max_chat_id)) {
        // Формируем URL. Для чата используем chat_id, если отправляем в личку — user_id
        $max_url = "https://platform-api.max.ru/messages?chat_id=" . $max_chat_id; 
        
        $max_payload = json_encode([
            'text' => $message,
            'format' => 'html' // Указываем формат HTML для корректного отображения тегов <b>
        ]);

        $max_opts = [
            'http' => [
                'method'  => 'POST',
                'header'  => "Authorization: $max_token\r\nContent-Type: application/json\r\n",
                'content' => $max_payload,
                'ignore_errors' => true
            ]
        ];
        @file_get_contents($max_url, false, stream_context_create($max_opts));
    }

    // Почта
    $headers = "MIME-Version: 1.0\r\nContent-type:text/html;charset=UTF-8\r\nFrom: no-reply@".$_SERVER['HTTP_HOST'];
    mail($email_to, "Заявка", nl2br($message), $headers);

    echo json_encode(['status' => 'success']);
}
?>