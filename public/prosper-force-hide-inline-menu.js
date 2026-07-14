(() => {
  function isMobile() {
    return window.innerWidth <= 1023;
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

  function shouldIgnore(element) {
    return Boolean(
      element.closest(
        ".prosper-mobile-menu-drawer, .prosper-mobile-menu-overlay, .prosper-mobile-menu-button, header, form"
      )
    );
  }

  const workerItems = [
    "overview",
    "new mileage entry",
    "mileage history",
    "upload paper sheet",
    "messages",
    "help"
  ];

  const adminItems = [
    "overview",
    "mileage review",
    "admin add entry",
    "workers",
    "paper sheets",
    "reports",
    "messages",
    "settings"
  ];

  const protectedContentWords = [
    "welcome",
    "live dashboard",
    "total entries",
    "total miles",
    "recent mileage",
    "date",
    "vehicle",
    "property",
    "purpose",
    "odometer",
    "download mileage reports",
    "entries to export",
    "miles to export",
    "worker conversations",
    "chat with admin",
    "type your message",
    "send reset link",
    "sign in",
    "create account",
    "reset password",
    "upload a paper",
    "select file",
    "choose file",
    "admin support",
    "conversation"
  ];

  function countMatches(text, items) {
    return items.reduce((count, item) => {
      return text.includes(item) ? count + 1 : count;
    }, 0);
  }

  function getMenuScore(text) {
    return Math.max(countMatches(text, workerItems), countMatches(text, adminItems));
  }

  function getVisibleNavButtonLabels(element) {
    return Array.from(element.querySelectorAll("button, a"))
      .filter(isVisible)
      .map((button) => normalizeText(button.textContent))
      .filter(Boolean)
      .filter((text) => text.length <= 48)
      .filter((text) => {
        const combined = workerItems.concat(adminItems);
        return combined.some((item) => text.includes(item));
      });
  }

  function looksLikeOnlyMenu(element) {
    if (!element || shouldIgnore(element) || !isVisible(element)) return false;

    const text = normalizeText(element.textContent);
    const score = getMenuScore(text);

    if (score < 4) return false;

    const labels = getVisibleNavButtonLabels(element);

    if (labels.length < 4 || labels.length > 10) return false;

    /*
      Do not hide real feature pages.
      This was the reason the pages were becoming empty.
    */
    const hasProtectedContent = protectedContentWords.some((word) => text.includes(word));

    if (hasProtectedContent) return false;

    const hasFormOrTable =
      element.querySelector("form") ||
      element.querySelector("table") ||
      element.querySelector("input:not([type='hidden'])") ||
      element.querySelector("textarea") ||
      element.querySelector("select");

    if (hasFormOrTable) return false;

    return true;
  }

  function findInnermostMenuCandidates() {
    const all = Array.from(document.querySelectorAll("nav, section, article, div"))
      .filter(looksLikeOnlyMenu);

    /*
      Keep the inner/smaller menu candidate, not a large parent.
      The previous version kept the outer parent and sometimes hid the actual page.
    */
    return all.filter((element) => {
      return !all.some((other) => {
        return other !== element && element.contains(other);
      });
    });
  }

  function findSafeWrapper(menuElement) {
    if (!menuElement) return null;

    let target = menuElement;
    let current = menuElement.parentElement;

    const menuRect = menuElement.getBoundingClientRect();

    while (
      current &&
      current !== document.body &&
      current.id !== "root" &&
      current.tagName.toLowerCase() !== "main"
    ) {
      const text = normalizeText(current.textContent);
      const currentRect = current.getBoundingClientRect();

      const currentLooksSafe =
        getMenuScore(text) >= 4 &&
        !protectedContentWords.some((word) => text.includes(word)) &&
        !current.querySelector("form") &&
        !current.querySelector("table") &&
        !current.querySelector("input:not([type='hidden'])") &&
        !current.querySelector("textarea") &&
        !current.querySelector("select") &&
        currentRect.height <= menuRect.height + 180 &&
        currentRect.width <= window.innerWidth - 10;

      if (!currentLooksSafe) break;

      target = current;
      current = current.parentElement;
    }

    return target;
  }

  function hideInlineMenus() {
    document.querySelectorAll("[data-prosper-inline-menu-hidden='true']").forEach((element) => {
      element.removeAttribute("data-prosper-inline-menu-hidden");
    });

    if (!isMobile() || !isAppPage()) return;

    const candidates = findInnermostMenuCandidates();

    candidates.forEach((candidate) => {
      const wrapper = findSafeWrapper(candidate);

      if (wrapper) {
        wrapper.setAttribute("data-prosper-inline-menu-hidden", "true");
      }
    });
  }

  function scheduleHide() {
    window.requestAnimationFrame(hideInlineMenus);
  }

  scheduleHide();

  const root = document.getElementById("root");

  if (root) {
    const observer = new MutationObserver(scheduleHide);

    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "aria-current", "aria-selected"]
    });
  }

  window.addEventListener("resize", scheduleHide);
  window.addEventListener("orientationchange", scheduleHide);
  window.addEventListener("popstate", scheduleHide);
  window.addEventListener("prosper-route-change", scheduleHide);

  window.setInterval(scheduleHide, 1000);
})();
