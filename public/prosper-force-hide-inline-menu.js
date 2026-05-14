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

  function countMatches(text, items) {
    return items.reduce((count, item) => {
      return text.includes(item) ? count + 1 : count;
    }, 0);
  }

  function looksLikeInlineMenu(element) {
    if (!element || shouldIgnore(element)) return false;

    const text = normalizeText(element.textContent);

    if (!text) return false;

    const workerScore = countMatches(text, workerItems);
    const adminScore = countMatches(text, adminItems);

    const score = Math.max(workerScore, adminScore);

    if (score < 4) return false;

    const clickableCount = element.querySelectorAll("button, a").length;

    if (clickableCount < 4) return false;

    const badText = [
      "welcome",
      "live dashboard",
      "total entries",
      "total miles",
      "recent mileage",
      "date vehicle property",
      "download mileage reports",
      "worker conversations",
      "chat with admin",
      "type your message",
      "sign in",
      "create account",
      "reset password"
    ];

    if (badText.some((word) => text.includes(word))) {
      return false;
    }

    return true;
  }

  function findInlineMenuBlocks() {
    const all = Array.from(document.querySelectorAll("nav, section, article, div"));

    const matches = all.filter((element) => {
      if (!isVisible(element)) return false;
      return looksLikeInlineMenu(element);
    });

    /*
      Keep only the outer useful wrappers.
      If a parent and child both match, hide the parent.
    */
    return matches.filter((element) => {
      return !matches.some((other) => {
        return other !== element && other.contains(element) && looksLikeInlineMenu(other);
      });
    });
  }

  function hideInlineMenus() {
    document.querySelectorAll("[data-prosper-inline-menu-hidden='true']").forEach((element) => {
      element.removeAttribute("data-prosper-inline-menu-hidden");
    });

    if (!isMobile() || !isAppPage()) return;

    const blocks = findInlineMenuBlocks();

    blocks.forEach((block) => {
      /*
        The duplicate menu is usually a rounded card/wrapper.
        Hide the closest card-like wrapper, but never hide the body/root/main.
      */
      let target = block;

      const card =
        block.closest("[class*='rounded']") ||
        block.closest("section") ||
        block.closest("article") ||
        block;

      if (
        card &&
        card !== document.body &&
        card.id !== "root" &&
        card.tagName.toLowerCase() !== "main"
      ) {
        target = card;
      }

      target.setAttribute("data-prosper-inline-menu-hidden", "true");
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

  window.setInterval(scheduleHide, 800);
})();
