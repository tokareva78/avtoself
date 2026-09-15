window.SeoModule = {
  init: function() {
    const seoContainers = document.querySelectorAll('[data-role="seo-container"]');

    if (seoContainers.length === 0) return;

    seoContainers.forEach((container) => {
      this.bindEvents(container);
    });
  },

  bindEvents: function(container) {
    container.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-js-seo-trigger]");
      if (!trigger) return;

      const currentItem = trigger.closest("[data-js-seo-item]");
      if (!currentItem) return;

      const isOpen = currentItem.getAttribute("data-state") === "open";

      const siblingItems = container.querySelectorAll("[data-js-seo-item]");
      siblingItems.forEach((item) => {
        item.setAttribute("data-state", "closed");
        const itemTrigger = item.querySelector("[data-js-seo-trigger]");
        if (itemTrigger) itemTrigger.setAttribute("aria-expanded", "false");
      });

      if (!isOpen) {
        currentItem.setAttribute("data-state", "open");
        trigger.setAttribute("aria-expanded", "true");
      }
    });
  },
};
