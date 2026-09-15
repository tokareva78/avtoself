(function() {
  "use strict";

  class PremiumHeader {
    constructor() {
      // Настройка порога только для закрытия мобильного меню при ресайзе
      this.mobileBreakpoint = 1300;

      this.header = document.querySelector('[data-role="main-header"]');
      this.navList = document.querySelector('[data-role="nav-list"]');
      this.actions = document.querySelector('[data-role="header-actions"]');

      this.mobileMenu = document.querySelector('[data-role="mobile-menu"]');
      this.mobileNavRoot = document.querySelector('[data-role="mobile-nav-root"]');
      this.mobileFooter = document.querySelector('[data-role="mobile-footer"]');

      this.body = document.body;
      this.lastScroll = 0;
      this.panelsHistory = ["main"];

      if (this.validate()) {
        this.init();
      }
    }

    validate() {
      const required = {
        Header: this.header,
        "Nav List": this.navList,
        "Mobile Menu": this.mobileMenu,
      };
      for (const [name, el] of Object.entries(required)) {
        if (!el) {
          console.error(`❌ [Header Error]: Element "${name}" not found!`);
          return false;
        }
      }
      return true;
    }

    init() {
      this.prepareMobileMenu();
      this.bindEvents();
      this.handleSticky();
    }

    bindEvents() {
      window.addEventListener("resize", () => {
        // Если экран стал шире брейкпоинта — закрываем мобилку
        if (window.innerWidth > this.mobileBreakpoint) {
          this.toggleMobile(false);
        }
      });

      window.addEventListener("scroll", () => this.handleSticky(), { passive: true });

      document.querySelectorAll('[data-action="toggle-mobile"]').forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          this.toggleMobile();
        });
      });

      if (this.mobileMenu) {
        this.mobileMenu.addEventListener("click", (e) => {
          const trigger = e.target.closest('[data-action="open-panel"]');
          const backBtn = e.target.closest('[data-action="back-panel"]');
          const link = e.target.closest("a");

          if (trigger) {
            e.preventDefault();
            e.stopPropagation();
            this.openPanel(trigger.dataset.target);
            return;
          }

          if (backBtn) {
            e.preventDefault();
            e.stopPropagation();
            this.closePanel();
            return;
          }

          if (link) {
            const href = link.getAttribute("href");
            if (href && href !== "#") {
              this.toggleMobile(false);
            }
          }
        });
      }
    }

    handleSticky() {
      const current = window.pageYOffset;
      if (current <= 0) {
        this.header.dataset.state = "visible";
        return;
      }
      this.header.dataset.state = current > this.lastScroll && current > 100 ? "hidden" : "visible";
      this.lastScroll = current;
    }

    prepareMobileMenu() {
      if (!this.mobileNavRoot) return;
      this.mobileNavRoot.innerHTML = "";

      const subPanels = this.mobileMenu.querySelectorAll(".mobile-panel--sub");
      subPanels.forEach((p) => p.remove());

      const desktopItems = this.navList.querySelectorAll(":scope > .nav__item");
      desktopItems.forEach((item, index) => {
        const panelId = `panel-L1-${index}`;
        const li = this.createMobileNavItem(item, panelId);
        this.mobileNavRoot.appendChild(li);
      });

      if (this.mobileFooter) {
        this.mobileFooter.innerHTML = "";
        ["clone-phone", "clone-socials", "clone-btn"].forEach((role) => {
          const el = document.querySelector(`[data-role="${role}"]`)?.cloneNode(true);
          if (el) {
            el.classList.remove("is-hidden");
            this.mobileFooter.appendChild(el);
          }
        });
      }
    }

    createMobileNavItem(sourceItem, panelId) {
      const link = sourceItem.querySelector(":scope > .nav__link, :scope > .dropdown__link, :scope > a, :scope > span");
      const text = link ? link.textContent.trim() : "Меню";

      const subMenu = sourceItem.querySelector(":scope > ul, :scope > .dropdown, :scope > .dropdown-sub");
      const isMega = sourceItem.dataset.hasChildren === "mega";
      const hasSub = isMega || !!subMenu;

      const li = document.createElement("li");
      li.className = "mobile-nav__item";

      if (hasSub) {
        li.innerHTML = `
                    <div class="mobile-nav__link" data-action="open-panel" data-target="${panelId}">
                        <span>${text}</span>
                        <button class="btn-next" tabindex="-1" type="button">→</button>
                    </div>`;
        this.createSubPanel(sourceItem, panelId, text);
      } else {
        const href = link && link.tagName === "A" ? link.getAttribute("href") : "#";
        li.innerHTML = `<div class="mobile-nav__link"><a href="${href}">${text}</a></div>`;
      }

      return li;
    }

    createSubPanel(parentItem, id, title) {
      const panel = document.createElement("div");
      panel.className = "mobile-panel mobile-panel--sub";
      panel.dataset.panel = id;
      panel.dataset.active = "false";

      let html = `<button class="btn-back" data-action="back-panel" type="button">← <span>${title}<span></button>`;
      html += `<ul class="mobile-nav">`;

      if (parentItem.dataset.hasChildren === "mega") {
        const cards = parentItem.querySelectorAll(".mega-card");
        cards.forEach((card) => {
          const cardHref = card.getAttribute("href") || "#";
          const img = card.querySelector("[mega-card-img]")?.getAttribute("src") || "";
          const info = card.querySelector(".mega-card__info")?.textContent || "";
          const ttl = card.querySelector(".mega-card__title")?.textContent || "";
          const desc = card.querySelector(".mega-card__desc")?.textContent || "";

          html += `
                        <li class="mobile-nav__item mobile-nav__item--card">
                            <a href="${cardHref}" class="mobile-card-link">
                                ${img ? `<img src="${img}" class="mobile-card-link__img" alt="">` : ""}
                                <div class="mobile-card-link__content">
                                    <span class="mobile-card-link__info">${info}</span>
                                    <span class="mobile-card-link__title">${ttl}</span>
                                    <p class="mobile-card-link__desc">${desc}</p>
                                </div>
                            </a>
                        </li>`;
        });
      } else {
        const subMenu = parentItem.querySelector(":scope > ul, :scope > .dropdown, :scope > .dropdown-sub");
        if (subMenu) {
          const subItems = subMenu.querySelectorAll(":scope > li");
          subItems.forEach((subItem, subIndex) => {
            const subPanelId = `${id}-${subIndex}`;
            const li = this.createMobileNavItem(subItem, subPanelId);
            html += li.outerHTML;
          });
        }
      }

      html += `</ul>`;
      panel.innerHTML = html;
      this.mobileMenu.querySelector(".mobile-menu__content").appendChild(panel);
    }

    toggleMobile(force) {
      const isOpen = force !== undefined ? force : this.mobileMenu.dataset.state === "closed";
      this.mobileMenu.dataset.state = isOpen ? "open" : "closed";
      this.body.classList.toggle("is-locked", isOpen);

      if (!isOpen) {
        setTimeout(() => {
          this.mobileMenu.querySelectorAll(".mobile-panel").forEach((p) => {
            p.dataset.active = "false";
            p.removeAttribute("data-state");
          });
          const mainPanel = this.mobileMenu.querySelector('[data-panel="main"]');
          if (mainPanel) mainPanel.dataset.active = "true";
          this.panelsHistory = ["main"];
        }, 400);
      }
    }

    openPanel(id) {
      const nextPanel = this.mobileMenu.querySelector(`[data-panel="${id}"]`);
      if (!nextPanel) return;

      const currentId = this.panelsHistory[this.panelsHistory.length - 1];
      const currentPanel = this.mobileMenu.querySelector(`[data-panel="${currentId}"]`);

      if (currentPanel) {
        currentPanel.dataset.state = "parent-hidden";
      }

      nextPanel.dataset.active = "true";
      this.panelsHistory.push(id);
      this.mobileMenu.querySelector(".mobile-menu__content").scrollTop = 0;
    }

    closePanel() {
      if (this.panelsHistory.length <= 1) return;

      const currentId = this.panelsHistory.pop();
      const currentPanel = this.mobileMenu.querySelector(`[data-panel="${currentId}"]`);
      if (currentPanel) currentPanel.dataset.active = "false";

      const prevId = this.panelsHistory[this.panelsHistory.length - 1];
      const prevPanel = this.mobileMenu.querySelector(`[data-panel="${prevId}"]`);
      if (prevPanel) {
        prevPanel.removeAttribute("data-state");
        prevPanel.dataset.active = "true";
      }
    }
  }

  window.HeaderModule = {
    init() {
      return new PremiumHeader();
    },
  };
})();
