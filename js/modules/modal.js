window.ModalModule = (function() {
  let activeModal = null;

  function lockBodyScroll() {
    document.body.classList.add("modal-open");
    document.body.style.overflow = "hidden";
  }

  function unlockBodyScroll() {
    document.body.classList.remove("modal-open");
    document.body.style.overflow = "";
  }

  function getModalById(modalId) {
    if (!modalId) return null;
    return document.getElementById(modalId);
  }

  function getModalBody(modal) {
    if (!modal) return null;
    return modal.querySelector("[data-modal-body-content]");
  }

  function setTextContent(modal, key, value) {
    if (!modal || typeof value === "undefined") return;

    const target = modal.querySelector(`[data-modal-${key}]`);
    if (target) {
      target.textContent = value;
    }
  }

  function setHtmlContent(modal, key, value) {
    if (!modal || typeof value === "undefined") return;

    const target = modal.querySelector(`[data-modal-html-${key}]`);
    if (target) {
      target.innerHTML = value;
    }
  }

  function setInputValue(modal, inputName, value) {
    if (!modal || typeof value === "undefined") return;

    const input = modal.querySelector(`[name="${inputName}"]`);
    if (input) {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function clearModal(modal) {
    if (!modal) return;

    const clearFields = modal.querySelectorAll("[data-modal-clear]");
    clearFields.forEach((el) => {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
        el.value = "";
      } else {
        el.textContent = "";
      }
    });

    const clearHtmlFields = modal.querySelectorAll("[data-modal-clear-html]");
    clearHtmlFields.forEach((el) => {
      el.innerHTML = "";
    });
  }

  function applyButtonData(modal, trigger) {
    if (!modal || !trigger) return;

    Array.from(trigger.attributes).forEach((attr) => {
      const name = attr.name;
      const value = attr.value;

      if (name.startsWith("data-to-modal-")) {
        const key = name.replace("data-to-modal-", "");
        setTextContent(modal, key, value);
      }

      if (name.startsWith("data-to-html-")) {
        const key = name.replace("data-to-html-", "");
        setHtmlContent(modal, key, value);
      }

      if (name.startsWith("data-to-input-")) {
        const inputName = name.replace("data-to-input-", "");
        setInputValue(modal, inputName, value);
      }
    });
  }

  function open(modalId, options = {}) {
    const modal = getModalById(modalId);
    if (!modal) return;

    if (activeModal && activeModal !== modal) {
      close(activeModal.id, true);
    }

    if (options.clearBeforeOpen) {
      clearModal(modal);
    }

    if (options.text) {
      Object.keys(options.text).forEach((key) => {
        setTextContent(modal, key, options.text[key]);
      });
    }

    if (options.html) {
      Object.keys(options.html).forEach((key) => {
        setHtmlContent(modal, key, options.html[key]);
      });
    }

    if (options.inputs) {
      Object.keys(options.inputs).forEach((key) => {
        setInputValue(modal, key, options.inputs[key]);
      });
    }

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");

    activeModal = modal;
    lockBodyScroll();
  }

  function close(modalId, silentClear = false) {
    const modal = modalId ? getModalById(modalId) : activeModal;
    if (!modal) return;

    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");

    unlockBodyScroll();

    if (!silentClear) {
      setTimeout(() => {
        clearModal(modal);
      }, 300);
    }

    if (activeModal === modal) {
      activeModal = null;
    }
  }

  function handleDocumentClick(e) {
    const openBtn = e.target.closest("[data-modal-target]");
    if (openBtn) {
      const modalId = openBtn.getAttribute("data-modal-target");
      if (!modalId) return;

      const modal = getModalById(modalId);
      if (!modal) return;

      open(modalId, { clearBeforeOpen: true });
      applyButtonData(modal, openBtn);
      return;
    }

    const closeBtn = e.target.closest("[data-modal-close]");
    if (closeBtn) {
      const modal = closeBtn.closest(".modal-overlay");
      if (modal) {
        close(modal.id);
      }
      return;
    }

    const overlay = e.target.closest(".modal-overlay");
    if (overlay && e.target === overlay) {
      close(overlay.id);
    }
  }

  function handleKeydown(e) {
    if (e.key === "Escape" && activeModal) {
      close(activeModal.id);
    }
  }

  function init() {
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleKeydown);
  }

  return {
    init,
    open,
    close,
    clearModal,
    setInputValue,
    setTextContent,
    setHtmlContent,
    getModalBody,
  };
})();
