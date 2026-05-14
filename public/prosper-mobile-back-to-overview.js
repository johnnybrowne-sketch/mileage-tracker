(() => {
  let backButton;

  function isMobile() {
    return window.innerWidth <= 768;
  }

  function isAppPage() {
    return window.location.pathname.startsWith("/worker") || window.location.pathname.startsWith("/admin");
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function ensureButton() {
    if (backButton) return;

    backButton = document.createElement("button");
    backButton.type = "button";
    backButton.className = "prosper-mobile-back-overview is-hidden";
    backButton.textContent = "← Overview";
    backButton.setAttribute("aria-label", "Back to Overview");

    backButton.addEventListener("click", () => {
      clickOverview();
    });

    document.body.appendChild(backButton);
  }

  function getCurrentFeatureText() {
    const header = document.querySelector("header");

    if (header) {
      const headerText = normalizeText(header.textContent);

      if (headerText.includes("overview")) return "overview";
      if (headerText.includes("mileage history")) return "mileage history";
      if (headerText.includes("new mileage entry")) return "new mileage entry";
      if (headerText.includes("upload paper sheet")) return "upload paper sheet";
      if (headerText.includes("messages")) return "messages";
      if (headerText.includes("help")) return "help";
      if (headerText.includes("mileage review")) return "mileage review";
      if (headerText.includes("admin add entry")) return "admin add entry";
      if (headerText.includes("workers")) return "workers";
      if (headerText.includes("paper sheets")) return "paper sheets";
      if (headerText.includes("reports")) return "reports";
      if (headerText.includes("settings")) return "settings";
    }

    const activeMenuItem = document.querySelector(".prosper-mobile-menu-item.is-active");

    if (activeMenuItem) {
      return normalizeText(activeMenuItem.textContent);
    }

    return "";
  }

  function clickOverview() {
    const menuItems = Array.from(document.querySelectorAll("aside button, aside a, .prosper-mobile-menu-item"));

    const overviewItem = menuItems.find((item) => {
      return normalizeText(item.textContent).includes("overview");
    });

    if (overviewItem) {
      overviewItem.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window
        })
      );

      if (typeof overviewItem.click === "function") {
        overviewItem.click();
      }
    }

    window.setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }, 180);
  }

  function updateButton() {
    ensureButton();

    const featureText = getCurrentFeatureText();

    const shouldShow =
      isMobile() &&
      isAppPage() &&
      featureText &&
      !featureText.includes("overview");

    backButton.classList.toggle("is-hidden", !shouldShow);
  }

  function scheduleUpdate() {
    window.requestAnimationFrame(updateButton);
  }

  ensureButton();
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

  window.setInterval(scheduleUpdate, 1000);
})();
