window.FaqModule = {
  config: {
    allowMultiple: false,
  },

  init() {
    const faqBlocks = document.querySelectorAll("[data-faq]");
    if (!faqBlocks.length) return;

    faqBlocks.forEach((faq) => {
      if (faq.dataset.faqInit === "true") return;
      faq.dataset.faqInit = "true";

      const items = faq.querySelectorAll("[data-faq-item]");

      if (!items.length) {
        faq.classList.add("is-empty");
        return;
      }

      const openItem = (item) => {
        const button = item.querySelector("[data-faq-toggle]");
        const answer = item.querySelector("[data-faq-answer]");

        if (!button || !answer) return;

        item.classList.add("faq__item--open");
        button.setAttribute("aria-expanded", "true");

        answer.style.height = "0px";

        requestAnimationFrame(() => {
          answer.style.height = `${answer.scrollHeight}px`;
        });
      };

      const closeItem = (item) => {
        const button = item.querySelector("[data-faq-toggle]");
        const answer = item.querySelector("[data-faq-answer]");

        if (!button || !answer) return;

        answer.style.height = `${answer.scrollHeight}px`;

        requestAnimationFrame(() => {
          item.classList.remove("faq__item--open");
          button.setAttribute("aria-expanded", "false");
          answer.style.height = "0px";
        });
      };

      const closeOtherItems = (currentItem) => {
        if (this.config.allowMultiple) return;

        items.forEach((item) => {
          if (item === currentItem) return;
          if (!item.classList.contains("faq__item--open")) return;

          closeItem(item);
        });
      };

      items.forEach((item) => {
        const button = item.querySelector("[data-faq-toggle]");
        const answer = item.querySelector("[data-faq-answer]");

        if (!button || !answer) return;

        button.addEventListener("click", () => {
          const isOpen = item.classList.contains("faq__item--open");

          if (isOpen) {
            closeItem(item);
            return;
          }

          closeOtherItems(item);
          openItem(item);
        });

        answer.addEventListener("transitionend", (event) => {
          if (event.propertyName !== "height") return;

          if (item.classList.contains("faq__item--open")) {
            answer.style.height = "auto";
          }
        });
      });

      window.addEventListener("resize", () => {
        items.forEach((item) => {
          const answer = item.querySelector("[data-faq-answer]");

          if (!answer) return;

          if (item.classList.contains("faq__item--open")) {
            answer.style.height = "auto";
          }
        });
      });
    });
  },
};
