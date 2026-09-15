/**
 * SmartForm Core v1.0
 * Универсальный обработчик форм: валидация, маски, антиспам, маппинг.
 */
class SmartForm {
  constructor() {
    this.tokens = new Map(); // Храним токены для каждой формы
    this.init();
  }

  init() {
    // 1. Клик по кнопкам открытия модалок
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-modal-target]");
      if (btn) {
        e.preventDefault();
        this.handleModalOpen(btn);
      }

      if (e.target.closest("[data-modal-close]") || e.target.classList.contains("smart-modal__overlay")) {
        this.closeAllModals();
      }
    });

    // 2. Инициализация всех форм на странице (включая статические)
    document.querySelectorAll(".smart-form").forEach((form) => {
      this.setupForm(form);
    });

    // 3. Закрытие по Overlay или Esc
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeAllModals();
    });
  }

  setupForm(form) {
    // Вешаем маски
    this.applyMasks(form);

    // Антиспам: генерируем токен при первом взаимодействии
    form.addEventListener("focusin", () => this.generateToken(form), { once: true });

    // Живая валидация (очистка ошибок)
    form.querySelectorAll("input, select, textarea").forEach((input) => {
      input.addEventListener("input", () => this.clearError(input));
      input.addEventListener("blur", () => this.validateField(input));
    });

    // Отправка
    form.addEventListener("submit", (e) => this.handleSubmit(e));
  }

  applyMasks(form) {
    form.querySelectorAll('[data-mask="phone"]').forEach((el) => {
      const mask = IMask(el, {
        // Заменяем первый 0 на X
        mask: "+{7} (X00) 000-00-00",
        lazy: true,
        placeholderChar: "_",
        definitions: {
          // Указываем, что X принимает только цифру 9
          X: /[9]/,
        },
      });

      el.addEventListener("click", () => {
        // Если поле пустое (только маска), ставим курсор СРАЗУ на позицию ввода (4)
        // Теперь там уже будет ждать девятка или место под неё
        if (mask.value === "+7 (___) ___-__-__") {
          mask.cursorPos = 4;
        }
      });
    });

    // 2. Имя (Кириллица + Min/Max)
    form.querySelectorAll('[data-mask="name"]').forEach((el) => {
      // Ограничитель ввода (запрещаем печатать латиницу вообще)
      el.addEventListener("beforeinput", (e) => {
        if (e.data && /[a-zA-Z0-9]/.test(e.data)) {
          e.preventDefault(); // Просто не даем символу появиться
          this.showError(el, "Раскладка должна быть русской");
        }
      });

      // Запасной вариант для вставки (Paste) и проверки длины
      el.addEventListener("input", (e) => {
        const val = el.value;
        const min = el.minLength || 2;
        const max = el.maxLength || 30;

        // Если вставили текст с латиницей
        if (/[a-zA-Z0-9]/.test(val)) {
          el.value = val.replace(/[a-zA-Z0-9]/g, "");
          this.showError(el, "Латиница удалена. Пишите по-русски");
        }
        // Проверка МАКСИМАЛЬНОЙ длины (если вдруг maxlength не сработал)
        else if (val.length > max) {
          el.value = val.substring(0, max);
          this.showError(el, `Максимум ${max} символов`);
        }
        // Если все хорошо и длина больше min - убираем ошибку
        else if (val.length >= min) {
          this.clearError(el);
        }
      });
    });
  }

  validateField(field) {
    const parent = field.closest(".smart-form__group");
    if (!parent) return true;

    // 4) Валидация радио и чекбоксов
    if (field.type === "radio" || field.type === "checkbox") {
      const name = field.name;
      const group = field.form.querySelectorAll(`input[name="${name}"]`);
      const isChecked = Array.from(group).some((input) => input.checked);
      const isRequired = Array.from(group).some((input) => input.hasAttribute("required"));

      if (isRequired && !isChecked) {
        return this.showError(field, "Выберите хотя бы один вариант");
      } else {
        this.clearError(field);
        return true;
      }
    }

    const value = field.value.trim();
    const min = field.minLength > 0 ? field.minLength : 2;
    const max = field.maxLength > 0 ? field.maxLength : 30;

    if (field.hasAttribute("required") && !value) {
      return this.showError(field, "Это поле обязательно для заполнения");
    }

    if (field.dataset.mask === "name") {
      if (value.length > 0 && value.length < min) {
        return this.showError(field, `Минимум ${min} символа`);
      }
      if (value.length > max) {
        return this.showError(field, `Максимум ${max} символов`);
      }
    }

    if (field.dataset.mask === "phone") {
      const raw = field.value.replace(/\D/g, "");
      if (raw.length < 11) return this.showError(field, "Введите номер полностью");
    }

    this.clearError(field);
    return true;
  }

  async handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const btnSubmit = form.querySelector('button[type="submit"]');

    // Валидация
    let isValid = true;
    form.querySelectorAll("[required], [data-mask]").forEach((field) => {
      if (!this.validateField(field)) isValid = false;
    });
    if (!isValid) return;

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = "Отправка...";

    const formData = new FormData();
    const titlesMap = {};

    form.querySelectorAll("input, select, textarea").forEach((el) => {
      if (!el.name || el.name === "user_email_confirmation") return;
      if (!el.dataset.sendTitle) return; // Пропуск полей без заголовка (privacy_policy)

      // Чистое имя для карты заголовков (без [])
      const cleanName = el.name.replace("[]", "");
      if (!titlesMap[cleanName]) {
        titlesMap[cleanName] = el.dataset.sendTitle;
      }

      if (el.type === "checkbox" || el.type === "radio") {
        if (el.checked) {
          // Добавляем в FormData (PHP любит [] для массивов)
          const sendName = el.type === "checkbox" && !el.name.includes("[]") ? el.name + "[]" : el.name;
          formData.append(sendName, el.value);
        }
      } else {
        formData.append(el.name, el.value);
      }
    });

    formData.append("_titles_map", JSON.stringify(titlesMap));
    formData.append("user_email_confirmation", form.querySelector('[name="user_email_confirmation"]').value);
    formData.append("_time_start", this.tokens.get(form) || 0);
    formData.append("_time_submit", Date.now());

    try {
      const response = await fetch("smart-send-max.php", { method: "POST", body: formData });
      const result = await response.json();
      if (result.status === "success") {
        this.handleSuccess(form);
      } else {
        alert(result.message);
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = "Ошибка";
      }
    } catch (err) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = "Ошибка сети";
    }
  }

  handleModalOpen(btn) {
    const modal = document.querySelector(btn.dataset.modalTarget);
    if (!modal) return;
    const form = modal.querySelector("form");
    if (form) {
      form.reset();
      form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
      form.querySelectorAll(".error-msg").forEach((el) => el.remove());
      this.mapData(btn, modal);
    }
    modal.classList.add("is-open");
    this.toggleBodyLock(true);
  }

  mapData(btn, modal) {
    Array.from(btn.attributes).forEach((attr) => {
      if (attr.name.startsWith("data-m-")) {
        const key = attr.name.replace("data-m-", "");
        const target = modal.querySelector(`[data-f-${key}]`);
        if (target) target.textContent = attr.value;
      }
      if (attr.name.startsWith("data-input-name-")) {
        const name = attr.name.replace("data-input-name-", "");
        const input = modal.querySelector(`[name="${name}"]`);
        if (input) input.value = attr.value;
      }
    });
  }

  // Вспомогательные методы
  showError(el, msg) {
    const parent = el.closest(".smart-form__group");
    let errorDiv = parent.querySelector(".error-msg");
    if (!errorDiv) {
      errorDiv = document.createElement("div");
      errorDiv.className = "error-msg";
      parent.appendChild(errorDiv);
    }
    errorDiv.textContent = msg;
    el.classList.add("is-invalid");
    parent.classList.add("is-invalid");
    return false;
  }

  clearError(el) {
    const parent = el.closest(".smart-form__group");
    if (parent) {
      el.classList.remove("is-invalid");
      parent.classList.remove("is-invalid");
      const err = parent.querySelector(".error-msg");
      if (err) err.remove();
    }
  }

  generateToken(form) {
    this.tokens.set(form, Date.now());
  }

  toggleBodyLock(lock) {
    const body = document.body;
    if (lock) {
      const sw = window.innerWidth - document.documentElement.clientWidth;
      body.style.paddingRight = sw + "px";
      body.classList.add("modal-lock");
    } else {
      body.style.paddingRight = "";
      body.classList.remove("modal-lock");
    }
  }

  closeAllModals() {
    document.querySelectorAll(".smart-modal").forEach((m) => m.classList.remove("is-open"));
    this.toggleBodyLock(false);
  }
  
  handleSuccess(form) {
    // 1. Проверяем редирект
    if (form.dataset.successAction === "redirect") {
      const url = form.dataset.successUrl || "/thanks";
      window.location.href = url;
      return; // Выходим, чтобы не выполнять код ниже
    }

    // 2. Если не редирект, показываем сообщение об успехе
    // Вместо удаления всего HTML, лучше добавить класс "отправлено"
    // и показать скрытый заранее блок или заменить контент аккуратно
    const successMessage = `
        <div class="success-finish">
            <h3>Спасибо!</h3>
            <p>Ваша заявка принята. Мы свяжемся с вами в ближайшее время.</p>
        </div>
    `;

    // Сохраняем высоту формы, чтобы она не "прыгала" при исчезновении полей
    form.style.minHeight = form.offsetHeight + "px";

    // Заменяем содержимое
    form.innerHTML = successMessage;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.SmartFormInstance = new SmartForm();
});
