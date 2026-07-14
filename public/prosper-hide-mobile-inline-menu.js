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

  function shouldIgnore(element) {
    return Boolean(
      element.closest(
        ".prosper-mobile-menu-drawer, .prosper-mobile-menu-overlay, .prosper-mobile-menu-button, header, form"
      )
    );
  }

  function getFeatureScore(text) {
    const features = [
      "overview",
      "new mileage entry",
      "mileage history",
      "upload paper sheet",
      "messages",
      "help",
      "mileage review",
      "admin add entry",
      "workers",
      "paper sheets",
      "reports",
      "settings"
    ];

    return features.reduce((score, feature) => {
      return text.includes(feature) ? score + 1 : score;
    }, 0);
  }

  function findBestInlineMenuContainer() {
    const candidates = Array.from(document.querySelectorAll("nav, aside, section, article, div"))
      .filter((element) => {
        if (shouldIgnore(element)) return false;

        const text = normalizeText(element.textContent);

        if (!text) return false;

        const score = getFeatureScore(text);

        if (score < 4) return false;

        const hasWelcome = text.includes("welcome");
        const hasDashboard = text.includes("dashboard");
        const hasReportTable = text.includes("date") && text.includes("vehicle") && text.includes("property");
        const hasMessageThread = text.includes("type your message") || text.includes("worker conversations");

        if (hasWelcome || hasDashboard || hasReportTable || hasMessageThread) {
          return false;
        }

        const buttons = element.querySelectorAll("button, a");
        return buttons.length >= 4;
      })
      .map((element) => {
        const text = normalizeText(element.textContent);
        const score = getFeatureScore(text);
        const rect = element.getBoundingClientRect();

        return {
          element,
          score,
          area: rect.width * rect.height,
          top: rect.top
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.area - b.area;
      });

    if (!candidates.length) return null;

    let target = candidates[0].element;

    /*
      If the direct candidate is only the nav itself, hide the card/wrapper around it
      so the blank card also disappears.
    */
    const wrapper =
      target.closest("aside") ||
      target.closest("section") ||
      target.closest("article") ||
      target.closest("[class*='rounded']") ||
      target;

    return wrapper;
  }

  function updateInlineMenuVisibility() {
    document.querySelectorAll(".prosper-mobile-inline-menu-hidden").forEach((element) => {
      element.classList.remove("prosper-mobile-inline-menu-hidden");
    });

    if (!isMobile() || !isAppPage()) return;

    const inlineMenu = findBestInlineMenuContainer();

    if (inlineMenu) {
      inlineMenu.classList.add("prosper-mobile-inline-menu-hidden");
    }
  }

  function scheduleUpdate() {
    window.requestAnimationFrame(updateInlineMenuVisibility);
  }

  scheduleUpdate();

  const root = document.getElementById("root");

  if (root) {
    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "aria-current", "aria-selected"]
    });
  }

  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("orientationchange", scheduleUpdate);
  window.addEventListener("popstate", scheduleUpdate);
  window.addEventListener("prosper-route-change", scheduleUpdate);

  window.setInterval(scheduleUpdate, 1200);
})();
