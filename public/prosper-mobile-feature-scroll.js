(() => {
  function isMobile() {
    return window.innerWidth <= 768;
  }

  function isAppPage() {
    return window.location.pathname.startsWith("/worker") || window.location.pathname.startsWith("/admin");
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
    if (!element) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const y =
      element.getBoundingClientRect().top +
      window.pageYOffset -
      getStickyOffset();

    window.scrollTo({
      top: Math.max(y, 0),
      behavior: "smooth",
    });
  }

  function getClickedFeatureLabel(event) {
    const menuItem = event.target.closest(".prosper-mobile-menu-item");

    if (menuItem) {
      const textSpan = menuItem.querySelector("span:last-child");
      return textSpan ? textSpan.textContent : menuItem.textContent;
    }

    const clickable = event.target.closest("button, a, [role='button'], div");

    if (!clickable) return "";

    const text = String(clickable.textContent || "").replace(/\s+/g, " ").trim();

    if (!text || text.length > 120) return "";

    return text;
  }

  function isFeatureNavigationLabel(label) {
    const text = normalizeText(label);

    if (!text) return false;

    const featureWords = [
      "overview",
      "new mileage entry",
      "add mileage",
      "admin add entry",
      "mileage history",
      "mileage review",
      "upload paper sheet",
      "upload sheet",
      "paper sheets",
      "messages",
      "message admin",
      "workers",
      "reports",
      "settings",
      "help"
    ];

    return featureWords.some((word) => text.includes(word));
  }

  function findHeadingByText(words) {
    const main = document.querySelector("main") || document.body;

    const headings = Array.from(
      main.querySelectorAll("h1, h2, h3, h4, [class*='text-3xl'], [class*='text-2xl'], [class*='text-xl']")
    ).filter(isVisible);

    return headings.find((element) => {
      const text = normalizeText(element.textContent);
      return words.some((word) => text.includes(word));
    });
  }

  function findCardFromElement(element) {
    if (!element) return null;

    return (
      element.closest("section") ||
      element.closest("article") ||
      element.closest("[class*='rounded']") ||
      element
    );
  }

  function findMileageEntryForm() {
    const forms = Array.from(document.querySelectorAll("form")).filter(isVisible);

    return forms.find((form) => {
      const text = normalizeText(form.textContent);

      return (
        text.includes("vehicle") &&
        text.includes("property") &&
        text.includes("purpose") &&
        (text.includes("odometer") || text.includes("miles"))
      );
    });
  }

  function findUploadForm() {
    const fileInput = Array.from(document.querySelectorAll("input[type='file']")).find(isVisible);

    if (fileInput) {
      return fileInput.closest("form") || fileInput.closest("section") || fileInput;
    }

    const heading = findHeadingByText(["upload paper", "paper sheet", "paper sheets"]);
    return findCardFromElement(heading);
  }

  function findMessageArea() {
    const heading = findHeadingByText([
      "messages",
      "chat with admin",
      "worker conversations",
      "admin support"
    ]);

    if (heading) return findCardFromElement(heading);

    const messageField = Array.from(document.querySelectorAll("textarea, input")).find((field) => {
      if (!isVisible(field)) return false;

      const placeholder = normalizeText(field.getAttribute("placeholder"));
      const aria = normalizeText(field.getAttribute("aria-label"));

      return placeholder.includes("message") || aria.includes("message");
    });

    return messageField ? messageField.closest("section") || messageField.closest("form") || messageField : null;
  }

  function findFeatureTarget(label) {
    const text = normalizeText(label);

    if (text.includes("new mileage entry") || text.includes("add mileage") || text.includes("admin add entry")) {
      const form = findMileageEntryForm();
      if (form) return form;
      const heading = findHeadingByText(["new mileage entry", "add mileage", "admin add entry"]);
      return findCardFromElement(heading);
    }

    if (text.includes("mileage history")) {
      const heading = findHeadingByText(["mileage history", "history"]);
      return findCardFromElement(heading);
    }

    if (text.includes("mileage review")) {
      const heading = findHeadingByText(["mileage review", "review mileage"]);
      return findCardFromElement(heading);
    }

    if (text.includes("upload") || text.includes("paper sheet")) {
      return findUploadForm();
    }

    if (text.includes("message")) {
      return findMessageArea();
    }

    if (text.includes("workers")) {
      const heading = findHeadingByText(["workers", "worker management"]);
      return findCardFromElement(heading);
    }

    if (text.includes("reports")) {
      const heading = findHeadingByText(["reports", "download mileage reports"]);
      return findCardFromElement(heading);
    }

    if (text.includes("settings")) {
      const heading = findHeadingByText(["settings"]);
      return findCardFromElement(heading);
    }

    if (text.includes("help")) {
      const heading = findHeadingByText(["help", "mileage tracker help"]);
      return findCardFromElement(heading);
    }

    if (text.includes("overview")) {
      const heading = findHeadingByText(["overview", "welcome"]);
      return findCardFromElement(heading);
    }

    return document.querySelector("main") || document.body;
  }

  function scrollToFeature(label) {
    if (!isMobile() || !isAppPage()) return;

    const target = findFeatureTarget(label);

    scrollToElement(target || document.querySelector("main") || document.body);
  }

  function handleClick(event) {
    if (!isMobile() || !isAppPage()) return;

    const label = getClickedFeatureLabel(event);

    if (!isFeatureNavigationLabel(label)) return;

    window.setTimeout(() => scrollToFeature(label), 180);
    window.setTimeout(() => scrollToFeature(label), 450);
    window.setTimeout(() => scrollToFeature(label), 800);
  }

  document.addEventListener("click", handleClick, true);
})();
