/**
 * FormsValidation — валидация полей + антиспам + отправка на send-form.php.
 * Та же логика, что в проекте "Форвард Плюс", адаптированная под уже
 * существующие в этом проекте атрибуты (не переизобретаем то, что у вас
 * уже хорошо сделано):
 *
 *   required, minlength, maxlength   — нативные HTML5-атрибуты (не data-js-*)
 *   data-form-send="Подпись"         — подпись поля для итогового сообщения
 *   data-js-validate="phone|email|text|honeypot"  — тип проверки (добавляем
 *                                       по вашему решению — раньше маркера не было)
 *   class="honeypot"                 — ловушка для ботов (плюс data-js-validate
 *                                       для единообразия с остальными правилами)
 *   [aria-errormessage] + <span data-js-form-field-errors>
 *                                     — куда выводить текст ошибки; используем
 *                                       и нативный input.setCustomValidity(),
 *                                       чтобы заодно заработала уже готовая
 *                                       у вас CSS-подсветка :invalid
 *   data-js-form                     — форма подключена к этому движку
 *
 * Антиспам-таймер стартует не с фокуса на конкретном поле (это ненадёжно —
 * человек может начать заполнять с любого поля), а с открытия модалки
 * (событие "modal:open" от ModalModule) или сразу при инициализации — для
 * формы, которая не в модалке, а прямо в разметке страницы.
 */
