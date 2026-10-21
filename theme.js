(function () {
  /* Light / dark mode per device: "system" follows the phone, "light" and "dark" override it.
     Loaded in <head> before the stylesheets render, so pages never flash in the wrong colours. */
  const STORAGE_KEY = "pw_theme";
  const THEME_COLORS = { light: "#fdf5f9", dark: "#191220" };

  function read() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === "light" || value === "dark" ? value : "system";
    } catch (error) {
      return "system";
    }
  }

  function syncThemeColor(theme) {
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
      if (!meta.dataset.systemContent) meta.dataset.systemContent = meta.content;
      meta.content = theme === "system" ? meta.dataset.systemContent : THEME_COLORS[theme];
    });
  }

  function apply(theme) {
    if (theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
    syncThemeColor(theme);
  }

  function set(theme) {
    try {
      if (theme === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      /* private mode: the choice still holds for this page */
    }
    apply(theme);
  }

  window.PwTheme = { get: read, set };

  apply(read());
  /* another tab changed the choice */
  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) apply(read());
  });
})();
