(() => {
  const icons = {
    "bell-ring": `
      <path d="M10.27 21a2 2 0 0 0 3.46 0"/>
      <path d="M4 8a8 8 0 0 1 16 0c0 7 3 8 3 8H1s3-1 3-8"/>
      <path d="M2 2c1.4 1 2.2 2.4 2.4 4"/>
      <path d="M22 2c-1.4 1-2.2 2.4-2.4 4"/>
    `,
    check: `
      <path d="M20 6 9 17l-5-5"/>
    `,
    "check-circle-2": `
      <path d="M9 12l2 2 4-4"/>
      <circle cx="12" cy="12" r="10"/>
    `,
    download: `
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <path d="M7 10l5 5 5-5"/>
      <path d="M12 15V3"/>
    `,
    "lock-keyhole-open": `
      <path d="M7 10V7a5 5 0 0 1 9.6-2"/>
      <rect x="5" y="10" width="14" height="11" rx="2"/>
      <circle cx="12" cy="15" r="1"/>
      <path d="M12 16v2"/>
    `,
    megaphone: `
      <path d="M3 11v2a2 2 0 0 0 2 2h2l4 5v-5h3l7 3V6l-7 3H5a2 2 0 0 0-2 2Z"/>
      <path d="M14 9v6"/>
    `,
    "refresh-cw": `
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/>
      <path d="M3 21v-5h5"/>
      <path d="M3 12A9 9 0 0 1 18.5 5.8L21 8"/>
      <path d="M21 3v5h-5"/>
    `,
    siren: `
      <path d="M7 18v-6a5 5 0 0 1 10 0v6"/>
      <path d="M5 21h14"/>
      <path d="M4 4 2 6"/>
      <path d="M20 4l2 2"/>
      <path d="M12 2v3"/>
      <path d="M10 12h4"/>
    `,
    "volume-2": `
      <path d="M11 5 6 9H2v6h4l5 4V5Z"/>
      <path d="M15.5 8.5a5 5 0 0 1 0 7"/>
      <path d="M19 5a10 10 0 0 1 0 14"/>
    `,
  };

  function createIcon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("data-lucide", name);
    svg.innerHTML = icons[name] || icons.check;
    return svg;
  }

  window.lucide = {
    createIcons() {
      document.querySelectorAll("i[data-lucide]").forEach((placeholder) => {
        placeholder.replaceWith(createIcon(placeholder.dataset.lucide));
      });
    },
  };
})();
