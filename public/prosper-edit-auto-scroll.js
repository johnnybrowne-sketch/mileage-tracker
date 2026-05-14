(() => {
  function isWorkerPage() {
    return window.location.pathname.startsWith("/worker");
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function looksLikeEditButton(element) {
    if (!element) return false;

    const text = normalizeText(element.textContent);
    const aria = normalizeText(element.getAttribute("aria-label"));
    const title = normalizeText(element.getAttribute("title"));

    return text === "edit" || aria === "edit" || title === "edit";
  }

  function getStickyOffset() {
    const header = document.querySelector("header");
    const headerHeight = header ? header.getBoundingClientRect().height : 0;

    return Math.max(headerHeight + 10, 70);
  }

  function isVisible(element) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();

    return rect.width > 0 && rect.height > 0;
  }

  function findEditableMileageForm() {
    const forms = Array.from(document.querySelectorAll("form"));

    const mileageForms = forms.filter((form) => {
      const text = normalizeText(form.textContent);

      return (
        text.includes("vehicle") &&
        text.includes("property") &&
        text.includes("purpose") &&
        (text.includes("odometer") || text.includes("miles"))
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

  function scrollToActualEditForm() {
    const form = findEditableMileageForm();
    const target = findActualEditableField(form);

    if (!target) return;

    const y =
      target.getBoundingClientRect().top +
      window.pageYOffset -
      getStickyOffset();

    window.scrollTo({
      top: Math.max(y, 0),
      behavior: "smooth",
    });
  }

  function handleClick(event) {
    if (!isWorkerPage()) return;

    const clickable = event.target.closest("button, a");

    if (!looksLikeEditButton(clickable)) return;

    window.setTimeout(scrollToActualEditForm, 180);
    window.setTimeout(scrollToActualEditForm, 450);
    window.setTimeout(scrollToActualEditForm, 800);
  }

  document.addEventListener("click", handleClick, true);
})();
