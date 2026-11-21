
    // Before first paint: the saved theme, else the system preference, so the page never flashes the wrong one.
    (() => {
      let saved = null;
      try { saved = localStorage.getItem('defuss-db-theme'); } catch {}
      const dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    })();
  
