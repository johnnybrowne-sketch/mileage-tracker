(() => {
  const MOBILE_QUERY = "(max-width: 768px)";
  const mediaQuery = window.matchMedia(MOBILE_QUERY);

  let button;
  let overlay;
  let drawer;
  let list;
  let title;
  let subtitle;
  let lastSignature = "";

  function isAuthRoute() {
    const path = window.location.pathname;
    return (
      path === "/login" ||
      path === "/signup" ||
      path === "/reset-password" ||
      path.startsWith("/login/") ||
      path.startsWith("/signup/") ||
      path.startsWith("/reset-password/")
    );
  }

  function isAppRoute() {
    const path = window.location.pathname;
    return path.startsWith("/worker") || path.startsWith("/admin");
  }

  function setPageClass() {
    document.body.classList.toggle("prosper-auth-page", isAuthRoute());
    document.body.classList.toggle("prosper-app-page", isAppRoute());

    if (!isAppRoute()) {
      document.body.style.overflow = "";
    }
  }

  function patchHistory() {
    if (window.__prosperMobileHistoryPatched) return;
    window.__prosperMobileHistoryPatched = true;

    ["pushState", "replaceState"].forEach((methodName) => {
      const original = history[methodName];

      history[methodName] = function patchedHistoryMethod() {
        const result = original.apply(this, arguments);
        window.dispatchEvent(new Event("prosper-route-change"));
        return result;
      };
    });
  }

  function getLabel(element) {
    return String(element.textContent || "").replace(/\s+/g, " ").trim();
  }

  function getIcon(label) {
    const lower = label.toLowerCase();

    if (lower.includes("overview")) return "▦";
    if (lower.includes("new") || lower.includes("add")) return "+";
    if (lower.includes("history")) return "↺";
    if (lower.includes("upload") || lower.includes("paper")) return "⇧";
    if (lower.includes("message")) return "◌";
    if (lower.includes("help")) return "?";
    if (lower.includes("review")) return "✓";
    if (lower.includes("worker")) return "👥";
    if (lower.includes("report")) return "▤";
    if (lower.includes("setting")) return "⚙";
    return "•";
  }

  function findDirectChild(parent, descendant) {
    return Array.from(parent.children).find((child) => child.contains(descendant));
  }

  function classifyAuthLayout() {
    document.querySelectorAll(".prosper-mobile-auth-logo").forEach((item) => item.remove());
    document
      .querySelectorAll(".prosper-auth-layout-root, .prosper-auth-hidden-panel, .prosper-auth-form-panel, .prosper-auth-form-card")
      .forEach((item) => {
        item.classList.remove(
          "prosper-auth-layout-root",
          "prosper-auth-hidden-panel",
          "prosper-auth-form-panel",
          "prosper-auth-form-card"
        );
      });

    if (!isAuthRoute()) return;

    const form = document.querySelector("form");
    if (!form) return;

    const marketingText = "Mileage Tracking Built";
    const marketingNode = Array.from(document.querySelectorAll("section, div"))
      .filter((node) => node !== document.body && node.id !== "root")
      .filter((node) => !node.contains(form))
      .find((node) => String(node.textContent || "").includes(marketingText));

    let layoutRoot = null;
    let formPanel = null;
    let marketingPanel = null;

    if (marketingNode) {
      let current = form.parentElement;

      while (current && current !== document.body) {
        const formChild = findDirectChild(current, form);
        const marketingChild = Array.from(current.children).find(
          (child) => child !== formChild && child.contains(marketingNode)
        );

        if (formChild && marketingChild) {
          layoutRoot = current;
          formPanel = formChild;
          marketingPanel = marketingChild;
          break;
        }

        current = current.parentElement;
      }
    }

    if (!layoutRoot) {
      layoutRoot = form.closest("main") || form.closest("#root > div") || document.getElementById("root");
      formPanel = form.closest("section") || form.closest("[class*='rounded']") || form.parentElement;
    }

    if (layoutRoot) {
      layoutRoot.classList.add("prosper-auth-layout-root");
    }

    if (marketingPanel) {
      marketingPanel.classList.add("prosper-auth-hidden-panel");
    }

    if (formPanel) {
      formPanel.classList.add("prosper-auth-form-panel");
    }

    const formCard =
      form.closest("section") ||
      form.closest("[class*='rounded']") ||
      form.parentElement;

    if (!formCard) return;

    formCard.classList.add("prosper-auth-form-card");

    const originalLogo = Array.from(document.images).find((img) => {
      if (img.closest(".prosper-mobile-auth-logo")) return false;

      const value = [img.alt, img.src, img.getAttribute("title"), img.getAttribute("aria-label")]
        .join(" ")
        .toLowerCase();

      return value.includes("prosper") || value.includes("logo");
    });

    const logoWrap = document.createElement("div");
    logoWrap.className = "prosper-mobile-auth-logo";

    if (originalLogo) {
      const clone = originalLogo.cloneNode(true);
      clone.removeAttribute("class");
      clone.removeAttribute("style");
      logoWrap.appendChild(clone);
    } else {
      const fallback = document.createElement("div");
      fallback.className = "prosper-mobile-auth-logo-fallback";
      fallback.textContent = "PROSPER REAL ESTATE";
      logoWrap.appendChild(fallback);
    }

    formCard.insertBefore(logoWrap, formCard.firstChild);
  }

  function applyTableLabels() {
    document.querySelectorAll("table").forEach((table) => {
      const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
        String(th.textContent || "").replace(/\s+/g, " ").trim()
      );

      if (!headers.length) return;

      table.querySelectorAll("tbody tr").forEach((row) => {
        Array.from(row.children).forEach((cell, index) => {
          const label = headers[index] || "";
          if (label) {
            cell.setAttribute("data-label", label);
          }
        });
      });
    });
  }

  function ensureShell() {
    if (button && overlay && drawer && list) return;

    button = document.createElement("button");
    button.type = "button";
    button.className = "prosper-mobile-menu-button is-hidden";
    button.setAttribute("aria-label", "Open menu");
    button.textContent = "☰";

    overlay = document.createElement("div");
    overlay.className = "prosper-mobile-menu-overlay";

    drawer = document.createElement("div");
    drawer.className = "prosper-mobile-menu-drawer";
    drawer.setAttribute("aria-label", "Mobile app menu");

    drawer.innerHTML =
      '<div class="prosper-mobile-menu-header">' +
        '<div class="prosper-mobile-menu-title">' +
          '<strong>Menu</strong>' +
          '<span>Mileage Tracker</span>' +
        '</div>' +
        '<button type="button" class="prosper-mobile-menu-close" aria-label="Close menu">×</button>' +
      '</div>' +
      '<div class="prosper-mobile-menu-list"></div>' +
      '<div class="prosper-mobile-menu-footer">Select a feature to open it.</div>';

    title = drawer.querySelector(".prosper-mobile-menu-title strong");
    subtitle = drawer.querySelector(".prosper-mobile-menu-title span");
    list = drawer.querySelector(".prosper-mobile-menu-list");

    document.body.appendChild(button);
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    button.addEventListener("click", openMenu);
    overlay.addEventListener("click", closeMenu);
    drawer.querySelector(".prosper-mobile-menu-close").addEventListener("click", closeMenu);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  }

  function openMenu() {
    button.classList.add("is-drawer-open");
    overlay.classList.add("is-open");
    drawer.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeMenu() {
    button.classList.remove("is-drawer-open");
    overlay.classList.remove("is-open");
    drawer.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function getOriginalMenuItems() {
    const nav = document.querySelector("aside nav");

    if (!nav) return [];

    return Array.from(nav.querySelectorAll("button, a"))
      .map((element) => {
        return {
          element,
          label: getLabel(element),
        };
      })
      .filter((item) => {
        if (!item.label) return false;
        if (/logout/i.test(item.label)) return false;
        if (item.label.length > 44) return false;
        return true;
      });
  }

  function isItemActive(element) {
    const className = String(element.className || "");
    const ariaCurrent = element.getAttribute("aria-current");
    const ariaSelected = element.getAttribute("aria-selected");

    return (
      ariaCurrent === "page" ||
      ariaSelected === "true" ||
      className.includes("bg-blue") ||
      className.includes("text-white") ||
      className.includes("active")
    );
  }

  function clickOriginalMenuItem(label) {
    const normalized = String(label || "").replace(/\s+/g, " ").trim();

    const freshItems = getOriginalMenuItems();
    const freshMatch = freshItems.find((item) => item.label === normalized) || freshItems.find((item) =>
      item.label.toLowerCase().includes(normalized.toLowerCase())
    );

    if (!freshMatch) return false;

    const target = freshMatch.element;

    try {
      target.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        })
      );

      if (typeof target.click === "function") {
        target.click();
      }

      return true;
    } catch {
      try {
        target.click();
        return true;
      } catch {
        return false;
      }
    }
  }

  function rebuildMenu() {
    setPageClass();
    classifyAuthLayout();
    applyTableLabels();
    ensureShell();

    const items = getOriginalMenuItems();
    const shouldShow =
      mediaQuery.matches &&
      document.body.classList.contains("prosper-app-page") &&
      items.length > 0;

    button.classList.toggle("is-hidden", !shouldShow);

    if (!shouldShow) {
      closeMenu();
      return;
    }

    const pageText = document.body.textContent || "";
    const isAdmin = pageText.includes("ADMIN PORTAL") || pageText.includes("Mileage Review");

    title.textContent = isAdmin ? "Admin Menu" : "Worker Menu";
    subtitle.textContent = "Mileage Tracker";

    const signature = items
      .map((item) => item.label + ":" + isItemActive(item.element))
      .join("|");

    if (signature === lastSignature) return;

    lastSignature = signature;
    list.innerHTML = "";

    items.forEach((item) => {
      const itemButton = document.createElement("button");
      itemButton.type = "button";
      itemButton.className =
        "prosper-mobile-menu-item" +
        (isItemActive(item.element) ? " is-active" : "");

      const icon = document.createElement("span");
      icon.className = "prosper-mobile-menu-icon";
      icon.textContent = getIcon(item.label);

      const text = document.createElement("span");
      text.textContent = item.label;

      itemButton.appendChild(icon);
      itemButton.appendChild(text);

      itemButton.addEventListener("click", () => {
        const label = item.label;

        closeMenu();

        window.setTimeout(() => {
          clickOriginalMenuItem(label);
          closeMenu();
          window.requestAnimationFrame(() => {
            applyTableLabels();
          });
        }, 80);
      });

      list.appendChild(itemButton);
    });
  }

  function scheduleRebuild() {
    window.requestAnimationFrame(rebuildMenu);
  }

  patchHistory();
  ensureShell();
  scheduleRebuild();

  const root = document.getElementById("root");

  if (root) {
    const observer = new MutationObserver(scheduleRebuild);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-current", "aria-selected"],
    });
  }

  window.addEventListener("resize", scheduleRebuild);
  window.addEventListener("orientationchange", scheduleRebuild);
  window.addEventListener("popstate", scheduleRebuild);
  window.addEventListener("prosper-route-change", scheduleRebuild);

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener("change", scheduleRebuild);
  }

  window.setInterval(scheduleRebuild, 1000);
})();
