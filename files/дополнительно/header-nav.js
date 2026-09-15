(function() {
  "use strict";
  window.HeaderNav = {
    init() {
      // ========== HEADER ========== //
      const header = document.querySelector("[data-js-header]"),
        headerH = document.querySelector("[data-js-header]").clientHeight,
        menu = document.querySelector(".nav"),
        burger = document.querySelector(".burger"),
        mobileBack = document.querySelector(".mobile-back");

      // Если добавить .overlay и в дальнейшем делать клик по нему на закрытие меню
      // const overlay = document.querySelector('.overlay');

      // Выезжающая шапка
      document.onscroll = function() {
        let scroll = window.scrollY;

        //if (scroll > headerH) {-->
        if (scroll > headerH + 200) {
          header.classList.add("fixed");
          document.body.style.paddingTop = headerH + "px";
        } else {
          header.classList.remove("fixed");
          document.body.removeAttribute("style");
        }
      };

      const nav = document.querySelector("[data-js-nav]");

      nav.addEventListener("mouseenter", () => {
        header.style.backgroundColor = "#fff";
      });

      nav.addEventListener("mouseleave", () => {
        header.style.backgroundColor = "";
      });

      // Мобильное меню

      // Рассчитываем ширину скроллбара при загрузке страницы
      const getScrollbarWidth = () => {
        const outer = document.createElement("div");
        outer.style.visibility = "hidden";
        outer.style.overflow = "scroll";
        document.body.appendChild(outer);

        const inner = document.createElement("div");
        outer.appendChild(inner);

        const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
        outer.remove();

        return scrollbarWidth;
      };

      const scrollbarWidth = getScrollbarWidth();

      const lockScroll = () => {
        if (header && scrollbarWidth > 0) {
          header.style.paddingRight = scrollbarWidth + "px";
        }

        document.body.classList.add("lock");
      };

      const unlockScroll = () => {
        document.body.classList.remove("lock");
        if (header) {
          header.style.paddingRight = "";
        }
      };

      const initialMenu = () => {
        document.querySelector(".nav__list--dropdown").classList.remove("transformation");
        document
          .querySelector(".nav")
          .querySelector(".nav__list")
          .classList.remove("transformation");
        scrollTop();
      };

      const scrollTop = () => {
        menu.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      };

      burger.addEventListener("click", () => {
        if (burger.classList.contains("open")) {
          // Закрываем меню
          burger.classList.remove("open");
          menu.classList.remove("open");
          // Если добавлен .overlay - то включить
          // overlay.classList.remove('open');
          unlockScroll();
        } else {
          // Открываем меню
          burger.classList.add("open");
          menu.classList.add("open");
          // Если добавлен .overlay - то включить
          // overlay.classList.add('open');
          lockScroll();
          initialMenu();
        }
      });

      // Если добавлен .overlay - то включить

      // overlay.addEventListener('click', () => {
      // 	burger.classList.remove('open');
      // 	menu.classList.remove('open');
      // 	overlay.classList.remove('open');
      // 	unlockScroll();
      // });

      menu.addEventListener("click", (e) => {
        if (e.target.classList.contains("nav__link--drop")) {
          e.preventDefault();
          e.target.closest(".nav__list").classList.add("transformation");
          e.target
            .closest(".nav__item")
            .querySelector(".nav__list--dropdown")
            .classList.add("transformation");
          scrollTop();
        }

        if (e.target.classList.contains("mobile-back__link")) {
          e.preventDefault();
          e.target.closest(".nav__list--dropdown").classList.remove("transformation");
          e.target
            .closest(".nav")
            .querySelector(".nav__list")
            .classList.remove("transformation");
          scrollTop();
        }

        if (e.target.classList.contains("nav__link") && !e.target.classList.contains("nav__link--drop")) {
          e.preventDefault();
          burger.classList.remove("open");
          menu.classList.remove("open");
          // Если добавлен .overlay - то включить
          // overlay.classList.remove('open');
          unlockScroll();
        }
      });
      // ========== HEADER END ========== //
    },
  };
})();
