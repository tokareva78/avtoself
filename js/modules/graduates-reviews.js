window.GraduatesReviewsModule = {
  config: {
    dataUrl: "files/data/graduates.json",
    graduatesRowsPerClick: 2,
    reviewsPerClick: 3,
    graduatesMoreText: "Загрузить ещё",
    graduatesEndText: "…и ещё более 80 выпускников",
    reviewsMoreText: "Другие отзывы",
    reviewsEndText: "Присоединяйтесь к обучению в Автоселф",
  },

  async init() {
    const graduatesSection = document.querySelector(".graduates");
    const graduatesList = document.querySelector("[data-graduates-list]");

    const reviewsSection = document.querySelector(".reviews");
    const reviewsList = document.querySelector("[data-reviews-list]");

    if (!graduatesList && !reviewsList) return;

    if (graduatesSection && graduatesSection.dataset.graduatesInit === "true") return;
    if (reviewsSection && reviewsSection.dataset.reviewsInit === "true") return;

    if (graduatesSection) graduatesSection.dataset.graduatesInit = "true";
    if (reviewsSection) reviewsSection.dataset.reviewsInit = "true";

    let graduates = [];
    let reviews = [];

    let shownGraduatesCount = 0;
    let shownReviewsCount = 0;

    let graduatesMoreButton = null;
    let graduatesNote = null;

    let reviewsMoreButton = null;
    let reviewsNote = null;

    const escapeHtml = (value) => {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    };

    const getGridColumnsCount = (grid) => {
      if (!grid) return 1;

      const columns = window.getComputedStyle(grid).gridTemplateColumns;
      if (!columns || columns === "none") return 1;

      return columns.split(" ").filter(Boolean).length || 1;
    };

    const getGraduatesPortionSize = () => {
      return getGridColumnsCount(graduatesList) * this.config.graduatesRowsPerClick;
    };

    const revealCards = (cards) => {
      cards.forEach((card, index) => {
        window.setTimeout(() => {
          card.classList.add("is-visible");
        }, index * 45);
      });
    };

    const createBottom = ({ className, buttonClass, noteClass, buttonText, noteText }) => {
      const bottom = document.createElement("div");
      bottom.className = className;

      const button = document.createElement("button");
      button.className = `${buttonClass}`;
      button.type = "button";
      button.textContent = buttonText;

      const note = document.createElement("p");
      note.className = noteClass;
      note.textContent = noteText;
      note.hidden = true;

      bottom.append(button, note);

      return { bottom, button, note };
    };

    const createGraduateCard = (graduate) => {
      const card = document.createElement("article");
      card.className = "graduates__card";

      const initials = escapeHtml(graduate.initials);
      const name = escapeHtml(graduate.name);
      const city = escapeHtml(graduate.city);
      const photoSrc = String(graduate.photo || "").trim();

      const photo = photoSrc ? `<img src="${escapeHtml(photoSrc)}" alt="${name}" loading="lazy">` : `<span>${initials}</span>`;

      card.innerHTML = `
        <div class="graduates__photo">${photo}</div>
        <h3 class="graduates__name">${name}</h3>
        <p class="graduates__city">${city}</p>
      `;

      return card;
    };

    const createReviewCard = (graduate) => {
      const card = document.createElement("article");
      card.className = "reviews__card";

      const initials = escapeHtml(graduate.initials);
      const name = escapeHtml(graduate.name);
      const city = escapeHtml(graduate.city);
      const review = escapeHtml(graduate.review);
      const photoSrc = String(graduate.photo || "").trim();

      const avatar = photoSrc ? `<img src="${escapeHtml(photoSrc)}" alt="${name}" loading="lazy">` : initials;

      card.innerHTML = `
        <span class="reviews__quote" aria-hidden="true"></span>
        <div class="reviews__text">${review}</div>
        <div class="reviews__author">
          <div class="reviews__avatar">${avatar}</div>
          <div class="reviews__author-info">
            <p class="reviews__name">${name}</p>
            <p class="reviews__city">${city}</p>
          </div>
        </div>
      `;

      return card;
    };

    const updateGraduatesBottom = () => {
      if (!graduatesMoreButton || !graduatesNote) return;

      const isAllShown = shownGraduatesCount >= graduates.length;
      graduatesMoreButton.hidden = isAllShown;
      graduatesNote.hidden = !isAllShown;
    };

    const updateReviewsBottom = () => {
      if (!reviewsMoreButton || !reviewsNote) return;

      const isAllShown = shownReviewsCount >= reviews.length;
      reviewsMoreButton.hidden = isAllShown;
      reviewsNote.hidden = !isAllShown;
    };

    const renderNextGraduates = () => {
      if (!graduatesList) return;

      const portionSize = getGraduatesPortionSize();
      const nextGraduates = graduates.slice(shownGraduatesCount, shownGraduatesCount + portionSize);

      if (!nextGraduates.length) {
        updateGraduatesBottom();
        return;
      }

      const cards = nextGraduates.map(createGraduateCard);

      cards.forEach((card) => graduatesList.append(card));

      shownGraduatesCount += cards.length;

      revealCards(cards);
      updateGraduatesBottom();
    };

    const renderNextReviews = () => {
      if (!reviewsList) return;

      const nextReviews = reviews.slice(shownReviewsCount, shownReviewsCount + this.config.reviewsPerClick);

      if (!nextReviews.length) {
        updateReviewsBottom();
        return;
      }

      const cards = nextReviews.map(createReviewCard);

      cards.forEach((card) => reviewsList.append(card));

      shownReviewsCount += cards.length;

      revealCards(cards);
      updateReviewsBottom();
    };

    try {
      const response = await fetch(this.config.dataUrl);

      if (!response.ok) {
        throw new Error("Не удалось загрузить graduates.json");
      }

      const data = await response.json();

      graduates = Array.isArray(data) ? data : [];
      reviews = graduates.filter((graduate) => graduate.review && String(graduate.review).trim());

      if (graduatesList) {
        graduatesList.innerHTML = "";
      }

      if (reviewsList) {
        reviewsList.innerHTML = "";
      }

      if (graduatesList && graduates.length) {
        const controls = createBottom({
          className: "graduates__actions btn-actions btn-actions--460",
          buttonClass: "ui-btn ui-btn--light",
          noteClass: "graduates__note",
          buttonText: this.config.graduatesMoreText,
          noteText: this.config.graduatesEndText,
        });

        graduatesMoreButton = controls.button;
        graduatesNote = controls.note;

        graduatesList.after(controls.bottom);
        graduatesMoreButton.addEventListener("click", renderNextGraduates);
        renderNextGraduates();
      } else if (graduatesSection) {
        graduatesSection.classList.add("is-empty");
      }

      if (reviewsList && reviews.length) {
        const controls = createBottom({
          className: "reviews__actions btn-actions btn-actions--460",
          buttonClass: "ui-btn ui-btn--light",
          noteClass: "reviews__note",
          buttonText: this.config.reviewsMoreText,
          noteText: this.config.reviewsEndText,
        });

        reviewsMoreButton = controls.button;
        reviewsNote = controls.note;

        reviewsList.after(controls.bottom);
        reviewsMoreButton.addEventListener("click", renderNextReviews);
        renderNextReviews();
      } else if (reviewsSection) {
        reviewsSection.classList.add("is-empty");
      }
    } catch (error) {
      console.warn(error);

      if (graduatesSection) {
        graduatesSection.classList.add("is-empty");
      }

      if (reviewsSection) {
        reviewsSection.classList.add("is-empty");
      }
    }
  },
};
