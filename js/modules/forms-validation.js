(function() {
  "use strict";
  window.FormsValidation = {
    init() {
      new FormsValidation();
    },
  };

  class FormsValidation {
    selectors = {
      form: "[data-js-form]",
      fieldErrors: "[data-js-form-field-errors]",
      submitButton: 'button[type="submit"]',
      phone: 'input[name="phone"]',
      startInput: "[data-js-start]",
    };

    errorMessages = {
      valueMissing: () => "Пожалуйста, заполните это поле",
      patternMismatch: ({ title }) => title || "Данные не соответствуют формату",
      tooShort: ({ minLength }) => `Слишком короткое значение, минимум символов — ${minLength}`,
      tooLong: ({ maxLength }) => `Слишком длинное значение, ограничение символов — ${maxLength}`,
      typeMismatch: ({ type }) => {
        if (type === "url") return "Введите корректный URL";
        if (type === "email") return "Введите почту в формате email@mail.ru";
        return "Неверный формат данных";
      },
      rangeUnderflow: ({ min }) => `Значение должно быть не меньше ${min}`,
      rangeOverflow: ({ max }) => `Значение должно быть не больше ${max}`,
      stepMismatch: () => "Значение не соответствует допустимому шагу",
    };

    constructor() {
      // 1. ПЕРВЫМ ДЕЛОМ СОБИРАЕМ И ВСТАВЛЯЕМ UTM-МЕТКИ
      this.captureUTM();

      // 2. Инициализация маски для телефона
      document.querySelectorAll('input[name="phone"]').forEach((input) => {
        const mask = IMask(input, {
          mask: "+{7} (000) 000-00-00",
          lazy: true,
          placeholderChar: "_",
          // определяем X как обязательную цифру 9
          // definitions: {
          //   X: {
          //     mask: /9/,
          //   },
          // },
          prepare: (appended, masked) => {
            // если пользователь первым вводит 7 или 8 — пропускаем их
            if ((appended === "7" || appended === "8") && masked.value === "") {
              return "";
            }
            return appended;
          },
        });

        // активируем маску при фокусе
        input.addEventListener("focus", () => {
          mask.updateOptions({ lazy: false });
        });

        // возвращаем placeholder и убираем маску, если пользователь ничего не ввел
        input.addEventListener("blur", () => {
          if (!mask.unmaskedValue) {
            mask.updateOptions({ lazy: true });
            input.value = "";
          }
        });
      });

      // 3. Установка времени для тайм-трэпа (защита от спама)
      document.querySelectorAll("input[data-js-start]").forEach((input) => {
        input.value = Math.floor(Date.now() / 1000);
      });
      // 4. Подписка на события
      this.bindEvents();
    }

    // НОВЫЙ МЕТОД: Сбор и распределение UTM-меток
    captureUTM() {
      const utmTags = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
      const urlParams = new URLSearchParams(window.location.search);

      // Шаг 1: Ищем метки в URL и сохраняем в sessionStorage
      utmTags.forEach((tag) => {
        if (urlParams.has(tag)) {
          sessionStorage.setItem(tag, urlParams.get(tag));
        }
      });

      // Шаг 2: Достаем метки из sessionStorage и вставляем во ВСЕ формы на странице
      utmTags.forEach((tag) => {
        const savedValue = sessionStorage.getItem(tag);
        if (savedValue) {
          const inputs = document.querySelectorAll(`input[name="${tag}"]`);
          inputs.forEach((input) => {
            input.value = savedValue;
          });
        }
      });
    }

    // Валидация полей
    validateField(fieldControlElement) {
      const errors = fieldControlElement.validity;
      const errorMessages = [];

      // Быстрые флаги
      const rawValue = String(fieldControlElement.value || "");
      const trimmed = rawValue.trim();
      const isEmpty = trimmed === "";
      const isRequired = fieldControlElement.required;

      // стандартные HTML5 ошибки
      Object.entries(this.errorMessages).forEach(([errorType, getErrorMessage]) => {
        if (errors[errorType]) {
          errorMessages.push(getErrorMessage(fieldControlElement));
        }
      });

      // === КАСТОМ: ИМЯ (как в send.php) ===
      if (fieldControlElement.name === "name") {
        // Для имени обычно required — проверяем всегда
        const namePattern = /^[А-ЯЁа-яё\s-]{2,26}$/u;
        if (!namePattern.test(trimmed)) {
          errorMessages.push(fieldControlElement.getAttribute("data-err-name-pattern") || "Имя: только кириллица, пробел и дефис, 2–26 символов");
        }
        const tripleRepeat = /(.)\1\1+/u;
        if (tripleRepeat.test(trimmed)) {
          errorMessages.push(fieldControlElement.getAttribute("data-err-name-repeat") || "Имя: не может содержать более двух одинаковых символов подряд");
        }
      }

      // if (fieldControlElement.name === "email") {
      //   if (!(!isRequired && isEmpty)) {
      //     const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

      //     if (!emailRegex.test(trimmed)) {
      //       errorMessages.push(fieldControlElement.getAttribute("data-err-email-pattern") || "Email: введите адрес вида name@mail.ru");
      //     }
      //   }
      // }

      if (fieldControlElement.name === "email") {
        // Простая и понятная логика: валидируем, если поле обязательно ИЛИ в нём есть значение
        if (isRequired || !isEmpty) {
          const email = trimmed; // trimmed уже должен быть .trim()-ом от значения поля

          // Регулярка: достаточно строгая, но покрывает 99% реальных кейсов
          const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

          if (!emailRegex.test(email)) {
            const customMsg = fieldControlElement.getAttribute("data-err-email-pattern");
            errorMessages.push(customMsg || "Email: введите адрес вида name@mail.ru");
          }
        }
      }

      // === КАСТОМ: ТЕЛЕФОН ===
      // if (fieldControlElement.name === "phone") {
      //   // Если поле НЕ обязательно и пустое — не валидируем (считаем ок)
      //   if (!(!isRequired && isEmpty)) {
      //     const purePhone = rawValue.replace(/\D/g, "");
      //     if (!/^79\d{9}$/.test(purePhone)) {
      //       errorMessages.push(fieldControlElement.getAttribute("data-err-phone") || "Номер телефона должен быть в формате +7 (9XX) XXX-XX-XX");
      //     }
      //   }
      // }
      if (fieldControlElement.name === "phone") {
        // Валидируем, если поле обязательное ИЛИ в нём что-то введено
        if (isRequired || !isEmpty) {
          const purePhone = rawValue.replace(/\D/g, ""); // оставляем только цифры

          // ^7\d{10}$ — начинается с 7, потом ровно 10 цифр (всего 11)
          if (!/^7\d{10}$/.test(purePhone)) {
            errorMessages.push(fieldControlElement.getAttribute("data-err-phone") || "Номер телефона должен содержать 11 цифр и начинаться с 7");
          }
        }
      }

      // === КОНЕЦ кастомных проверок ===

      // Выведем ошибки и aria
      this.manageErrors(fieldControlElement, errorMessages);
      const isValid = errorMessages.length === 0;
      fieldControlElement.ariaInvalid = !isValid;

      return isValid;
    }

    manageErrors(fieldControlElement, errorMessages) {
      // приоритет — контейнер, указанный через aria-errormessage
      const errId = fieldControlElement.getAttribute("aria-errormessage");
      let fieldErrorsElement = errId ? document.getElementById(errId) : null;

      // если атрибут не задан или элемент не найден — оставляем резервные варианты
      if (!fieldErrorsElement) {
        fieldErrorsElement =
          fieldControlElement.parentElement.querySelector(this.selectors.fieldErrors) ||
          (fieldControlElement.closest("fieldset") && fieldControlElement.closest("fieldset").querySelector(this.selectors.fieldErrors));
      }

      // если даже резервов нет — тихо выходим
      if (!fieldErrorsElement) return;

      // рисуем/очищаем ошибки
      fieldErrorsElement.innerHTML = "";
      if (errorMessages.length > 0) {
        const errorSpan = document.createElement("span");
        errorSpan.className = "field__error-item";
        errorSpan.textContent = errorMessages[0]; // показываем первую ошибку
        fieldErrorsElement.appendChild(errorSpan);

        fieldControlElement.classList.add("field__control--error");
        fieldControlElement.classList.remove("field__control--valid");
      } else {
        fieldControlElement.classList.remove("field__control--error");
        fieldControlElement.classList.add("field__control--valid");
      }
    }

    // Помечаем поле как "touched" при первом блюре
    onBlur(event) {
      const { target } = event;
      const isFormField = target.closest(this.selectors.form);
      if (!isFormField) return;

      target.dataset.touched = "true";
      const hasValue = (target.value || "").trim() !== "";
      const mustCheckByName = ["phone", "name"].includes(target.name);

      if (target.required || mustCheckByName || hasValue) {
        this.validateField(target);
      }
    }

    // Валидируем на вводе, но только если поле уже трогали
    onInput(event) {
      const { target } = event;
      const isFormField = target.closest(this.selectors.form);
      if (!isFormField) return;

      if (target.dataset.touched === "true") {
        this.validateField(target);
      }
    }

    onChange(event) {
      const { target } = event;
      const isRequired = target.required;
      const isToggleType = ["radio", "checkbox"].includes(target.type);
      const isSelect = target.tagName === "SELECT";
      const isPhone = target.name === "phone";

      if (isRequired || isToggleType || isSelect || isPhone) {
        target.dataset.touched = "true";
        this.validateField(target);
      }
    }

    // Главный метод сбора и обработки данных
    collectFormData(form) {
      const formData = {};
      const elements = [...form.elements].filter((el) => el.hasAttribute("data-form-send"));
      elements.forEach((element) => {
        const label = element.getAttribute("data-form-send");
        const name = element.name;

        // Обработка разных типов полей
        if (element.type === "checkbox") {
          if (element.checked) {
            formData[name] = { label, value: element.value || "Да" };
          }
        } else if (element.type === "radio") {
          if (element.checked) {
            formData[name] = { label, value: element.value };
          }
        } else if (element.tagName === "SELECT") {
          // режим: value | text | both (по умолчанию value)/ Для  селекта с data-send="value". Если вдруг где-то понадобится текст — ставить data-send="text".
          const mode = element.getAttribute("data-send") || "value";
          const selected = element.selectedOptions ? Array.from(element.selectedOptions) : [];

          const pack = (o) => {
            if (mode === "text") return o.textContent.trim();
            if (mode === "both") return { value: o.value, text: o.textContent.trim() };
            return o.value; // default: value
          };

          const val = element.multiple ? selected.map(pack) : selected[0] ? pack(selected[0]) : mode === "both" ? { value: "", text: "" } : "";

          formData[name] = { label, value: val };
        }

        // После IMask у input всегда будет строка длиной 18 символов вида "+7 (9XX) XXX-XX-XX"
        else if (name === "phone") {
          let purePhone = element.value.replace(/[^\d]/g, "");
          if (!/^79\d{9}$/.test(purePhone)) {
            const errorField = element.parentElement.querySelector("[data-js-form-field-errors]");
            if (errorField) {
              errorField.innerHTML = `<span class="field__error-item">Телефон должен быть в формате +7 (9XX) XXX-XX-XX</span>`;
            }
            element.classList.add("field__control--error");
            throw new Error("Неверный телефон"); // НЕ вызывать глобальный showError
          }
          formData[name] = { label, value: "+7" + purePhone.substring(1) };
        } else {
          formData[name] = { label, value: element.value };
        }
      });

      // Добавляем form_start из [data-js-start]
      const startEl = form.querySelector("[data-js-start]");
      if (startEl) {
        const ts = parseInt(startEl.value, 10) || Math.floor(Date.now() / 1000);
        formData["form_start"] = { label: "form_start", value: ts };
      }

      return formData;
    }

    // Отправка данных
    async sendForm(form, formData) {
      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = "Отправка...";

      try {
        if (formData.phone && formData.phone.value) {
          let phone = formData.phone.value.replace(/[^\d]/g, "");
          if (phone.length === 11 && phone[0] === "8") phone = "7" + phone.slice(1);
          if (phone.length === 10) phone = "7" + phone;
          if (!/^7\d{10}$/.test(phone)) {
            this.showError(form, "Введите корректный номер телефона");
            submitButton.disabled = false;
            submitButton.textContent = "Отправить";
            return;
          }
          formData.phone.value = phone;
        }

        // 2) Допроверка email — только если он есть и не пустой
        if (formData.email && formData.email.value) {
          const email = String(formData.email.value).trim();
          // const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // мягкая проверка
          const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

          if (!emailRegex.test(email)) {
            this.showError(form, "Введите корректный email");
            submitButton.disabled = false;
            submitButton.textContent = "Отправить";
            return;
          }

          formData.email.value = email;
        }

        const endpointUrl = "/files/send.php";

        const response = await fetch(endpointUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        // Может прийти невалидный JSON, ловим парсинг отдельно:
        let result = {};
        try {
          result = await response.json();
        } catch {
          result = {};
        }

        if (response.ok && (result.success || result.ok)) {
          this.showSuccess(form, formData);
        } else {
          this.showError(form, (result && result.message) || "Ошибка отправки");
          submitButton.disabled = false;
          submitButton.textContent = "Отправить";
        }
      } catch (error) {
        this.showError(form, "Ошибка соединения с сервером");
        submitButton.disabled = false;
        submitButton.textContent = "Отправить";
      }
    }

    // Уведомление об успехе + redirect с именем
    showSuccess(form, formData) {
      const userName = formData.name?.value || "Гость";
      const message = document.createElement("div");
      message.className = "form-message form-message--success";
      message.textContent = `✓ ${userName}, форма успешно отправлена! Перенаправление...`;
      form.prepend(message);
      setTimeout(() => {
        window.location.href = `/spasibo`;
      }, 2000);
    }

    // Уведомление об ошибке
    showError(form, errorText) {
      const message = document.createElement("div");
      message.className = "form-message form-message--error";
      message.textContent = `✗ ${errorText}`;
      form.prepend(message);
      setTimeout(() => {
        message.remove();
      }, 5000);
    }

    // Обработка submit для валидации и отправки
    onSubmit(event) {
      const isFormElement = event.target.matches(this.selectors.form);
      if (!isFormElement) return;

      event.preventDefault();

      const form = event.target;
      const controls = [...form.elements].filter((el) => el.matches("input,select,textarea"));

      let isFormValid = true;
      let firstInvalidFieldControl = null;

      controls.forEach((el) => {
        const hasValue = (el.value || "").trim() !== "";
        const mustCheckByName = ["phone", "name"].includes(el.name);
        const shouldValidate = el.required || mustCheckByName || hasValue;

        if (shouldValidate) {
          const ok = this.validateField(el);
          if (!ok) {
            isFormValid = false;
            if (!firstInvalidFieldControl) firstInvalidFieldControl = el;
          }
        }
      });

      if (!isFormValid) {
        firstInvalidFieldControl?.focus();
        return;
      }

      const formData = this.collectFormData(form);
      this.sendForm(form, formData);
    }

    // Подпишемся на input-событие
    bindEvents() {
      document.addEventListener("blur", (event) => this.onBlur(event), { capture: true });
      document.addEventListener("input", (event) => this.onInput(event));
      document.addEventListener("change", (event) => this.onChange(event));
      document.addEventListener("submit", (event) => this.onSubmit(event));
    }
  }
})();