window.FormsValidation = (function() {
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

  /* ===== UTM: считать один раз из URL, подставлять перед каждой отправкой ===== */
  (function captureUTM() {
    var params = new URLSearchParams(window.location.search);
    UTM_KEYS.forEach(function(k) {
      var v = params.get(k);
      if (v) {
        try {
          sessionStorage.setItem("utm_" + k, v);
        } catch (e) {}
      }
    });
  })();
  function fillUTMFields(form) {
    UTM_KEYS.forEach(function(k) {
      var input = form.querySelector('[name="' + k + '"]');
      if (!input) return;
      var v = null;
      try {
        v = sessionStorage.getItem("utm_" + k);
      } catch (e) {}
      input.value = v || "";
    });
  }

  /* ===== Валидация одного поля — те же правила, что должны быть и в send-form.php ===== */
  function validateField(input) {
    if (input.classList.contains("honeypot")) return null; // честпот не показываем, не проверяем на виду

    if (input.type === "checkbox") {
      if (input.hasAttribute("required") && !input.checked) return "Отметьте это поле";
      return null;
    }

    var rule = input.dataset.jsValidate || "";
    var required = input.hasAttribute("required");
    var value = input.value.trim();

    if (required && value === "") return "Поле обязательно для заполнения";
    if (!rule || value === "") return null;

    if (rule === "email") {
      if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) return "Введите корректный email";
    } else if (rule === "phone") {
      var digits = value.replace(/\D/g, "");
      if (digits.length !== 11) return "Введите телефон полностью";
    } else if (rule === "text") {
      var min = parseInt(input.getAttribute("minlength") || "1", 10);
      var max = parseInt(input.getAttribute("maxlength") || "200", 10);
      if (value.length < min || value.length > max) return "От " + min + " до " + max + " символов";
      if (!/^[а-яА-ЯёЁ\s\-]+$/.test(value)) return "Разрешены только русские буквы, пробел и дефис";
    } else if (rule === "message") {
      var maxLen = parseInt(input.getAttribute("maxlength") || "500", 10);
      if (value.length > maxLen) return "Не более " + maxLen + " символов";
      if (/(https?:\/\/|www\.|[a-zA-Zа-яА-ЯёЁ0-9-]+\.(ru|com|рф|net|org|io|me))/i.test(value)) return "Ссылки в этом поле не разрешены";
      if (!/^[а-яА-ЯёЁ0-9\s.,!?()\-:;\n]+$/.test(value)) return "Разрешены только русские буквы и знаки препинания";
    }
    return null;
  }

  /* ===== Вывод ошибки — используем уже готовую вашу связку aria-errormessage + span ===== */
  function showFieldError(input, message) {
    input.setCustomValidity(message || ""); // включает вашу существующую CSS-подсветку :invalid
    input.setAttribute("aria-invalid", message ? "true" : "false");
    var id = input.getAttribute("aria-errormessage");
    var errEl = id ? document.getElementById(id) : null;
    if (!errEl) return;
    errEl.innerHTML = message ? '<span class="field__error-item">' + message + "</span>" : "";
  }

  function bindLiveValidation(form) {
    form.querySelectorAll("[required], [data-js-validate]").forEach(function(input) {
      if (input.classList.contains("honeypot")) return;
      var handler = function() {
        showFieldError(input, validateField(input));
      };
      input.addEventListener("blur", handler);
      input.addEventListener("input", function() {
        if (input.validationMessage) handler(); // перепроверяем на лету, только если ошибка уже показана
      });
      input.addEventListener("change", handler);
    });
  }

  /* ===== Антиспам-таймер ===== */
  function startFormTimer(form) {
    if (!form.dataset.fillStart) form.dataset.fillStart = String(Date.now());
  }
  document.addEventListener("modal:open", function(e) {
    var modal = e.detail && e.detail.modal;
    if (!modal) return;
    var form = modal.querySelector("[data-js-form]");
    if (form) startFormTimer(form);
  });

  /* ===== Сборка данных для отправки ===== */
  function collectPayload(form) {
    var honeypotInput = form.querySelector(".honeypot");
    var startedAt = parseInt(form.dataset.fillStart || "0", 10);
    var timer = startedAt ? (Date.now() - startedAt) / 1000 : 0;

    var fields = [];
    var seenRadioGroups = {};

    form.querySelectorAll("[name]").forEach(function(input) {
      if (input.classList.contains("honeypot")) return;
      var name = input.name;
      var value;

      if (input.type === "checkbox") {
        value = input.checked ? input.value || "да" : "";
      } else if (input.type === "radio") {
        if (seenRadioGroups[name]) return;
        seenRadioGroups[name] = true;
        var checked = form.querySelector('input[name="' + name + '"]:checked');
        value = checked ? checked.value : "";
      } else {
        value = input.value;
      }

      fields.push({
        name: name,
        value: value,
        label: input.dataset.formSend || "",
        required: input.hasAttribute("required"),
        rule: input.dataset.jsValidate || "",
        minlength: input.getAttribute("minlength") || "",
        maxlength: input.getAttribute("maxlength") || "",
      });
    });

    return { honeypot: honeypotInput ? honeypotInput.value : "", timer: timer, fields: fields };
  }

  /* ===== Маска телефона (IMask) — по тому же атрибуту, что уже отвечает
     за правило валидации, без дополнительного класса в разметке ===== */
  function initPhoneMask() {
    document.querySelectorAll('[data-js-validate="phone"]').forEach(function(input) {
      if (window.IMask) {
        IMask(input, { mask: "+{7} (000) 000-00-00" });
      }
    });
  }

  /* ===== Кастомный select -> скрытый input с data-form-send ===== */
  function initCustomSelects() {
    document.querySelectorAll(".js-select").forEach(function(sel) {
      var trigger = sel.querySelector(".js-select-trigger");
      var valueEl = sel.querySelector(".js-select-value");
      var hiddenInput = sel.parentElement.querySelector("input[hidden]");
      var options = sel.querySelectorAll(".js-select-options li");
      if (!trigger) return;

      trigger.addEventListener("click", function(e) {
        e.stopPropagation();
        document.querySelectorAll(".js-select.open").forEach(function(o) {
          if (o !== sel) o.classList.remove("open");
        });
        sel.classList.toggle("open");
      });
      options.forEach(function(opt) {
        if (opt.hasAttribute("data-disabled")) return;
        opt.addEventListener("click", function() {
          options.forEach(function(o) {
            o.classList.remove("active");
          });
          opt.classList.add("active");
          if (valueEl) valueEl.textContent = opt.textContent.trim();
          if (hiddenInput) {
            hiddenInput.value = opt.dataset.value;
            hiddenInput.dispatchEvent(new Event("change"));
          }
          sel.classList.remove("open");
        });
      });
    });
    document.addEventListener("click", function(e) {
      if (!e.target.closest(".js-select")) {
        document.querySelectorAll(".js-select.open").forEach(function(s) {
          s.classList.remove("open");
        });
      }
    });
  }

  /* ===== Счётчик символов для textarea с ограничением (maxlength) ===== */
  function bindCharCounter(form) {
    form.querySelectorAll('textarea[data-js-validate="message"]').forEach(function(ta) {
      var field = ta.closest(".field");
      var counter = field ? field.querySelector(".char-counter") : null;
      if (!counter) return;
      function update() {
        var max = parseInt(ta.getAttribute("maxlength") || "500", 10);
        var len = ta.value.length;
        counter.textContent = len + " / " + max;
        counter.classList.toggle("near-limit", len > max * 0.9);
      }
      ta.addEventListener("input", update);
      update();
    });
  }

  /* ===== Инициализация одной формы ===== */
  function initForm(form) {
    bindLiveValidation(form);
    bindCharCounter(form);
    if (!form.closest(".modal-overlay")) startFormTimer(form); // форма вне модалки — таймер сразу

    var submitBtn = form.querySelector('button[type="submit"]');
    var submitLabel = submitBtn ? submitBtn.textContent : "";

    form.addEventListener("submit", function(e) {
      e.preventDefault();
      if (form.dataset.submitting === "1") return; // защита от двойного клика

      fillUTMFields(form);

      var valid = true;
      var firstInvalid = null;
      form.querySelectorAll("[required], [data-js-validate]").forEach(function(input) {
        if (input.classList.contains("honeypot")) return;
        var err = validateField(input);
        showFieldError(input, err);
        if (err) {
          valid = false;
          if (!firstInvalid) firstInvalid = input;
        }
      });
      if (!valid) {
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      var payload = collectPayload(form);
      form.dataset.submitting = "1";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Отправляем…";
      }

      fetch("send-form.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function(res) {
          return res.json();
        })
        .then(function(res) {
          if (res.ok) {
            var modal = form.closest(".modal-overlay");
            form.reset();
            form.dataset.fillStart = "";
            if (modal && window.ModalModule) window.ModalModule.close(modal);
            alert(res.message || "Спасибо! Мы скоро свяжемся с вами.");
          } else if (res.errors) {
            Object.keys(res.errors).forEach(function(name) {
              var input = form.querySelector('[name="' + name + '"]');
              if (input) showFieldError(input, res.errors[name]);
            });
          } else {
            alert(res.message || "Не удалось отправить заявку. Попробуйте позвонить нам напрямую.");
          }
        })
        .catch(function() {
          alert("Не удалось отправить. Проверьте соединение или позвоните нам напрямую.");
        })
        .finally(function() {
          form.dataset.submitting = "";
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = submitLabel;
          }
        });
    });
  }

  function init() {
    initPhoneMask();
    initCustomSelects();
    document.querySelectorAll("[data-js-form]").forEach(initForm);
  }

  return { init: init };
})();
