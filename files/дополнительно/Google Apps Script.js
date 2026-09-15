function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var contents = JSON.parse(e.postData.contents);

    // 1. Получаем актуальные заголовки (всегда читаем первую строку)
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    // Очищаем заголовки от лишних пробелов для точного поиска
    var cleanHeaders = headers.map(function(h) {
      return h.toString().trim();
    });

    // 2. Подготавливаем массив для новой строки
    // Его длина должна быть равна количеству столбцов в таблице
    var newRow = new Array(cleanHeaders.length).fill("");

    // Устанавливаем дату в первый столбец (если он называется "Дата")
    if (cleanHeaders[0] === "Дата" || cleanHeaders[0] === "") {
      newRow[0] = new Date().toLocaleString("ru-RU");
    }

    // 3. Распределяем пришедшие данные по ячейкам
    for (var key in contents) {
      if (key.indexOf("_") === 0) continue; // Пропуск технических полей

      var targetKey = key.trim();
      var colIndex = cleanHeaders.indexOf(targetKey);

      if (colIndex > -1) {
        // Если нашли точное совпадение в шапке — кладем в этот индекс
        newRow[colIndex] = contents[key];
      } else {
        // Если такого заголовка нет — создаем новую колонку в конце
        sheet.getRange(1, cleanHeaders.length + 1).setValue(targetKey);
        cleanHeaders.push(targetKey);
        newRow.push(contents[key]);
      }
    }

    // 4. Записываем строку
    sheet.appendRow(newRow);

    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Google Apps Script Инструкция:

// Откройте Google Таблицу.

// В верхнем меню выберите: Расширения (Extensions) -> Apps Script.

// Нажмите синюю кнопку Начать развертывание (Deploy) -> Новое развертывание.

// Выберите тип: Веб-приложение (Web App).

// Описание: SmartForm.

// Запуск от имени: Вы (Me).

// Кто имеет доступ: Все (Anyone) — это важно, чтобы PHP мог достучаться.

// Нажмите "Развернуть", скопируйте полученный URL и вставьте его в $google_script_url в файле smart-send.php.
// https://script.google.com/macros/s/AKfycbzL5vzGI12JRfXZbGN4QwaEumjSm7gKq4AP3orR2lg9-uM0yZjZvjRXKtY8g091OrAR6A/exec
// Версия 1 от 22 мар. 2026 г., 00:07
// Идентификатор развертывания
// AKfycbzL5vzGI12JRfXZbGN4QwaEumjSm7gKq4AP3orR2lg9-uM0yZjZvjRXKtY8g091OrAR6A
