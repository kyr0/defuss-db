// Runs in <head> before first paint, as a classic script (the page's CSP allows no inline script): the theme the
// defuss-db site stored, else the system preference. It keeps following both: a theme switch on the landing page
// writes localStorage, which fires a storage event in this frame, as in any same-origin document.
(() => {
  const KEY = 'defuss-db-theme';
  const system = matchMedia('(prefers-color-scheme: dark)');
  const stored = () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  };
  const apply = () => {
    const saved = stored();
    const dark = saved ? saved === 'dark' : system.matches;
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  };
  apply();
  addEventListener('storage', (event) => {
    if (event.key === KEY || event.key === null) apply();
  });
  system.addEventListener('change', apply);
})();
