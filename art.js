/* تركّد — رسومات الفئات (SVG أصلية مرسومة يدوياً) ولون كل فئة */
window.TIRAKKAD_ART = (function () {
  const svg = (inner) => `<svg viewBox="0 0 120 120" aria-hidden="true">${inner}</svg>`;
  const ink = '#1E2A3A';
  return {
    kuwait: {
      color: '#19B9C8',
      svg: svg(`
        <circle cx="60" cy="60" r="50" fill="#FFF3D6"/>
        <path d="M10 92h100v8a10 10 0 0 1-10 10H20a10 10 0 0 1-10-10z" fill="#7FD6E0"/>
        <path d="M14 96q12-4 24 0t24 0 24 0 24 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
        <rect x="45" y="14" width="4" height="78" rx="2" fill="${ink}"/>
        <circle cx="47" cy="40" r="13" fill="#0E8FA6"/><circle cx="47" cy="40" r="13" fill="url(#dots)" opacity=".5"/>
        <circle cx="47" cy="62" r="9" fill="#0E8FA6"/>
        <rect x="70" y="40" width="4" height="52" rx="2" fill="${ink}"/>
        <circle cx="72" cy="56" r="9" fill="#2FB67C"/>
        <rect x="88" y="56" width="3" height="36" rx="1.5" fill="${ink}"/>
        <defs><pattern id="dots" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.1" fill="#fff"/></pattern></defs>`),
    },
    'kuwait-malls': {
      color: '#FF7A5C',
      svg: svg(`
        <circle cx="60" cy="60" r="50" fill="#FFF3D6"/>
        <path d="M44 42v-6a16 16 0 0 1 32 0v6" stroke="${ink}" stroke-width="6" fill="none" stroke-linecap="round"/>
        <path d="M28 42h64l-5 58a6 6 0 0 1-6 5H39a6 6 0 0 1-6-5z" fill="#F2553A"/>
        <path d="M28 42h64l-1 10H29z" fill="#D23C22"/>
        <circle cx="44" cy="54" r="3.5" fill="${ink}"/><circle cx="76" cy="54" r="3.5" fill="${ink}"/>
        <path d="M60 66l4.5 9 10 1.4-7.2 7 1.7 9.9L60 88.6l-9 4.7 1.7-9.9-7.2-7 10-1.4z" fill="#FFB020"/>`),
    },
    charades: {
      color: '#8E6CEF',
      svg: svg(`
        <circle cx="60" cy="60" r="50" fill="#FFF3D6"/>
        <circle cx="60" cy="58" r="36" fill="#FFC247"/>
        <circle cx="47" cy="50" r="5" fill="${ink}"/><circle cx="73" cy="50" r="5" fill="${ink}"/>
        <path d="M40 40q7-6 14-2M80 40q-7-6-14-2" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <rect x="38" y="68" width="44" height="10" rx="5" fill="${ink}"/>
        <path d="M43 68v10M49 68v10M55 68v10M61 68v10M67 68v10M73 68v10" stroke="#FFC247" stroke-width="2"/>
        <rect x="76" y="64" width="12" height="18" rx="4" fill="#8E6CEF"/>`),
    },
    survey: {
      color: '#2FB67C',
      svg: svg(`
        <circle cx="60" cy="60" r="50" fill="#FFF3D6"/>
        <path d="M22 30a10 10 0 0 1 10-10h56a10 10 0 0 1 10 10v40a10 10 0 0 1-10 10H52l-16 16v-16h-4a10 10 0 0 1-10-10z" fill="#2FB67C"/>
        <rect x="36" y="48" width="10" height="22" rx="3" fill="#fff"/>
        <rect x="55" y="34" width="10" height="36" rx="3" fill="#FFB020"/>
        <rect x="74" y="54" width="10" height="16" rx="3" fill="#fff"/>
        <text x="60" y="113" text-anchor="middle" font-size="16" font-weight="800" fill="${ink}" font-family="sans-serif">%</text>`),
    },
    'general-knowledge': {
      color: '#FFB020',
      svg: svg(`
        <circle cx="60" cy="60" r="50" fill="#FFF3D6"/>
        <path d="M60 20a28 28 0 0 0-16 51c3 2 5 6 5 10v4h22v-4c0-4 2-8 5-10a28 28 0 0 0-16-51z" fill="#FFC247"/>
        <path d="M52 62l8-10 8 10" stroke="#E09400" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="49" y="86" width="22" height="7" rx="3" fill="${ink}"/><rect x="52" y="95" width="16" height="6" rx="3" fill="${ink}"/>
        <path d="M60 6v6M28 18l4 4M92 18l-4 4M16 48h6M104 48h-6" stroke="#F2553A" stroke-width="4" stroke-linecap="round"/>`),
    },
    latmiyat: {
      color: '#3A4A5C',
      svg: svg(`
        <circle cx="60" cy="60" r="50" fill="#FFF3D6"/>
        <rect x="32" y="16" width="5" height="90" rx="2.5" fill="#8A6A3B"/>
        <circle cx="34.5" cy="15" r="5" fill="#FFB020"/>
        <path d="M37 24q22-8 46 0t0 34q-24-8-46 0z" fill="#1E2A3A"/>
        <path d="M37 24q22-8 46 0" stroke="#2FB67C" stroke-width="3" fill="none"/>
        <path d="M37 58q22-8 46 0" stroke="#2FB67C" stroke-width="3" fill="none"/>`),
    },
    food: {
      color: '#F2A93B',
      svg: svg(`
        <circle cx="60" cy="60" r="50" fill="#FFF3D6"/>
        <ellipse cx="60" cy="84" rx="44" ry="12" fill="#fff" stroke="${ink}" stroke-width="3"/>
        <path d="M24 82q4-34 36-36 32 2 36 36z" fill="#F2C14E"/>
        <path d="M34 72h3M44 64h3M56 58h3M70 62h3M80 70h3M50 76h3M66 74h3" stroke="#E09400" stroke-width="3" stroke-linecap="round"/>
        <path d="M62 56q8-14 22-10 8 4 4 14-6 10-20 6z" fill="#B5652B"/>
        <rect x="83" y="38" width="12" height="5" rx="2.5" transform="rotate(-30 89 40)" fill="#fff" stroke="${ink}" stroke-width="2"/>
        <circle cx="40" cy="70" r="3" fill="#2FB67C"/><circle cx="74" cy="78" r="3" fill="#F2553A"/>`),
    },
  };
})();
