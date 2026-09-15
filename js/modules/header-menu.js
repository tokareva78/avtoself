window.HeaderMenuModule = {
  init() {
    const BREAKPOINT = 900;
    const headerBlocks = document.querySelectorAll("[data-header-menu]");
    const stickyHeaders = document.querySelectorAll("[data-sticky-header]");

    if (!headerBlocks.length && !stickyHeaders.length) return;

    let lastScrollY = window.scrollY;
    let ticking = false;

    const closeMobileMenu = (block) => {
      if (!block) return;

      const toggle = block.querySelector("[data-menu-toggle]");

      block.classList.remove("header-section--menu-open");

      if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
      }
    };

    const isMobile = () => window.innerWidth <= BREAKPOINT;

    headerBlocks.forEach((block) => {
      if (block.dataset.headerMenuInit === "true") return;
      block.dataset.headerMenuInit = "true";

      const toggle = block.querySelector("[data-menu-toggle]");
      const menu = block.querySelector("[data-menu]");

      if (!toggle || !menu) return;

      const openClass = "header-section--menu-open";

      const isOpen = () => block.classList.contains(openClass);

      const openMenu = () => {
        block.classList.add(openClass);
        toggle.setAttribute("aria-expanded", "true");
      };

      const closeMenu = () => {
        block.classList.remove(openClass);
        toggle.setAttribute("aria-expanded", "false");
      };

      toggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (isOpen()) {
          closeMenu();
        } else {
          openMenu();
        }
      });

      menu.addEventListener("click", (event) => {
        const link = event.target.closest("a");
        if (!link) return;

        const href = link.getAttribute("href");

        closeMenu();

        if (!href || !href.startsWith("#") || href === "#") return;

        const target = document.querySelector(href);
        if (!target) return;

        event.preventDefault();

        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });

        window.history.pushState(null, "", href);
      });

      document.addEventListener("click", (event) => {
        if (!isOpen()) return;

        const clickedMenu = menu.contains(event.target);
        const clickedToggle = toggle.contains(event.target);

        if (clickedMenu || clickedToggle) return;

        closeMenu();
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeMenu();
        }
      });

      window.addEventListener("resize", () => {
        if (!isMobile()) {
          closeMenu();
        }
      });
    });

    if (stickyHeaders.length) {
      const updateStickyHeader = () => {
        const currentScrollY = window.scrollY;
        const scrollDiff = currentScrollY - lastScrollY;
        const isScrollingDown = scrollDiff > 0;
        const isScrollingUp = scrollDiff < 0;
        const minOffset = 120;

        stickyHeaders.forEach((header) => {
          const rootBlock = header.closest("[data-header-menu]");

          if (currentScrollY > 10) {
            header.classList.add("header-section__menu--scrolled");
          } else {
            header.classList.remove("header-section__menu--scrolled");
          }

          if (currentScrollY <= minOffset) {
            header.classList.remove("header-section__menu--hidden");
            return;
          }

          if (isScrollingDown) {
            header.classList.add("header-section__menu--hidden");
            closeMobileMenu(rootBlock);
          }

          if (isScrollingUp) {
            header.classList.remove("header-section__menu--hidden");
          }
        });

        lastScrollY = Math.max(currentScrollY, 0);
        ticking = false;
      };

      window.addEventListener(
        "scroll",
        () => {
          if (ticking) return;

          window.requestAnimationFrame(updateStickyHeader);
          ticking = true;
        },
        { passive: true }
      );
    }
  },
};
