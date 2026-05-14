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

  function findMileageFormTarget() {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, p, span, div"));

    const headingTarget = headings.find((element) => {
      const text = normalizeText(element.textContent);
      return (
        text === "new mileage entry" ||
        text.includes("new mileage entry") ||
        text.includes("add mileage") ||
        text.includes("mileage entry")
      );
    });

    if (headingTarget) {
      return headingTarget.closest("section, article, div") || headingTarget;
    }

    const forms = Array.from(document.querySelectorAll("form"));

    const mileageForm = forms.find((form) => {
      const text = normalizeText(form.textContent);
      return (
        text.includes("vehicle") &&
        text.includes("property") &&
        (text.includes("odometer") || text.includes("miles")) &&
        text.includes("purpose")
      );
    });

    if (mileageForm) {
      return mileageForm.closest("section, article, div") || mileageForm;
    }

    return null;
  }

  function scrollToMileageForm() {
    const target = findMileageFormTarget();

    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });

    window.setTimeout(() => {
      const firstInput = target.querySelector("input, select, textarea");

      if (firstInput && window.innerWidth <= 768) {
        firstInput.focus({ preventScroll: true });
      }
    }, 450);
  }

  function handleClick(event) {
    if (!isWorkerPage()) return;

    const clickable = event.target.closest("button, a");

    if (!looksLikeEditButton(clickable)) return;

    window.setTimeout(scrollToMileageForm, 180);
    window.setTimeout(scrollToMileageForm, 500);
  }

  document.addEventListener("click", handleClick, true);
})();
