(function () {
  const tabs = document.querySelectorAll(".hub-tab");
  const panels = document.querySelectorAll(".hub-panel");
  const syncedElements = document.querySelectorAll("[data-show-for]");

  if (!tabs.length || !panels.length) return;

  const storageKey = "pw_hub_tab_" + (document.body.dataset.hub || "default");

  function activateTab(name) {
    tabs.forEach(tab => tab.classList.toggle("active", tab.dataset.tab === name));
    panels.forEach(panel => { panel.hidden = panel.dataset.panel !== name; });
    syncedElements.forEach(el => { el.style.display = el.dataset.showFor === name ? "" : "none"; });
    localStorage.setItem(storageKey, name);
    document.dispatchEvent(new CustomEvent("pw:hub-tab-shown", { detail: { tab: name } }));
  }

  tabs.forEach(tab => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });

  const validTabNames = Array.from(tabs).map(tab => tab.dataset.tab);
  const fromQuery = new URLSearchParams(location.search).get("tab");
  const saved = localStorage.getItem(storageKey);
  const initial = validTabNames.includes(fromQuery)
    ? fromQuery
    : (validTabNames.includes(saved) ? saved : tabs[0].dataset.tab);

  activateTab(initial);
})();
