(() => {
  "use strict";

  const CATALOG_CONFIG = {
    source: {
      mode: "data",
      // "data" Загрузка каталога из APP_DATA | "static" Статичные карточки
    },

    filterMode: "or",
    // 'or' | 'and' ЗАМЕНА НА РЕЖИМ И / ИЛИ в чипах (тегах)

    sorting: {
      enabled: true,
      // Чтобы вообще убрать сортировку: enabled: false
      defaultValue: "default",

      // быстрое включение/выключение вариантов
      options: {
        default: {
          enabled: true,
          label: "По умолчанию",
        },
        titleAsc: {
          enabled: true,
          // Чтобы убрать только сортировку по имени: enabled: false
          label: "По названию А–Я",
        },
        priceAsc: {
          enabled: true,
          label: "Сначала дешевле",
        },
        priceDesc: {
          enabled: true,
          label: "Сначала дороже",
        },
        weightAsc: {
          enabled: true,
          label: "Сначала легче",
        },
        weightDesc: {
          enabled: true,
          label: "Сначала тяжелее",
        },
      },
    },
    // ОТСТУП СВЕРХУ
    ui: {
      scrollToTopOnChipClick: true,
      scrollOffset: 30,
    },

    //   ВКЛЮЧЕНО СОХРАНЕНИЕ ЧИПОВ В LOCALSTORAG (чтобы у каждого блока с data-catalog-root была своя сохранённая выборка чипов)
    persistence: {
      enabled: true,
      storageNamespace: "catalog-filters",
    },
  };
  //   1. Источник данных
  // Берёт массив товаров из window.APP_DATA.db_catalog
  const getCatalog = () => {
    const catalog = window.APP_DATA?.db_catalog;
    return Array.isArray(catalog) ? catalog : [];
  };
  // Возвращает режим работы каталога: из JS-данных или из статичной HTML-разметки
  const getCatalogSourceMode = () => {
    return CATALOG_CONFIG.source?.mode === "static" ? "static" : "data";
  };
  // 2. Базовые утилиты
  // Экранирует HTML-символы, чтобы безопасно вставлять текст в шаблон

  const escapeHtml = (value = "") =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  // Проверяет, что значение не пустое

  const hasValue = (value) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && String(value).trim() !== "";
  };

  // Определяет, нужно ли показывать товар по полю display

  const isDisplayEnabled = (value) => {
    if (value === undefined) return false;

    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (["true", "1", "yes", "on"].includes(normalized)) return true;
      if (["false", "0", "no", "off"].includes(normalized)) return false;
    }

    return Boolean(value);
  };

  // 3. Работа с тегами
  // Приводит tags к массиву: поддерживает и строку, и массив

  const normalizeTags = (tags) => {
    if (Array.isArray(tags)) {
      return tags.map((tag) => String(tag).trim()).filter(Boolean);
    }

    if (typeof tags === "string") {
      return tags
        .split(/[,;|]/)
        .map((tag) => tag.trim())
        .filter(Boolean);
    }

    return [];
  };

  // 4. Парсеры для сортировки
  // Достаёт число из цены и приводит к Number

  const parseNumber = (value) => {
    if (!hasValue(value)) return null;

    const normalized = String(value)
      .replace(/\s+/g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "");

    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  };

  // Приводит вес/объём к числу для сортировки

  const parseWeight = (value) => {
    if (!hasValue(value)) return null;

    const text = String(value)
      .toLowerCase()
      .replace(",", ".");
    const match = text.match(/-?\d+(\.\d+)?/);

    if (!match) return null;

    const number = Number(match[0]);
    if (!Number.isFinite(number)) return null;

    if (text.includes("кг")) return number * 1000;
    if (text.includes("г")) return number;
    if (text.includes("мл")) return number;
    if (text.includes("л")) return number * 1000;

    return number;
  };

  // 5. Компараторы
  // Сравнивает числа, корректно отправляя пустые значения в конец

  const compareNullableNumbers = (a, b, direction = "asc") => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;

    return direction === "asc" ? a - b : b - a;
  };

  // Сравнивает строки, корректно отправляя пустые значения в конец

  const compareNullableStrings = (a, b, direction = "asc") => {
    const valueA = hasValue(a) ? String(a).trim() : "";
    const valueB = hasValue(b) ? String(b).trim() : "";

    if (!valueA && !valueB) return 0;
    if (!valueA) return 1;
    if (!valueB) return -1;

    return direction === "asc" ? valueA.localeCompare(valueB, "ru") : valueB.localeCompare(valueA, "ru");
  };

  // 6. Настройки сортировки
  // Возвращает только включённые варианты сортировки из конфига

  const getEnabledSortOptions = () => {
    return Object.entries(CATALOG_CONFIG.sorting.options || {}).filter(([, option]) => option && option.enabled);
  };

  // Определяет стартовую сортировку

  const getInitialSortValue = () => {
    const enabledOptions = getEnabledSortOptions();
    const defaultValue = CATALOG_CONFIG.sorting.defaultValue;

    const hasDefault = enabledOptions.some(([value]) => value === defaultValue);
    if (hasDefault) return defaultValue;

    return enabledOptions.length ? enabledOptions[0][0] : "default";
  };

  // Сортирует массив товаров по выбранному режиму

  const sortProducts = (items, sortValue) => {
    if (!Array.isArray(items) || !items.length) return [];
    if (!sortValue || sortValue === "default") return [...items];

    const sorted = [...items];

    switch (sortValue) {
      case "titleAsc":
        return sorted.sort((a, b) => compareNullableStrings(a.title, b.title, "asc"));

      case "priceAsc":
        return sorted.sort((a, b) => compareNullableNumbers(parseNumber(a.price), parseNumber(b.price), "asc"));

      case "priceDesc":
        return sorted.sort((a, b) => compareNullableNumbers(parseNumber(a.price), parseNumber(b.price), "desc"));

      case "weightAsc":
        return sorted.sort((a, b) => compareNullableNumbers(parseWeight(a.weight), parseWeight(b.weight), "asc"));

      case "weightDesc":
        return sorted.sort((a, b) => compareNullableNumbers(parseWeight(a.weight), parseWeight(b.weight), "desc"));

      default:
        return sorted;
    }
  };

  // 7. Форматирование вывода
  // Собирает data-* атрибут, только если значение не пустое

  const buildDataAttr = (name, value) => {
    return hasValue(value) ? ` ${name}="${escapeHtml(value)}"` : "";
  };

  // Форматирует цену в вид "1 200 ₽"

  const formatPrice = (price) => {
    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice)) {
      return hasValue(price) ? `${escapeHtml(price)} ₽` : "";
    }

    return `${new Intl.NumberFormat("ru-RU").format(numericPrice)} ₽`;
  };

  // Возвращает текст цены или "Под запрос"

  const getPriceLabel = (price) => {
    return hasValue(price) ? formatPrice(price) : "Под запрос";
  };

  // Собирает HTML картинки товара

  const buildProductImage = (product) => {
    if (!hasValue(product.image)) {
      return "";
    }

    const imageValue = String(product.image).trim();
    const categoryDir = hasValue(product.id_cat)
      ? String(product.id_cat)
          .trim()
          .replace(/^\/+|\/+$/g, "")
      : "";
    const altText = escapeHtml(product.title || "");

    // Новый формат:
    // id_cat: "soleniya"
    // image: "vinogradnie-listya"
    if (categoryDir && !/[\\/]/.test(imageValue)) {
      const fileName = imageValue.replace(/\.(webp|jpe?g|png|avif)$/i, "");

      return `
      <div class="catalog-card__media">
        <picture>
          <source
            srcset="./img/webp/${escapeHtml(categoryDir)}/${escapeHtml(fileName)}.webp"
            type="image/webp"
          >
          <img
            class="catalog-card__image"
            src="./img/${escapeHtml(categoryDir)}/${escapeHtml(fileName)}.jpg"
            alt="${altText}"
            loading="lazy"
          >
        </picture>
      </div>
    `;
    }

    // Фолбэк для старого формата, если image уже хранит полный путь
    return `
    <div class="catalog-card__media">
      <img
        class="catalog-card__image"
        src="${escapeHtml(imageValue)}"
        alt="${altText}"
        loading="lazy"
      >
    </div>
  `;
  };

  // 8. Persistence / localStorage
  // Строит ключ localStorage для текущего каталога

  const getCatalogStorageKey = (root, categories = []) => {
    const namespace = CATALOG_CONFIG.persistence?.storageNamespace || "catalog-filters";
    const customKey = root.dataset.catalogStorageKey?.trim();

    if (customKey) {
      return `${namespace}:${customKey}`;
    }

    const fallbackKey = categories.length ? categories.join("|") : "default";

    return `${namespace}:${fallbackKey}`;
  };

  // Загружает выбранные теги из localStorage

  const loadSelectedTagsFromStorage = (storageKey) => {
    if (!CATALOG_CONFIG.persistence?.enabled) return [];

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  };

  // Сохраняет выбранные теги в localStorage

  const saveSelectedTagsToStorage = (storageKey, tagsSet) => {
    if (!CATALOG_CONFIG.persistence?.enabled) return;

    try {
      const tags = [...tagsSet];
      localStorage.setItem(storageKey, JSON.stringify(tags));
    } catch (error) {
      // молча игнорируем, чтобы не ломать каталог
    }
  };

  // Удаляет сохранённые теги из localStorage

  const clearSelectedTagsFromStorage = (storageKey) => {
    if (!CATALOG_CONFIG.persistence?.enabled) return;

    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      // молча игнорируем
    }
  };

  // 9. Static-режим
  // Читает данные одного статичного товара из DOM-карточки

  const parseStaticProductCard = (card, category) => {
    return {
      category: category || "",
      title: card.dataset.productTitle?.trim() || "",
      price: card.dataset.productPrice?.trim() || "",
      weight: card.dataset.productWeight?.trim() || "",
      tags: card.dataset.productTags?.trim() || "",
      display: isDisplayEnabled(card.dataset.productDisplay ?? true),
      html: card.outerHTML,
    };
  };

  // Собирает все товары из статичной HTML-разметки

  const getProductsFromStaticMarkup = (sections) => {
    return sections.flatMap((section) => {
      const category = section.dataset.catalogCategory?.trim() || "";
      const list = section.querySelector("[data-catalog-list]");

      if (!category || !list) return [];

      return [...list.querySelectorAll("[data-catalog-card]")].map((card) => parseStaticProductCard(card, category)).filter((product) => hasValue(product.title) && product.display);
    });
  };

  // Собирает HTML карточки товара

  const createCard = (product) => {
    const titleHtml = hasValue(product.title) ? `<h3 class="catalog-card__title">${escapeHtml(product.title)}</h3>` : "";

    const descriptionHtml = hasValue(product.description) ? `<div class="catalog-card__description">${escapeHtml(product.description)}</div>` : "";

    const metaItems = [
      hasValue(product.pack)
        ? `
        <div class="catalog-card__meta-item">
          <span class="catalog-card__meta-label">Тара:</span>
          <span class="catalog-card__meta-value">${escapeHtml(product.pack)}</span>
        </div>
      `
        : "",
      hasValue(product.weight)
        ? `
        <div class="catalog-card__meta-item">
          <span class="catalog-card__meta-label">Вес:</span>
          <span class="catalog-card__meta-value">${escapeHtml(product.weight)}</span>
        </div>
      `
        : "",
    ].filter(Boolean);

    const metaHtml = metaItems.length ? `<div class="catalog-card__meta">${metaItems.join("")}</div>` : "";

    const normalizedTags = normalizeTags(product.tags);

    const tagsHtml = normalizedTags.length
      ? `
      <div class="catalog-card__tags">
        ${normalizedTags.map((tag) => `<span class="catalog-card__tag">${escapeHtml(tag)}</span>`).join("")}
      </div>
    `
      : "";

    const priceHtml = `
  <div class="catalog-card__price ${!hasValue(product.price) ? "is-request" : ""}">
   Цена: <span>${getPriceLabel(product.price)}</span>
  </div>
`;
    const btnHtml = `
  <div class="mt-30">
  <p class="mb-20 mt-50"><b>Оптовик?</b> Подберём ассортимент под вашу задачу</P>
        <button
        class="btn btn--primary btn--full"
        type="button"
        data-modal-target="modalForm"
        data-to-modal-title="Подобрать ассортимент"
        data-to-modal-subtitle="Оставьте ваш номер телефона, и мы свяжемся с вами в самое ближайшее время. Ожидайте звонка от «AgloBell»"
        data-to-input-form-name="Подобрать ассортимент"
      >
        <span>Подобрать ассортимент</span>
      </button>
    </div>
`;
    const buttonHtml = hasValue(product.title)
      ? `
      <button
        class="btn btn--accent btn--icon-sm"
        type="button"
        data-modal-target="modalForm"
        data-to-modal-title="Заказать ${escapeHtml(product.title)}"
        data-to-modal-subtitle="Оставьте номер телефона, и мы свяжемся с вами в ближайшие 15 минут"
        data-to-input-form-name="Заказать обратный звонок"
        
      ${buildDataAttr("data-product-category", product.category)}
      ${buildDataAttr("data-product-weight", product.weight)}
      ${buildDataAttr("data-product-price", product.price)}
      ${buildDataAttr("data-product-pack", product.pack)}
      ></button>      
    `
      : "";

    const footerHtml =
      priceHtml || buttonHtml
        ? `
      <div class="catalog-card__footer">
         
         <div class="catalog-card__footer-item catalog-card__footer-item--price">

            ${priceHtml}
          
            
            <div class="catalog-card__socials">
                ${buttonHtml}
                <a href="https://max.ru/u/f9LHodD0cOJ6-p3wZJvGnTS7ATeYyMdtMWBfJwbPOOhYxO4jacZkOUpVoLE" class="social-link" target="_blank">
                    <img src="./img/icons/max-m.svg" alt="Max">
                </a>
                <a href="https://t.me/aglobelld" class="social-link" target="_blank">
                    <img src="./img/icons/telegram.svg" alt="TG">
                </a>
            </div>
        </div>
        
        <div class="catalog-card__footer-item">
            ${btnHtml}
        </div>

      </div>
    `
        : "";

    const imageHtml = buildProductImage(product);

    return `
    <article class="catalog-card"${hasValue(product.id) ? ` data-product-id="${escapeHtml(product.id)}"` : ""}>
      ${imageHtml}
      <div class="catalog-card__body">
        ${titleHtml}
        ${descriptionHtml}
        ${metaHtml}
        ${tagsHtml}
        ${footerHtml}
      </div>
    </article>
  `;
  };

  // Находит или создаёт контейнер для чипов

  const ensureChipsContainer = (root) => {
    const existing = root.querySelector("[data-catalog-chips]");
    if (existing) return existing;

    const chips = document.createElement("div");
    chips.className = "catalog__chips";
    chips.setAttribute("data-catalog-chips", "");

    const sidebar = root.querySelector("[data-catalog-sidebar]");
    const chipsTitle = root.querySelector("[data-catalog-chips-title]");

    if (chipsTitle && chipsTitle.parentNode) {
      chipsTitle.insertAdjacentElement("afterend", chips);
      return chips;
    }

    if (sidebar) {
      sidebar.prepend(chips);
      return chips;
    }

    root.prepend(chips);
    return chips;
  };

  // Находит или создаёт контейнер для блока сортировки

  const ensureSortContainer = (root) => {
    const existing = root.querySelector("[data-catalog-sort-box]");
    if (existing) return existing;

    const sortBox = document.createElement("div");
    sortBox.className = "catalog__sort";
    sortBox.setAttribute("data-catalog-sort-box", "");

    const sidebar = root.querySelector("[data-catalog-sidebar]");
    const chipsTitle = root.querySelector("[data-catalog-chips-title]");
    const chips = root.querySelector("[data-catalog-chips]");

    if (chipsTitle && chipsTitle.parentNode) {
      chipsTitle.parentNode.insertBefore(sortBox, chipsTitle);
      return sortBox;
    }

    if (chips && chips.parentNode) {
      chips.parentNode.insertBefore(sortBox, chips);
      return sortBox;
    }

    if (sidebar) {
      sidebar.prepend(sortBox);
      return sortBox;
    }

    root.prepend(sortBox);
    return sortBox;
  };

  // Инициализирует один каталог внутри текущего root

  const initCatalogRoot = (root) => {
    if (!root) return;

    const sections = [...root.querySelectorAll("[data-catalog-category]")];
    if (!sections.length) return;

    const categoriesFromDom = sections.map((section) => section.dataset.catalogCategory?.trim()).filter(Boolean);

    if (!categoriesFromDom.length) return;

    const storageKey = getCatalogStorageKey(root, categoriesFromDom);
    const sourceMode = getCatalogSourceMode();

    let products = [];

    if (sourceMode === "data") {
      const catalog = getCatalog();
      if (!catalog.length) return;

      products = catalog.filter((item) => {
        return hasValue(item?.category) && hasValue(item?.title) && isDisplayEnabled(item?.display);
      });
    }

    if (sourceMode === "static") {
      products = getProductsFromStaticMarkup(sections);
    }

    if (!products.length) return;

    const relevantProducts = products.filter((product) => categoriesFromDom.includes(String(product.category).trim()));

    const chipsContainer = ensureChipsContainer(root);
    const sortContainer = ensureSortContainer(root);

    const filterMode = String(CATALOG_CONFIG.filterMode || root.dataset.catalogFilterMode || "or").toLowerCase();

    const emptyText = root.dataset.catalogEmptyText || "Нет товаров";

    const availableTags = new Set(relevantProducts.flatMap((product) => normalizeTags(product.tags)));

    const state = {
      selectedTags: new Set(loadSelectedTagsFromStorage(storageKey).filter((tag) => availableTags.has(tag))),
      sortValue: getInitialSortValue(),
      sortOpen: false,
    };

    // Прокручивает страницу к началу текущего каталога

    const scrollToCatalogTop = () => {
      //   const top = root.getBoundingClientRect().top + window.scrollY + 30;
      if (!CATALOG_CONFIG.ui?.scrollToTopOnChipClick) return;

      const offset = Number(CATALOG_CONFIG.ui?.scrollOffset) || 0;
      const top = root.getBoundingClientRect().top + window.scrollY + offset;

      window.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth",
      });
    };

    // Фильтрует товары по выбранным чипам

    const getFilteredProducts = (items) => {
      const selected = [...state.selectedTags];

      if (!selected.length) {
        return items;
      }

      return items.filter((product) => {
        const tags = normalizeTags(product.tags);
        if (!tags.length) return false;

        if (filterMode === "or") {
          return selected.some((tag) => tags.includes(tag));
        }

        return selected.every((tag) => tags.includes(tag));
      });
    };

    // Рендерит чипы тегов и состояние их выбора

    const renderChips = () => {
      const uniqueTags = [...new Set(relevantProducts.flatMap((product) => normalizeTags(product.tags)))].sort((a, b) => a.localeCompare(b, "ru"));

      const chipsTitle = root.querySelector("[data-catalog-chips-title]");

      if (!uniqueTags.length) {
        chipsContainer.innerHTML = "";

        if (chipsTitle) {
          chipsTitle.hidden = true;
        }

        return;
      }

      if (chipsTitle) {
        chipsTitle.hidden = false;
      }

      chipsContainer.innerHTML = `
    <button
      class="catalog-chip catalog-chip--all ${state.selectedTags.size === 0 ? "is-active" : ""}"
      type="button"
      data-catalog-chip="__all__"
    >
      Вся продукция
    </button>

    ${uniqueTags
      .map(
        (tag) => `
          <button
            class="catalog-chip ${state.selectedTags.has(tag) ? "is-active" : ""}"
            type="button"
            data-catalog-chip="${escapeHtml(tag)}"
          >
            ${escapeHtml(tag)}
          </button>
        `
      )
      .join("")}
  `;
    };

    // Рендерит блок сортировки и активный вариант

    const renderSort = () => {
      if (!sortContainer) return;

      const enabledSortOptions = getEnabledSortOptions();

      if (!CATALOG_CONFIG.sorting.enabled || enabledSortOptions.length <= 1) {
        sortContainer.innerHTML = "";
        sortContainer.hidden = true;
        return;
      }

      sortContainer.hidden = false;

      const currentOption = enabledSortOptions.find(([value]) => value === state.sortValue) || enabledSortOptions[0];

      const currentLabel = currentOption?.[1]?.label || "Сортировка";

      sortContainer.innerHTML = `
    <div class="catalog-sort ${state.sortOpen ? "is-open" : ""}" data-catalog-sort>
      <button
        class="catalog-sort__toggle"
        type="button"
        data-catalog-sort-toggle
        aria-expanded="${state.sortOpen ? "true" : "false"}"
      >
        <span class="catalog-sort__toggle-label">Сортировка</span>
        <span class="catalog-sort__toggle-value">${escapeHtml(currentLabel)}</span>
        <span class="catalog-sort__toggle-icon"></span>
      </button>

      <div
        class="catalog-sort__dropdown"
        data-catalog-sort-dropdown
        ${state.sortOpen ? "" : "hidden"}
      >
        ${enabledSortOptions
          .map(
            ([value, option]) => `
          <button
            class="catalog-sort__option ${state.sortValue === value ? "is-active" : ""}"
            type="button"
            data-catalog-sort-option="${escapeHtml(value)}"
          >
            ${escapeHtml(option.label)}
          </button>
        `
          )
          .join("")}
      </div>
    </div>
  `;
    };

    // Рендерит секции каталога и карточки внутри категорий

    const renderSections = () => {
      sections.forEach((section) => {
        const category = section.dataset.catalogCategory?.trim();
        if (!category) return;

        const list = section.querySelector("[data-catalog-list]");
        if (!list) return;

        const categoryProducts = relevantProducts.filter((product) => String(product.category).trim() === category);

        const filteredProducts = getFilteredProducts(categoryProducts);
        const sortedProducts = sortProducts(filteredProducts, state.sortValue);

        if (sortedProducts.length) {
          if (sourceMode === "data") {
            list.innerHTML = sortedProducts.map(createCard).join("");
          }

          if (sourceMode === "static") {
            list.innerHTML = sortedProducts.map((product) => product.html).join("");
          }

          section.hidden = false;
          return;
        }

        if (state.selectedTags.size > 0) {
          list.innerHTML = "";
          section.hidden = true;
          return;
        }

        list.innerHTML = `<div class="catalog__empty">${escapeHtml(emptyText)}</div>`;
        section.hidden = false;
      });
    };

    // Перерисовывает весь каталог

    const render = () => {
      renderChips();
      renderSort();
      renderSections();
    };

    root.addEventListener("click", (event) => {
      const sortToggle = event.target.closest("[data-catalog-sort-toggle]");
      if (sortToggle && root.contains(sortToggle)) {
        event.preventDefault();
        event.stopPropagation();

        state.sortOpen = !state.sortOpen;
        renderSort();
        return;
      }

      const sortOption = event.target.closest("[data-catalog-sort-option]");
      if (sortOption && root.contains(sortOption)) {
        event.preventDefault();
        event.stopPropagation();

        const value = sortOption.dataset.catalogSortOption;
        if (!value) return;

        state.sortValue = value;
        state.sortOpen = false;
        render();
        return;
      }

      const chip = event.target.closest("[data-catalog-chip]");
      if (!chip || !root.contains(chip)) return;

      const tag = chip.dataset.catalogChip;
      if (!tag) return;

      if (tag === "__all__") {
        state.selectedTags.clear();
        clearSelectedTagsFromStorage(storageKey);
      } else if (state.selectedTags.has(tag)) {
        state.selectedTags.delete(tag);

        if (state.selectedTags.size) {
          saveSelectedTagsToStorage(storageKey, state.selectedTags);
        } else {
          clearSelectedTagsFromStorage(storageKey);
        }
      } else {
        state.selectedTags.add(tag);
        saveSelectedTagsToStorage(storageKey, state.selectedTags);
      }

      render();

      requestAnimationFrame(() => {
        scrollToCatalogTop();
      });
    });

    document.addEventListener("click", (event) => {
      if (!state.sortOpen) return;

      const sortBlock = root.querySelector("[data-catalog-sort]");
      if (!sortBlock) return;

      if (sortBlock.contains(event.target)) return;

      state.sortOpen = false;
      renderSort();
    });

    render();
  };

  // Инициализирует все каталоги на странице

  const initCatalogFromAppData = (scope = document) => {
    const roots = scope.querySelectorAll("[data-catalog-root]");
    if (!roots.length) return;

    roots.forEach((root) => initCatalogRoot(root));
  };

  window.initCatalogFromAppData = initCatalogFromAppData;

  // Инициализация каталога из общего init-файла
  window.CatalogModule = {
    init() {
      initCatalogFromAppData();
    },
  };
})();
