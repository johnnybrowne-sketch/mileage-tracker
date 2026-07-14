(() => {
  function isAdminPage() {
    return window.location.pathname.startsWith("/admin");
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function isVisible(element) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();

    return rect.width > 0 && rect.height > 0;
  }

  function getStickyOffset() {
    const header = document.querySelector("header");
    const headerHeight = header ? header.getBoundingClientRect().height : 0;

    return Math.max(headerHeight + 12, 72);
  }

  function scrollToElement(element) {
    if (!element) return;

    const y =
      element.getBoundingClientRect().top +
      window.pageYOffset -
      getStickyOffset();

    window.scrollTo({
      top: Math.max(y, 0),
      behavior: "smooth",
    });
  }

  /* ADMIN EDIT AUTO-SCROLL */

  function looksLikeEditButton(element) {
    if (!element) return false;

    const text = normalizeText(element.textContent);
    const aria = normalizeText(element.getAttribute("aria-label"));
    const title = normalizeText(element.getAttribute("title"));

    return text === "edit" || aria === "edit" || title === "edit";
  }

  function findAdminMileageEditForm() {
    const forms = Array.from(document.querySelectorAll("form"));

    const mileageForms = forms.filter((form) => {
      const text = normalizeText(form.textContent);

      return (
        text.includes("vehicle") &&
        text.includes("property") &&
        text.includes("purpose") &&
        (
          text.includes("odometer") ||
          text.includes("miles") ||
          text.includes("worker")
        )
      );
    });

    const editForm =
      mileageForms.find((form) => {
        const text = normalizeText(form.textContent);

        return (
          text.includes("update") ||
          text.includes("save changes") ||
          text.includes("cancel") ||
          text.includes("editing") ||
          text.includes("edit")
        );
      }) || mileageForms[0];

    return editForm || null;
  }

  function findActualEditableField(form) {
    if (!form) return null;

    const fields = Array.from(
      form.querySelectorAll("input, select, textarea")
    ).filter((field) => {
      const type = normalizeText(field.getAttribute("type"));

      if (type === "hidden") return false;
      if (field.disabled) return false;
      if (!isVisible(field)) return false;

      return true;
    });

    if (!fields.length) return form;

    const firstField = fields[0];
    const id = firstField.getAttribute("id");

    if (id && window.CSS && CSS.escape) {
      const label = form.querySelector('label[for="' + CSS.escape(id) + '"]');

      if (label && isVisible(label)) {
        return label;
      }
    }

    const parentLabel = firstField.closest("label");

    if (parentLabel && isVisible(parentLabel)) {
      return parentLabel;
    }

    return firstField;
  }

  function scrollToAdminEditForm() {
    const form = findAdminMileageEditForm();
    const target = findActualEditableField(form);

    if (!target) return;

    scrollToElement(target);
  }

  /* ADMIN MESSAGE AUTO-SCROLL */

  function isAdminMessagesView() {
    const pageText = normalizeText(document.body.textContent);

    return (
      pageText.includes("worker conversations") ||
      pageText.includes("select a worker") ||
      pageText.includes("live chat") ||
      pageText.includes("message")
    );
  }

  function isLikelyWorkerConversationClick(target) {
    if (!target) return false;

    if (
      target.closest(
        "input, textarea, select, form, header, aside, .prosper-mobile-menu-drawer, .prosper-mobile-menu-button"
      )
    ) {
      return false;
    }

    const clickable = target.closest("button, a, div");

    if (!clickable) return false;

    const text = normalizeText(clickable.textContent);

    if (!text) return false;

    const blockedWords = [
      "overview",
      "mileage review",
      "admin add entry",
      "workers",
      "paper sheets",
      "reports",
      "settings",
      "logout",
      "download",
      "month",
      "vehicle",
      "status"
    ];

    if (blockedWords.some((word) => text === word || text.startsWith(word + " "))) {
      return false;
    }

    const hasEmail = text.includes("@");
    const hasConversationHint =
      text.includes("messages") ||
      text.includes("no messages yet") ||
      text.includes("start the conversation") ||
      text.includes("hi ") ||
      text.includes("hey") ||
      text.includes("message");

    return hasEmail || hasConversationHint;
  }

  function findAdminMessageComposer() {
    const fields = Array.from(document.querySelectorAll("textarea, input")).filter((field) => {
      if (!isVisible(field)) return false;
      if (field.disabled) return false;

      const placeholder = normalizeText(field.getAttribute("placeholder"));
      const aria = normalizeText(field.getAttribute("aria-label"));
      const name = normalizeText(field.getAttribute("name"));

      return (
        placeholder.includes("message") ||
        placeholder.includes("reply") ||
        aria.includes("message") ||
        aria.includes("reply") ||
        name.includes("message")
      );
    });

    if (fields.length) {
      return fields[fields.length - 1];
    }

    const sendButtons = Array.from(document.querySelectorAll("button")).filter((button) => {
      const text = normalizeText(button.textContent);
      const aria = normalizeText(button.getAttribute("aria-label"));

      return text.includes("send") || aria.includes("send");
    });

    if (sendButtons.length) {
      return sendButtons[sendButtons.length - 1];
    }

    return null;
  }

  function scrollToAdminMessageComposer() {
    const composer = findAdminMessageComposer();

    if (!composer) return;

    const target =
      composer.closest("form") ||
      composer.closest("[class*='rounded']") ||
      composer;

    scrollToElement(target);

    window.setTimeout(() => {
      if (window.innerWidth <= 1023 && composer.focus) {
        composer.focus({ preventScroll: true });
      }
    }, 450);
  }

  /* MAIN CLICK HANDLER */

  function handleClick(event) {
    if (!isAdminPage()) return;

    const clickable = event.target.closest("button, a");

    if (looksLikeEditButton(clickable)) {
      window.setTimeout(scrollToAdminEditForm, 180);
      window.setTimeout(scrollToAdminEditForm, 450);
      window.setTimeout(scrollToAdminEditForm, 800);
      return;
    }

    if (isAdminMessagesView() && isLikelyWorkerConversationClick(event.target)) {
      window.setTimeout(scrollToAdminMessageComposer, 220);
      window.setTimeout(scrollToAdminMessageComposer, 550);
      window.setTimeout(scrollToAdminMessageComposer, 900);
    }
  }

  document.addEventListener("click", handleClick, true);
})();
