const PurchaseModule = {
  init() {
    this.cards = document.querySelectorAll('[data-role="scroll-card"]');

    if (this.cards.length > 0 && window.innerWidth > 992) {
      this.bindObserver();
    }

    this.bindEvents();
  },

  bindObserver() {
    // Точная "линия захвата" для переключения классов
    const options = {
      root: null,
      rootMargin: "-150px 0px -75% 0px",
      threshold: 0,
    };

    const callback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.activateCard(entry.target);
        }
      });
    };

    const observer = new IntersectionObserver(callback, options);
    this.cards.forEach((card) => observer.observe(card));
  },

  activateCard(activeCard) {
    this.cards.forEach((card) => card.classList.remove("is-active"));
    activeCard.classList.add("is-active");
  },
};
export default PurchaseModule;
// window.addEventListener("DOMContentLoaded", () => PurchaseModule.init());
