(function() {
  "use strict";

  window.PurchaseModule = {
    // Хранение экземпляра для предотвращения дублирования
    observer: null,

    init() {
      this.cards = document.querySelectorAll('[data-role="scroll-card"]');
      if (!this.cards.length) return;

      this.update();
      this.bindEvents();
    },

    update() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      if (window.innerWidth > 1080) {
        this.bindObserver();
      } else {
        this.cards.forEach((card) => card.classList.add("is-active"));
      }
    },

    bindObserver() {
      /**
     -100px отсекают зону шапки, -90% поднимают нижнюю границу к верху rootMargin: "-100px 0px -90% 0px", **/
      const options = {
        root: null,
        rootMargin: "-30% 0px -85% 0px",
        threshold: 0,
      };

      const callback = (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.activateCard(entry.target);
          }
        });
      };

      this.observer = new IntersectionObserver(callback, options);
      this.cards.forEach((card) => this.observer.observe(card));
    },

    activateCard(activeCard) {
      if (activeCard.classList.contains("is-active")) return;

      this.cards.forEach((card) => {
        card.classList.toggle("is-active", card === activeCard);
      });
    },

    bindEvents() {
      let resizeTimeout;
      window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          this.update();
        }, 200);
      });

      window.addEventListener("load", () => this.update());
    },
  };
})();
