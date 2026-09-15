(function() {
  function initAll() {
    if (window.HeaderMenuModule) window.HeaderMenuModule.init();
    // if (window.ModalModule) window.ModalModule.init();
    // if (window.FormsValidation) FormsValidation.init();
    
  if (window.FaqModule && document.querySelector("[data-faq]")) {
    window.FaqModule.init();
  }
// ЗАПУСК FAQ МОДУЛЯ (SEO текст)
  if (window.SeoModule && document.querySelector('[data-role="seo-container"]')) {
    window.SeoModule.init();
  }
    if (window.GraduatesReviewsModule) window.GraduatesReviewsModule.init();

    // ⬅️ ЗАПУСК МОДУЛЯ СЛАЙДЕРОВ
    // if (window.SlidersModule) window.SlidersModule.init();
    
    // ⬅️ ЗАПУСК МОДУЛЯ ВАЛИДАЦИИ И МОДАЛОК
    if (window.AvtoselfFormsValidation) window.AvtoselfFormsValidation.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll, { once: true });
  } else {
    initAll();
  }
})();
