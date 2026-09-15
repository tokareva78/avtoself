/**
 * ModalModule — универсальное открытие/закрытие/заполнение ЛЮБОЙ .modal-overlay
 * на странице (сейчас их две: #modalReviews, #modalForm — обе обслуживает
 * один и тот же код, без хардкода конкретных id).
 *
 * Контракт на data-атрибутах (совместим с уже существующей разметкой index.html):
 *   data-modal-target="#id"   — на кнопке-открывашке: какую модалку открыть
 *   data-modal-KEY             — на кнопке-открывашке (значение) + на элементе
 *                                внутри модалки (просто маркер, без значения) —
 *                                значение с кнопки подставится в textContent
 *                                всех [data-modal-KEY] внутри ЭТОЙ модалки.
 *                                Пример уже есть в разметке: data-modal-title,
 *                                data-modal-subtitle — работает для ЛЮБОГО KEY,
 *                                не только этих двух.
 *   data-modal-clear            — на элементе внутри модалки: очищать (в пустую
 *                                строку) при КАЖДОМ открытии, ДО того как
 *                                применится значение с текущей кнопки. Нужно,
 *                                чтобы заголовок/подзаголовок не "залипал" от
 *                                прошлого открытия другой кнопкой, если у
 *                                текущей кнопки такого data-modal-KEY нет.
 *   data-modal-close             — кнопка закрытия (крестик)
 *
 * Состояние — класс .active (под него уже есть CSS в main.css), не .open.
 *
 * Блокировка скролла — через position:fixed с сохранением/восстановлением
 * scrollY (а не просто body.modal-open{overflow:hidden}, которое было в
 * main.css раньше) — иначе после закрытия модалки страница "прыгает" к
 * началу. Плюс компенсация ширины пропадающей полосы прокрутки через
 * CSS-переменную --scrollbar-comp (см. правки в main.css).
 *
 * Открытие модалки бросает кастомное событие "modal:open" с самой модалкой
 * в detail — FormsValidation слушает его, чтобы стартовать антиспам-таймер
 * формы внутри именно в момент открытия, а не с фокуса на конкретном поле.
 * Модули общаются событием, а не прямым вызовом функций друг друга — это
 * не требует, чтобы ModalModule вообще знал о существовании форм.
 */
window.ModalModule = (function() {
  var scrollLockY = 0;
  var isScrollLocked = false;

  function lockScroll() {
    if (isScrollLocked) return;
    scrollLockY = window.scrollY || window.pageYOffset || 0;
    var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty("--scrollbar-comp", scrollbarWidth + "px");
    document.body.classList.add("modal-open");
    document.body.style.position = "fixed";
    document.body.style.top = -scrollLockY + "px";
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    isScrollLocked = true;
  }

  function unlockScroll() {
    if (!isScrollLocked) return;
    document.body.classList.remove("modal-open");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    var htmlEl = document.documentElement;
    var prevBehavior = htmlEl.style.scrollBehavior;
    htmlEl.style.scrollBehavior = "auto";
    window.scrollTo(0, scrollLockY);
    htmlEl.style.scrollBehavior = prevBehavior || "";
    document.documentElement.style.setProperty("--scrollbar-comp", "0px");
    isScrollLocked = false;
  }

  function populateModalFromOpener(modal, opener) {
    if (!modal || !opener) return;
    // сброс "очищаемых" полей — всегда, до применения того, что скажет текущая кнопка
    modal.querySelectorAll("[data-modal-clear]").forEach(function(el) {
      el.textContent = "";
    });
    Array.prototype.forEach.call(opener.attributes, function(attr) {
      if (attr.name.indexOf("data-modal-") !== 0) return;
      if (attr.name === "data-modal-target") return; // это служебный, не для заполнения
      modal.querySelectorAll("[" + attr.name + "]").forEach(function(t) {
        t.textContent = attr.value;
      });
    });
  }

  function openModal(modal) {
    if (!modal) return;
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    lockScroll();
    document.dispatchEvent(new CustomEvent("modal:open", { detail: { modal: modal } }));
  }

  function closeModal(modal) {
    if (!modal) return;
    /* снимаем фокус ДО скрытия — иначе браузер жалуется, что прячет от
       читалок экрана элемент, на котором ещё стоит фокус (например,
       кнопку-крестик сразу после клика по ней) */
    if (modal.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    unlockScroll();
    document.dispatchEvent(new CustomEvent("modal:close", { detail: { modal: modal } }));
  }

  function bindEvents() {
    document.addEventListener("click", function(e) {
      var opener = e.target.closest("[data-modal-target]");
      if (opener) {
        e.preventDefault();
        var modal = document.querySelector(opener.getAttribute("data-modal-target"));
        if (modal) {
          populateModalFromOpener(modal, opener);
          openModal(modal);
        }
        return;
      }
      var closer = e.target.closest("[data-modal-close]");
      if (closer) {
        var m = closer.closest(".modal-overlay");
        if (m) closeModal(m);
        return;
      }
      if (e.target.classList && e.target.classList.contains("modal-overlay")) {
        closeModal(e.target);
      }
    });

    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay.active").forEach(function(m) {
          closeModal(m);
        });
      }
    });
  }

  function init() {
    bindEvents();
  }

  return {
    init: init,
    open: openModal,
    close: closeModal,
  };
})();
