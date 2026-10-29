(() => {
  // Keep real links for direct visits, new tabs, and browsers without JavaScript.
  if (location.protocol === "file:") return;

  const pages = new Map();
  let navigation = 0;
  const key = (url) => new URL(url, location.href).pathname;
  const isPage = (url) => /\/(?:index|research)\.html$/.test(url.pathname) || url.pathname === new URL("./", location.href).pathname;

  function snapshot(doc) {
    return {
      stage: doc.querySelector(".stage"),
      bodyClass: doc.body.className,
      title: doc.title,
      metadata: [...doc.head.querySelectorAll("meta")].map((meta) => meta.cloneNode(true)),
    };
  }

  pages.set(key(location.href), Promise.resolve(snapshot(document)));

  async function load(url) {
    const path = key(url);
    if (!pages.has(path)) {
      const pending = fetch(url).then(async (response) => {
        if (!response.ok) throw new Error("Page unavailable");
        const page = snapshot(new DOMParser().parseFromString(await response.text(), "text/html"));
        if (!page.stage) throw new Error("Missing page content");
        return page;
      });
      pages.set(path, pending);
      pending.catch(() => pages.delete(path));
    }
    return pages.get(path);
  }

  async function navigate(url, push, focusLink = false) {
    const request = ++navigation;
    try {
      const page = await load(url);
      if (request !== navigation) return;
      if (push) history.pushState(null, "", url);
      document.querySelector(".stage").replaceWith(page.stage);
      document.body.className = page.bodyClass;
      document.title = page.title;
      document.head.querySelectorAll("meta").forEach((meta) => meta.remove());
      document.head.append(...page.metadata.map((meta) => meta.cloneNode(true)));
      document.dispatchEvent(new Event("pagechange"));
      window.scrollTo(0, 0);
      const activeLink = page.stage.querySelector('nav [aria-current="page"]');
      if (focusLink) activeLink?.focus({ preventScroll: true });
    } catch {
      if (request === navigation) location.assign(url);
    }
  }

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest("a[href]");
    if (!link || link.target || link.hasAttribute("download")) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || !isPage(url) || url.hash) return;
    event.preventDefault();
    if (url.pathname === location.pathname) return;
    navigate(url.href, true, event.detail === 0);
  });

  window.addEventListener("popstate", () => navigate(location.href, false));
})();
