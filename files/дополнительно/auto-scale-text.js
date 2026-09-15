(function() {
  "use strict";
  window.AutoScaleText = {
    init() {
      const adjustFontSize = (container) => {
        const textNode = container.querySelector("[data-fit-text]");
        if (!textNode) return;

        const minSize = parseFloat(container.dataset.minSize) || 0;
        const maxSize = parseFloat(container.dataset.maxSize) || Infinity;

        const containerStyles = window.getComputedStyle(container);
        const paddingLeft = parseFloat(containerStyles.paddingLeft) || 0;
        const paddingRight = parseFloat(containerStyles.paddingRight) || 0;

        const availableWidth = container.clientWidth - paddingLeft - paddingRight;
        if (availableWidth <= 0) return;

        const textStyles = window.getComputedStyle(textNode);
        const currentFontSize = parseFloat(textStyles.fontSize);

        const textWidth = textNode.getBoundingClientRect().width;
        if (textWidth === 0) return;

        let newFontSize = (availableWidth / textWidth) * currentFontSize;
        newFontSize = Math.max(minSize, Math.min(newFontSize, maxSize));

        textNode.style.fontSize = `${Math.floor(newFontSize * 10) / 10 - 0.1}px`;
      };

      const init = () => {
        const containers = document.querySelectorAll("[data-container-fit-text]");
        if (!containers.length) return;

        const resizeObserver = new ResizeObserver((entries) => {
          window.requestAnimationFrame(() => {
            for (const entry of entries) {
              if (entry.contentRect.width > 0) {
                adjustFontSize(entry.target);
              }
            }
          });
        });

        containers.forEach((container) => {
          adjustFontSize(container);
          resizeObserver.observe(container);
        });

        // Возвращаем метод для отписки (полезно для SPA)
        return () => resizeObserver.disconnect();
      };

      // Запуск логики после загрузки шрифтов
      if (document.fonts && document.fonts.ready) {
        // Возвращаем Promise с функцией очистки
        return document.fonts.ready.then(init);
      } else {
        // Фолбэк
        window.addEventListener("load", init);
        return () => {}; // Пустая функция очистки для старых браузеров
      }
    },
  };
})();
