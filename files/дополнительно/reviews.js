window.ReviewsModule = (function() {
  let section = null;
  let track = null;
  let resizeTimer = null;
  let observer = null;
  let isCloned = false;

  function initInfiniteScroll() {
    if (!track || isCloned) return;

    track.innerHTML += track.innerHTML;
    isCloned = true;
  }

  function setTrackSpeed() {
    if (!track) return;

    const originalWidth = track.scrollWidth / 2;
    const pixelsPerSecond = 30;
    const duration = originalWidth / pixelsPerSecond;

    track.style.setProperty("--reviews-duration", `${duration}s`);
  }

  function checkOverflow() {
    if (!track) return;

    const cards = track.querySelectorAll(".review-card");

    cards.forEach((card) => {
      const textContainer = card.querySelector(".review-text-container");
      const text = card.querySelector(".review-text");
      const btn = card.querySelector(".btn-more");

      if (!textContainer || !text || !btn) return;

      if (text.scrollHeight > textContainer.clientHeight) {
        btn.style.display = "block";
        card.classList.add("is-overflow");
      } else {
        btn.style.display = "none";
        card.classList.remove("is-overflow");
      }
    });
  }

  const REVIEW_MODAL_ID = "modalReviews";

  let reviewModal = null;
  let reviewModalFields = null;

  function cacheReviewModalElements() {
    reviewModal = document.getElementById(REVIEW_MODAL_ID);
    if (!reviewModal) return;

    reviewModalFields = {
      userName: reviewModal.querySelector("#modalUserName"),
      date: reviewModal.querySelector("#modalDate"),
      rating: reviewModal.querySelector("#modalRating"),
      fullText: reviewModal.querySelector("#modalFullText"),
    };
  }

  function fillReviewModal(card) {
    if (!reviewModal || !reviewModalFields || !card) return;

    const name = card.querySelector(".user-name")?.innerHTML || "";
    const date = card.querySelector(".review-date")?.innerText || "";
    const rating = card.querySelector(".rating")?.innerText || "";
    const text = card.querySelector(".review-text")?.innerHTML || "";

    if (reviewModalFields.userName) reviewModalFields.userName.innerHTML = name;
    if (reviewModalFields.date) reviewModalFields.date.innerText = date;
    if (reviewModalFields.rating) reviewModalFields.rating.innerText = rating;
    if (reviewModalFields.fullText) reviewModalFields.fullText.innerHTML = text;
  }

  function clearReviewModal() {
    if (!reviewModalFields) return;

    if (reviewModalFields.userName) reviewModalFields.userName.innerHTML = "";
    if (reviewModalFields.date) reviewModalFields.date.innerText = "";
    if (reviewModalFields.rating) reviewModalFields.rating.innerText = "";
    if (reviewModalFields.fullText) reviewModalFields.fullText.innerHTML = "";
  }

  function bindEvents() {
    document.addEventListener("click", function(e) {
      const btn = e.target.closest(".btn-more");
      if (!btn) return;

      const card = btn.closest(".review-card");
      if (!card) return;

      fillReviewModal(card);

      if (window.ModalModule) {
        window.ModalModule.open("modalReviews");
      }
    });

    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape") {
        clearReviewModal();
      }
    });

    document.addEventListener("click", function(e) {
      const closeBtn = e.target.closest("#modalReviews [data-modal-close]");
      const overlay = e.target.closest("#modalReviews.modal-overlay");

      if (closeBtn) {
        setTimeout(clearReviewModal, 300);
      }

      if (overlay && e.target === overlay) {
        setTimeout(clearReviewModal, 300);
      }
    });

    window.addEventListener("resize", function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        checkOverflow();
        setTrackSpeed();
      }, 150);
    });
  }

  function createObserver() {
    if (!section || !track || !("IntersectionObserver" in window)) return;

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            track.classList.add("animate");
          } else {
            track.classList.remove("animate");
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(section);
  }

  function init() {
    cacheReviewModalElements();
    section = document.querySelector("[data-reviews-section]");
    if (!section) return;

    track = section.querySelector("[data-reviews-track]");
    if (!track) return;

    initInfiniteScroll();
    setTrackSpeed();
    checkOverflow();
    createObserver();
    bindEvents();
  }

  return {
    init,
    checkOverflow,
    setTrackSpeed,
    fillReviewModal,
    clearReviewModal,
  };
})();
