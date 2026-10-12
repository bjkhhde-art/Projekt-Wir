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

  let currentTab = null;
  const show = name => {
    currentTab = name;
    activateTab(name);
  };

  /* a tab switch is a step the phone's back button can undo */
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const name = tab.dataset.tab;
      if (name === currentTab) return;
      if (window.InPageHistory) InPageHistory.push({ hubTab: name, view: null }, { tab: name });
      show(name);
    });
  });

  window.addEventListener("popstate", event => {
    const name = event.state && event.state.hubTab;
    if (name && name !== currentTab) show(name);
  });

  const validTabNames = Array.from(tabs).map(tab => tab.dataset.tab);
  const fromQuery = new URLSearchParams(location.search).get("tab");
  const saved = localStorage.getItem(storageKey);
  const initial = validTabNames.includes(fromQuery)
    ? fromQuery
    : (validTabNames.includes(saved) ? saved : tabs[0].dataset.tab);

  show(initial);
  if (window.InPageHistory) InPageHistory.replace({ hubTab: initial });
})();
