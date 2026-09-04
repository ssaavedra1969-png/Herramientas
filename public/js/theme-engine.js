/**
 * ThemeEngine v3 — Motor de temas visuales con diferencias SUSTANTIVAS
 *
 * Estrategia:
 * 1. @property declarations para animated gradients/backgrounds
 * 2. CSS injection con selectores escapados para Tailwind arbitrary values
 * 3. Reemplazo de inline styles hardcoded en el DOM
 * 4. MutationObserver (childList + attributes) para re-aplicar cuando Firestore inserta datos
 * 5. Cada tema tiene: fondo animado, estructura (radius/blur/glow), bordes, animaciones PROPIAS
 */

window.ThemeEngine = (function () {
  /* ─── Palettes & per-theme structural tokens ─── */
  const themes = {
    sutil: {
      name: 'Sutil',
      accent: '#D4AF37',
      accentRGB: '212 175 55',
      accentLight: '#E8C547',
      accentLightRGB: '232 197 71',
      accentDark: '#B8860B',
      accentDarkRGB: '184 150 11',
      textMuted: '#8b9bb4',
      textMutedRGB: '139 155 180',
      textDim: '#4a5568',
      textDimRGB: '74 85 104',
      darkBg: '#090c12',
      darkBgRGB: '9 12 18',
      surfaceBg: '#0f1520',
      modalHeader: '#0f1520',
      clockGradient: 'linear-gradient(135deg,#E8C547 0%,#D4AF37 40%,#B8860B 100%)',
      clockDrop: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6)) drop-shadow(0 0 8px rgba(212,175,55,0.5))',
      fleetIcon: 'linear-gradient(135deg,#D4AF37,#B8860B)',
      glowRgb: '212,175,55',
      btnTextColor: '#090c12',
      radiusCard: '12px',
      radiusNav: '10px',
      blurCard: '10px',
      blurSidebar: '12px',
      blurModal: '8px',
      hoverLift: '-3px',
      hoverScale: '1.015',
      animSpeed: '0.2s',
      glowIntensity: '0.12',
      shadowDeep: '0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(212,175,55,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
      shadowHover: '0 16px 60px rgba(0,0,0,0.65), 0 0 50px rgba(212,175,55,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
      sidebarBorder: '0.08',
      cardBorder: '0.1',
      hoverBorder: '0.25',
      glowShadow: '0 0 16px rgba(212,175,55,0.25)',
    },
    modern: {
      name: 'Moderno',
      accent: '#06B6D4',
      accentRGB: '6 182 212',
      accentLight: '#67E8F9',
      accentLightRGB: '103 232 249',
      accentDark: '#0891B2',
      accentDarkRGB: '8 145 178',
      textMuted: '#94a3b8',
      textMutedRGB: '148 163 184',
      textDim: '#64748b',
      textDimRGB: '100 116 139',
      darkBg: '#06090f',
      darkBgRGB: '6 9 15',
      surfaceBg: '#0c1420',
      modalHeader: '#0c1420',
      clockGradient: 'linear-gradient(135deg,#67E8F9 0%,#06B6D4 40%,#0891B2 100%)',
      clockDrop: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6)) drop-shadow(0 0 15px rgba(6,182,212,0.6))',
      fleetIcon: 'linear-gradient(135deg,#06B6D4,#0891B2)',
      glowRgb: '6,182,212',
      btnTextColor: '#06090f',
      radiusCard: '8px',
      radiusNav: '6px',
      blurCard: '16px',
      blurSidebar: '20px',
      blurModal: '12px',
      hoverLift: '-5px',
      hoverScale: '1.02',
      animSpeed: '0.3s',
      glowIntensity: '0.2',
      shadowDeep: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(6,182,212,0.08), 0 0 20px rgba(6,182,212,0.06)',
      shadowHover: '0 12px 50px rgba(0,0,0,0.6), 0 0 40px rgba(6,182,212,0.18), 0 0 80px rgba(6,182,212,0.08)',
      sidebarBorder: '0.12',
      cardBorder: '0.12',
      hoverBorder: '0.35',
      glowShadow: '0 0 24px rgba(6,182,212,0.35)',
    },
    premium: {
      name: 'Premium',
      accent: '#8B5CF6',
      accentRGB: '139 92 246',
      accentLight: '#C4B5FD',
      accentLightRGB: '196 181 253',
      accentDark: '#7C3AED',
      accentDarkRGB: '124 58 237',
      textMuted: '#a1a1aa',
      textMutedRGB: '161 161 170',
      textDim: '#52525b',
      textDimRGB: '82 82 91',
      darkBg: '#050507',
      darkBgRGB: '5 5 7',
      surfaceBg: '#0c0c12',
      modalHeader: '#0c0c12',
      clockGradient: 'linear-gradient(135deg,#C4B5FD 0%,#8B5CF6 40%,#7C3AED 100%)',
      clockDrop: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6)) drop-shadow(0 0 20px rgba(139,92,246,0.7))',
      fleetIcon: 'linear-gradient(135deg,#8B5CF6,#7C3AED)',
      glowRgb: '139,92,246',
      btnTextColor: '#ffffff',
      radiusCard: '20px',
      radiusNav: '14px',
      blurCard: '24px',
      blurSidebar: '28px',
      blurModal: '18px',
      hoverLift: '-7px',
      hoverScale: '1.025',
      animSpeed: '0.4s',
      glowIntensity: '0.28',
      shadowDeep: '0 10px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.1), 0 0 30px rgba(139,92,246,0.08)',
      shadowHover: '0 20px 70px rgba(0,0,0,0.7), 0 0 60px rgba(139,92,246,0.25), 0 0 120px rgba(139,92,246,0.08)',
      sidebarBorder: '0.15',
      cardBorder: '0.12',
      hoverBorder: '0.3',
      glowShadow: '0 0 30px rgba(139,92,246,0.4)',
    },
  };

  let currentTheme = 'sutil';
  let styleOverride = null;
  let observer = null;

  function getTheme() {
    return themes[currentTheme] || themes.sutil;
  }

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }

  function buildPropertyDeclarations(theme) {
    return `
@property --bg-c1 { syntax: '<color>'; initial-value: ${theme.darkBg}; inherits: false; }
@property --bg-c2 { syntax: '<color>'; initial-value: ${theme.surfaceBg}; inherits: false; }
@property --bg-c3 { syntax: '<color>'; initial-value: ${theme.darkBg}; inherits: false; }
@property --grid-size { syntax: '<length>'; initial-value: 50px; inherits: false; }
`;
  }

  function buildAnimatedBackground(theme) {
    const AC = theme.accentRGB;
    if (currentTheme === 'sutil') {
      return `
html.theme-sutil body {
  background: linear-gradient(145deg, var(--bg-c1) 0%, var(--bg-c2) 50%, var(--bg-c3) 100%) !important;
  animation: warmBgShift 20s ease infinite !important;
}
@keyframes warmBgShift {
  0%, 100% { --bg-c1: #090c12; --bg-c2: #0f1520; --bg-c3: #090c12; }
  33%      { --bg-c1: #0d1018; --bg-c2: #13192a; --bg-c3: #0b0e15; }
  66%      { --bg-c1: #0a0d14; --bg-c2: #10161e; --bg-c3: #0c0f16; }
}
html.theme-sutil body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    linear-gradient(rgba(212,175,55,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(212,175,55,0.025) 1px, transparent 1px) !important;
  background-size: 50px 50px !important;
}
html.theme-sutil body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 60% 50% at 10% 10%, rgba(212,175,55,0.04) 0%, transparent 60%),
    radial-gradient(ellipse 50% 40% at 90% 90%, rgba(212,175,55,0.03) 0%, transparent 60%) !important;
}
`;
    }
    if (currentTheme === 'modern') {
      return `
html.theme-modern body {
  background:
    linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px),
    radial-gradient(ellipse 100% 70% at 15% 0%, rgba(6,182,212,0.08) 0%, transparent 60%),
    radial-gradient(ellipse 60% 50% at 85% 100%, rgba(6,182,212,0.04) 0%, transparent 60%),
    linear-gradient(145deg, #06090f 0%, #0c1420 50%, #06090f 100%) !important;
  background-size: var(--grid-size) var(--grid-size), var(--grid-size) var(--grid-size), 100% 100%, 100% 100%, 100% 100% !important;
  animation: gridPulse 6s ease infinite !important;
}
@keyframes gridPulse {
  0%, 100% { --grid-size: 50px; }
  50%      { --grid-size: 48px; }
}
html.theme-modern body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 15% 0%, rgba(6,182,212,0.1) 0%, transparent 40%),
    radial-gradient(circle at 85% 100%, rgba(6,182,212,0.05) 0%, transparent 40%) !important;
  opacity: 0.7 !important;
}
html.theme-modern body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(6,182,212,0.008) 2px,
    rgba(6,182,212,0.008) 4px
  ) !important;
}
`;
    }
    if (currentTheme === 'premium') {
      return `
html.theme-premium body {
  background: linear-gradient(155deg, var(--bg-c1) 0%, var(--bg-c2) 40%, var(--bg-c3) 100%) !important;
  animation: auroraShift 12s ease infinite !important;
}
@keyframes auroraShift {
  0%, 100% { --bg-c1: #050507; --bg-c2: #0c0c12; --bg-c3: #050507; }
  33%      { --bg-c1: #08050e; --bg-c2: #0e0815; --bg-c3: #070510; }
  66%      { --bg-c1: #05080f; --bg-c2: #0a0a14; --bg-c3: #08060e; }
}
html.theme-premium body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 80% 50% at 20% 0%, rgba(139,92,246,0.08) 0%, transparent 55%),
    radial-gradient(ellipse 60% 40% at 80% 100%, rgba(59,130,246,0.05) 0%, transparent 50%),
    radial-gradient(ellipse 50% 35% at 50% 50%, rgba(236,72,153,0.03) 0%, transparent 50%) !important;
  animation: auroraPulse 10s ease infinite alternate !important;
}
@keyframes auroraPulse {
  0%   { opacity: 0.6; }
  100% { opacity: 1; }
}
html.theme-premium body::after {
  content: '';
  position: fixed;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%);
  top: -200px;
  right: -200px;
  z-index: 0;
  pointer-events: none;
  animation: orbFloat1 18s ease-in-out infinite !important;
}
@keyframes orbFloat1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(-60px, 100px) scale(1.2); }
}
`;
    }
    return '';
  }

  function buildStructuralCSS(theme) {
    return `
/* === Structural: ${theme.name} === */
html.theme-${currentTheme} .glass-card {
  border-radius: ${theme.radiusCard} !important;
  background: rgba(${theme.darkBgRGB}, 0.8) !important;
  backdrop-filter: blur(${theme.blurCard}) saturate(180%) !important;
  -webkit-backdrop-filter: blur(${theme.blurCard}) saturate(180%) !important;
  border: 1px solid rgba(${theme.accentRGB}, ${theme.cardBorder}) !important;
  box-shadow: ${theme.shadowDeep} !important;
  transition: all ${theme.animSpeed} cubic-bezier(0.2, 0.8, 0.2, 1) !important;
  overflow: hidden !important;
}
html.theme-${currentTheme} .glass-card::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  background: linear-gradient(135deg, rgba(${theme.accentRGB},0.04) 0%, transparent 50%) !important;
  border-radius: inherit !important;
  pointer-events: none !important;
  z-index: 0 !important;
}
html.theme-${currentTheme} .glass-card::after {
  content: '' !important;
  position: absolute !important;
  top: -60% !important;
  right: -60% !important;
  width: 120% !important;
  height: 120% !important;
  background: radial-gradient(circle, rgba(${theme.accentRGB},0.08) 0%, transparent 60%) !important;
  border-radius: inherit !important;
  pointer-events: none !important;
  opacity: 0 !important;
  transition: opacity ${theme.animSpeed} ease !important;
  z-index: 0 !important;
}
html.theme-${currentTheme} .glass-card:hover {
  border-color: rgba(${theme.accentRGB}, ${theme.hoverBorder}) !important;
  box-shadow: ${theme.shadowHover} !important;
  transform: translateY(${theme.hoverLift}) scale(${theme.hoverScale}) !important;
}
html.theme-${currentTheme} .glass-card:hover::after { opacity: 1 !important; }
html.theme-${currentTheme} .sidebar-glass {
  border-radius: 0 !important;
  background: rgba(${theme.darkBgRGB}, 0.97) !important;
  backdrop-filter: blur(${theme.blurSidebar}) saturate(150%) !important;
  -webkit-backdrop-filter: blur(${theme.blurSidebar}) saturate(150%) !important;
  border-right: 1px solid rgba(${theme.accentRGB}, ${theme.sidebarBorder}) !important;
  position: relative !important;
}
html.theme-${currentTheme} .sidebar-glass::after {
  content: '' !important;
  position: absolute !important;
  top: 0 !important;
  right: 0 !important;
  width: 1px !important;
  height: 100% !important;
  background: linear-gradient(180deg, rgba(${theme.glowRgb},0.5) 0%, rgba(${theme.glowRgb},0.15) 50%, transparent 100%) !important;
  pointer-events: none !important;
  box-shadow: ${theme.glowShadow} !important;
}
html.theme-${currentTheme} .header-glass {
  background: rgba(${theme.darkBgRGB}, 0.95) !important;
  backdrop-filter: blur(${theme.blurSidebar}) !important;
  border-bottom: 1px solid rgba(${theme.accentRGB}, 0.08) !important;
  position: relative !important;
  z-index: 2 !important;
}
html.theme-${currentTheme} .nav-link {
  color: rgba(${theme.textMutedRGB}, 0.8) !important;
  border-radius: ${theme.radiusNav} !important;
  transition: all ${theme.animSpeed} cubic-bezier(0.2, 0.8, 0.2, 1) !important;
}
html.theme-${currentTheme} .nav-link:hover {
  color: #ffffff !important;
  background: rgba(${theme.accentRGB}, 0.08) !important;
  transform: translateX(4px) !important;
}
html.theme-${currentTheme} .nav-link.active {
  color: ${theme.accentLight} !important;
  background: rgba(${theme.accentRGB}, 0.12) !important;
  border-left: 3px solid ${theme.accent} !important;
  box-shadow: inset 0 1px 0 rgba(${theme.accentRGB}, 0.2), ${theme.glowShadow} !important;
}
html.theme-${currentTheme} .btn-primary {
  background: linear-gradient(135deg, ${theme.accentLight} 0%, ${theme.accent} 50%, ${theme.accentDark} 100%) !important;
  color: ${theme.btnTextColor} !important;
  box-shadow: 0 4px 24px rgba(${theme.glowRgb},0.4), 0 0 0 1px rgba(255,255,255,0.08) inset !important;
  transition: all ${theme.animSpeed} cubic-bezier(0.2, 0.8, 0.2, 1) !important;
}
html.theme-${currentTheme} .btn-primary:hover {
  box-shadow: 0 10px 40px rgba(${theme.glowRgb},0.55), 0 0 0 1px rgba(255,255,255,0.12) inset !important;
  transform: translateY(-3px) !important;
}
html.theme-${currentTheme} .btn-secondary {
  background: rgba(${theme.accentRGB}, 0.08) !important;
  color: ${theme.accent} !important;
  border: 1px solid rgba(${theme.accentRGB}, 0.2) !important;
  border-radius: ${theme.radiusNav} !important;
  transition: all ${theme.animSpeed} cubic-bezier(0.2, 0.8, 0.2, 1) !important;
}
html.theme-${currentTheme} .btn-secondary:hover {
  background: rgba(${theme.accentRGB}, 0.15) !important;
  border-color: rgba(${theme.accentRGB}, 0.35) !important;
  color: ${theme.accentLight} !important;
}
html.theme-${currentTheme} .text-gradient-primary,
html.theme-${currentTheme} .text-gradient-gold {
  background: linear-gradient(135deg, ${theme.accentLight}, ${theme.accent}, ${theme.accentDark}) !important;
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
  background-clip: text !important;
}
html.theme-${currentTheme} .input-neon:focus,
html.theme-${currentTheme} input:focus,
html.theme-${currentTheme} select:focus,
html.theme-${currentTheme} textarea:focus {
  border-color: ${theme.accent} !important;
  box-shadow: 0 0 0 4px rgba(${theme.accentRGB}, 0.15), ${theme.glowShadow} !important;
}
html.theme-${currentTheme} .modal-backdrop {
  background: rgba(0,0,0,0.85) !important;
  backdrop-filter: blur(${theme.blurModal}) !important;
}
html.theme-${currentTheme} .modal-content {
  border-radius: ${theme.radiusCard} !important;
  background: rgba(${theme.darkBgRGB}, 0.98) !important;
  backdrop-filter: blur(${theme.blurCard}) !important;
  border: 1px solid rgba(${theme.accentRGB}, 0.15) !important;
  box-shadow: 0 30px 80px rgba(0,0,0,0.8), 0 0 80px rgba(${theme.glowRgb},0.1) !important;
  animation: themeModalIn ${theme.animSpeed} cubic-bezier(0.4, 0, 0.2, 1) !important;
}
@keyframes themeModalIn {
  from { transform: scale(0.94) translateY(16px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}
html.theme-${currentTheme} .table-container th {
  color: rgba(${theme.textDimRGB}, 1) !important;
  background: rgba(${theme.darkBgRGB}, 0.92) !important;
  border-bottom: 1px solid rgba(${theme.accentRGB}, 0.08) !important;
  text-transform: uppercase !important;
  border-radius: ${theme.radiusCard} !important;
}
html.theme-${currentTheme} .table-container tr:hover td {
  background: rgba(${theme.accentRGB}, 0.04) !important;
}
html.theme-${currentTheme} .vehicle-card {
  border-radius: ${theme.radiusCard} !important;
  background: rgba(${theme.darkBgRGB}, 0.85) !important;
  backdrop-filter: blur(${theme.blurCard}) !important;
  border: 1px solid rgba(${theme.accentRGB}, 0.08) !important;
  transition: all ${theme.animSpeed} cubic-bezier(0.2, 0.8, 0.2, 1) !important;
}
html.theme-${currentTheme} .vehicle-card:hover {
  border-color: rgba(${theme.accentRGB}, 0.3) !important;
  transform: translateY(${theme.hoverLift}) scale(1.02) !important;
  box-shadow: ${theme.shadowHover} !important;
}
html.theme-${currentTheme} .vehicle-card:hover .card-logo-wrap {
  box-shadow: 0 10px 30px rgba(${theme.glowRgb},0.2), 0 20px 50px rgba(${theme.glowRgb},0.1) !important;
  border-color: rgba(${theme.accentRGB}, 0.4) !important;
}
html.theme-${currentTheme} .vehicle-card:hover .card-logo-img {
  filter: drop-shadow(0 4px 8px rgba(${theme.glowRgb},0.4)) !important;
}
html.theme-${currentTheme} .card-3d:hover {
  transform: translateY(${theme.hoverLift}) scale(${theme.hoverScale}) !important;
  box-shadow: ${theme.shadowHover} !important;
}
html.theme-${currentTheme} ::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, ${theme.accent}, ${theme.accentDark}) !important;
  border-radius: 10px !important;
}
html.theme-${currentTheme} .progress-bar-fill {
  background: linear-gradient(90deg, ${theme.accent}, ${theme.accentDark}) !important;
}
html.theme-${currentTheme} .skeleton {
  background: linear-gradient(90deg, rgba(${theme.accentRGB},0.04) 25%, rgba(${theme.accentRGB},0.09) 50%, rgba(${theme.accentRGB},0.04) 75%) !important;
}
html.theme-${currentTheme} input[type="checkbox"] {
  accent-color: ${theme.accent} !important;
}
html.theme-${currentTheme} .status-badge.excelente,
html.theme-${currentTheme} .status-badge.activo,
html.theme-${currentTheme} .status-badge.bueno {
  background: rgba(${theme.accentRGB}, 0.12) !important;
  color: ${theme.accentLight} !important;
}
html.theme-${currentTheme} .status-badge.pendiente,
html.theme-${currentTheme} .status-badge.regular {
  background: rgba(${theme.accentRGB}, 0.1) !important;
  color: ${theme.accentLight} !important;
}
html.theme-${currentTheme} .glow-border:hover {
  border-color: rgba(${theme.accentRGB}, 0.3) !important;
  box-shadow: 0 0 25px rgba(${theme.glowRgb},0.2) !important;
}
html.theme-${currentTheme} .mobile-menu-glass {
  background: rgba(${theme.darkBgRGB}, 0.98) !important;
  backdrop-filter: blur(${theme.blurSidebar}) !important;
  border-bottom: 1px solid rgba(${theme.accentRGB}, 0.08) !important;
}
html.theme-${currentTheme} main {
  position: relative !important;
  z-index: 1 !important;
}
html.theme-${currentTheme} .sidebar-glass {
  position: relative !important;
  z-index: 2 !important;
}
html.theme-${currentTheme} .card-badge.trompo-yes {
  background: rgba(${theme.accentRGB}, 0.15) !important;
  color: ${theme.accent} !important;
}
`;
  }

  function buildConicBorder(theme) {
    if (currentTheme === 'sutil') return '';
    const colors = currentTheme === 'modern'
      ? 'rgba(6,182,212,0.25), transparent, rgba(6,182,212,0.15), transparent'
      : 'rgba(139,92,246,0.25), rgba(59,130,246,0.15), rgba(236,72,153,0.15), rgba(139,92,246,0.25)';
    const speed = currentTheme === 'modern' ? '4s' : '6s';
    return `
html.theme-${currentTheme} .glass-card {
  position: relative !important;
}
html.theme-${currentTheme} .glass-card::before {
  content: '' !important;
  position: absolute !important;
  inset: -1px !important;
  border-radius: inherit !important;
  padding: 1px !important;
  background: conic-gradient(from 0deg, ${colors}) !important;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0) !important;
  -webkit-mask-composite: xor !important;
  mask-composite: exclude !important;
  pointer-events: none !important;
  z-index: 0 !important;
  animation: conicSpin ${speed} linear infinite !important;
  opacity: 0 !important;
  transition: opacity ${theme.animSpeed} ease !important;
}
html.theme-${currentTheme} .glass-card:hover::before {
  opacity: 1 !important;
}
@keyframes conicSpin { to { transform: rotate(360deg); } }
`;
  }

  function buildTailwindOverrides(theme) {
    const AR = theme.accentRGB;
    const MR = theme.textMutedRGB;
    const DR = theme.textDimRGB;
    const BR = theme.darkBgRGB;

    return `
/* === Tailwind arbitrary value overrides: ${theme.name} === */

/* bg-[#d4af37] family */
html.theme-${currentTheme} .bg-\\[\\#d4af37\\] { background-color: rgb(${AR}) !important; }
html.theme-${currentTheme} .bg-\\[\\#d4af37\\]\\/5 { background-color: rgb(${AR} / 0.05) !important; }
html.theme-${currentTheme} .bg-\\[\\#d4af37\\]\\/10 { background-color: rgb(${AR} / 0.1) !important; }
html.theme-${currentTheme} .bg-\\[\\#d4af37\\]\\/15 { background-color: rgb(${AR} / 0.15) !important; }
html.theme-${currentTheme} .bg-\\[\\#d4af37\\]\\/20 { background-color: rgb(${AR} / 0.2) !important; }
html.theme-${currentTheme} .bg-\\[\\#d4af37\\]\\/30 { background-color: rgb(${AR} / 0.3) !important; }
html.theme-${currentTheme} .bg-\\[\\#d4af37\\]\\/40 { background-color: rgb(${AR} / 0.4) !important; }
html.theme-${currentTheme} .bg-\\[\\#d4af37\\]\\/50 { background-color: rgb(${AR} / 0.5) !important; }
html.theme-${currentTheme} .bg-\\[\\#D4AF37\\] { background-color: rgb(${AR}) !important; }
html.theme-${currentTheme} .bg-\\[\\#D4AF37\\]\\/10 { background-color: rgb(${AR} / 0.1) !important; }
html.theme-${currentTheme} .bg-\\[\\#D4AF37\\]\\/20 { background-color: rgb(${AR} / 0.2) !important; }
html.theme-${currentTheme} .bg-\\[\\#D4AF37\\]\\/30 { background-color: rgb(${AR} / 0.3) !important; }

/* text-[#d4af37] family */
html.theme-${currentTheme} .text-\\[\\#d4af37\\] { color: rgb(${AR}) !important; }
html.theme-${currentTheme} .text-\\[\\#D4AF37\\] { color: rgb(${AR}) !important; }
html.theme-${currentTheme} .text-\\[\\#8b9bb4\\] { color: rgb(${MR}) !important; }
html.theme-${currentTheme} .text-\\[\\#4a5568\\] { color: rgb(${DR}) !important; }
html.theme-${currentTheme} .placeholder-\\[\\#4a5568\\]::placeholder { color: rgb(${DR}) !important; }

/* bg dark surface */
html.theme-${currentTheme} .bg-\\[\\#0a0e17\\] { background-color: rgb(${BR}) !important; }
html.theme-${currentTheme} .bg-\\[\\#0a0e17\\]\\/20 { background-color: rgb(${BR} / 0.2) !important; }
html.theme-${currentTheme} .bg-\\[\\#0a0e17\\]\\/30 { background-color: rgb(${BR} / 0.3) !important; }
html.theme-${currentTheme} .bg-\\[\\#0a0e17\\]\\/40 { background-color: rgb(${BR} / 0.4) !important; }
html.theme-${currentTheme} .bg-\\[\\#0a0e17\\]\\/50 { background-color: rgb(${BR} / 0.5) !important; }
html.theme-${currentTheme} .bg-\\[\\#0a0e17\\]\\/60 { background-color: rgb(${BR} / 0.6) !important; }
html.theme-${currentTheme} .bg-\\[\\#0A0E17\\] { background-color: rgb(${BR}) !important; }
html.theme-${currentTheme} .bg-\\[\\#0A0E17\\]\\/30 { background-color: rgb(${BR} / 0.3) !important; }
html.theme-${currentTheme} .bg-\\[\\#0A0E17\\]\\/50 { background-color: rgb(${BR} / 0.5) !important; }

/* border gold family */
html.theme-${currentTheme} .border-\\[\\#d4af37\\]\\/5 { border-color: rgb(${AR} / 0.05) !important; }
html.theme-${currentTheme} .border-\\[\\#d4af37\\]\\/10 { border-color: rgb(${AR} / 0.1) !important; }
html.theme-${currentTheme} .border-\\[\\#d4af37\\]\\/15 { border-color: rgb(${AR} / 0.15) !important; }
html.theme-${currentTheme} .border-\\[\\#d4af37\\]\\/20 { border-color: rgb(${AR} / 0.2) !important; }
html.theme-${currentTheme} .border-\\[\\#d4af37\\]\\/25 { border-color: rgb(${AR} / 0.25) !important; }
html.theme-${currentTheme} .border-\\[\\#d4af37\\]\\/30 { border-color: rgb(${AR} / 0.3) !important; }
html.theme-${currentTheme} .border-\\[\\#d4af37\\]\\/40 { border-color: rgb(${AR} / 0.4) !important; }
html.theme-${currentTheme} .border-\\[\\#d4af37\\]\\/60 { border-color: rgb(${AR} / 0.6) !important; }
html.theme-${currentTheme} .border-\\[\\#D4AF37\\]\\/20 { border-color: rgb(${AR} / 0.2) !important; }
html.theme-${currentTheme} .border-\\[\\#D4AF37\\]\\/30 { border-color: rgb(${AR} / 0.3) !important; }

/* focus states */
html.theme-${currentTheme} .focus\\:border-\\[\\#d4af37\\]\\/50:focus { border-color: rgb(${AR} / 0.5) !important; }
html.theme-${currentTheme} .focus\\:border-\\[\\#d4af37\\]\\/30:focus { border-color: rgb(${AR} / 0.3) !important; }
html.theme-${currentTheme} .focus\\:border-\\[\\#D4AF37\\]\\/30:focus { border-color: rgb(${AR} / 0.3) !important; }
html.theme-${currentTheme} .focus\\:ring-\\[\\#d4af37\\]\\/20:focus { --tw-ring-color: rgb(${AR} / 0.2) !important; }
html.theme-${currentTheme} .focus\\:ring-\\[\\#d4af37\\]\\/30:focus { --tw-ring-color: rgb(${AR} / 0.3) !important; }

/* hover states */
html.theme-${currentTheme} .hover\\:bg-\\[\\#d4af37\\]\\/10:hover { background-color: rgb(${AR} / 0.1) !important; }
html.theme-${currentTheme} .hover\\:bg-\\[\\#d4af37\\]\\/20:hover { background-color: rgb(${AR} / 0.2) !important; }
html.theme-${currentTheme} .hover\\:bg-\\[\\#d4af37\\]\\/30:hover { background-color: rgb(${AR} / 0.3) !important; }
html.theme-${currentTheme} .hover\\:border-\\[\\#d4af37\\]\\/20:hover { border-color: rgb(${AR} / 0.2) !important; }
html.theme-${currentTheme} .hover\\:border-\\[\\#d4af37\\]\\/30:hover { border-color: rgb(${AR} / 0.3) !important; }
html.theme-${currentTheme} .hover\\:text-\\[\\#d4af37\\]:hover { color: rgb(${AR}) !important; }
html.theme-${currentTheme} .hover\\:shadow-\\[\\#d4af37\\]\\/20:hover { --tw-shadow-color: rgb(${AR} / 0.2) !important; }
html.theme-${currentTheme} .hover\\:shadow-\\[\\#d4af37\\]\\/30:hover { --tw-shadow-color: rgb(${AR} / 0.3) !important; }
html.theme-${currentTheme} .hover\\:bg-\\[\\#D4AF37\\]\\/10:hover { background-color: rgb(${AR} / 0.1) !important; }
html.theme-${currentTheme} .hover\\:bg-\\[\\#D4AF37\\]\\/20:hover { background-color: rgb(${AR} / 0.2) !important; }
html.theme-${currentTheme} .hover\\:border-\\[\\#D4AF37\\]\\/20:hover { border-color: rgb(${AR} / 0.2) !important; }

/* shadow gold */
html.theme-${currentTheme} .shadow-\\[\\#d4af37\\]\\/10 { --tw-shadow-color: rgb(${AR} / 0.1) !important; }
html.theme-${currentTheme} .shadow-\\[\\#d4af37\\]\\/20 { --tw-shadow-color: rgb(${AR} / 0.2) !important; }
html.theme-${currentTheme} .shadow-\\[\\#d4af37\\]\\/30 { --tw-shadow-color: rgb(${AR} / 0.3) !important; }

/* gradient from/to */
html.theme-${currentTheme} .from-\\[\\#d4af37\\] { --tw-gradient-from: rgb(${AR}) !important; }
html.theme-${currentTheme} .from-\\[\\#D4AF37\\] { --tw-gradient-from: rgb(${AR}) !important; }
html.theme-${currentTheme} .to-\\[\\#d4af37\\] { --tw-gradient-to: rgb(${AR}) !important; }
html.theme-${currentTheme} .to-\\[\\#D4AF37\\] { --tw-gradient-to: rgb(${AR}) !important; }

/* accent checkbox */
html.theme-${currentTheme} .accent-\\[\\#d4af37\\] { accent-color: rgb(${AR}) !important; }
html.theme-${currentTheme} .accent-\\[\\#D4AF37\\] { accent-color: rgb(${AR}) !important; }

/* File input styling */
html.theme-${currentTheme} .file\\:bg-\\[\\#d4af37\\]\\/10::file-selector-button { background-color: rgb(${AR} / 0.1) !important; }
html.theme-${currentTheme} .file\\:text-\\[\\#d4af37\\]::file-selector-button { color: rgb(${AR}) !important; }
html.theme-${currentTheme} .hover\\:file\\:bg-\\[\\#d4af37\\]\\/20:hover::file-selector-button { background-color: rgb(${AR} / 0.2) !important; }

/* Dev banner */
html.theme-${currentTheme} .bg-yellow-500\\/20 { background-color: rgba(${AR}, 0.12) !important; }
html.theme-${currentTheme} .border-yellow-500\\/30 { border-color: rgba(${AR}, 0.2) !important; }
html.theme-${currentTheme} .text-yellow-300 { color: ${theme.accentLight} !important; }

/* Alert badge */
html.theme-${currentTheme} .bg-red-500 { background-color: #EF4444 !important; }
`;
  }

  function injectStyleOverride(css) {
    if (styleOverride) styleOverride.remove();
    styleOverride = document.createElement('style');
    styleOverride.id = 'theme-engine-override';
    styleOverride.textContent = css;
    document.head.appendChild(styleOverride);
  }

  function applyInlineStyleOverrides(theme) {
    // Reloj digital
    const clock = document.getElementById('dash-clock');
    if (clock) {
      clock.style.background = theme.clockGradient;
      clock.style.filter = theme.clockDrop;
      clock.style.WebkitTextStroke = '0.5px rgba(255,255,255,0.1)';
    }
    const dateEl = document.getElementById('dash-date');
    if (dateEl) {
      dateEl.style.textShadow = `0 1px 3px rgba(0,0,0,0.5), 0 0 20px rgba(${theme.glowRgb},0.3)`;
    }

    // Modal headers: #141e2d
    document.querySelectorAll('[style*="#141e2d"]').forEach(el => {
      el.style.background = theme.surfaceBg;
    });

    // Export preview background #0a0e17
    document.querySelectorAll('[style*="#0a0e17"]').forEach(el => {
      const s = el.getAttribute('style') || '';
      if (s.includes('background') || s.includes('min-height')) {
        el.style.background = theme.darkBg;
      }
    });

    // Fleet health icon gradient
    document.querySelectorAll('[style*="background:linear-gradient(135deg,#10B981,#059669)"]').forEach(el => {
      el.style.background = theme.fleetIcon;
    });

    // Fleet health progress
    document.querySelectorAll('[style*="background:linear-gradient(90deg,#10B981,#059669)"]').forEach(el => {
      el.style.background = `linear-gradient(90deg, ${theme.accent}, ${theme.accentDark})`;
    });

    // Skeleton
    document.querySelectorAll('.skeleton').forEach(el => {
      el.style.background = `linear-gradient(90deg, rgba(${theme.accentRGB},0.04) 25%, rgba(${theme.accentRGB},0.09) 50%, rgba(${theme.accentRGB},0.04) 75%)`;
    });

    // Progress bar
    document.querySelectorAll('.progress-bar-fill').forEach(el => {
      el.style.background = `linear-gradient(90deg, ${theme.accent}, ${theme.accentDark})`;
    });

    // Status badges
    document.querySelectorAll('.status-badge.excelente, .status-badge.activo, .status-badge.bueno, .status-badge.realizado').forEach(el => {
      el.style.background = `rgba(${theme.accentRGB}, 0.12)`;
      el.style.color = theme.accentLight;
    });
    document.querySelectorAll('.status-badge.pendiente, .status-badge.regular').forEach(el => {
      el.style.background = `rgba(${theme.accentRGB}, 0.1)`;
      el.style.color = theme.accentLight;
    });

    // Trompo badge
    document.querySelectorAll('.card-badge.trompo-yes').forEach(el => {
      el.style.background = `rgba(${theme.accentRGB}, 0.15)`;
      el.style.color = theme.accent;
    });

    // Latest services card
    document.querySelectorAll('[style*="radial-gradient(circle,#d4af37"]').forEach(el => {
      el.style.background = `radial-gradient(circle,${theme.accent},transparent 70%)`;
    });
    document.querySelectorAll('[style*="linear-gradient(90deg,transparent,rgba(212,175,55"]').forEach(el => {
      el.style.background = `linear-gradient(90deg,transparent,rgba(${theme.glowRgb},0.8),rgba(${theme.glowRgb},0.6),transparent)`;
    });
    document.querySelectorAll('[style*="background:linear-gradient(135deg,#d4af37"]').forEach(el => {
      el.style.background = `linear-gradient(135deg,${theme.accentLight},${theme.accent})`;
      el.style.boxShadow = `0 8px 22px -6px rgba(${theme.glowRgb},0.6)`;
    });

    // Latest services count badge
    document.querySelectorAll('[style*="background:rgba(212,175,55,0.15); color:#d4af37"]').forEach(el => {
      el.style.background = `rgba(${theme.accentRGB}, 0.15)`;
      el.style.color = theme.accent;
    });

    // Fleet health card border
    document.querySelectorAll('[style*="border:1px solid rgba(16,185,129"]').forEach(el => {
      el.style.border = `1px solid rgba(${theme.accentRGB}, 0.15)`;
    });

    // Modal border/shadow
    document.querySelectorAll('[style*="border:1px solid rgba(212,175,55"]').forEach(el => {
      const s = el.getAttribute('style') || '';
      if (s.includes('border:1px solid')) {
        el.style.border = `1px solid rgba(${theme.accentRGB}, 0.2)`;
      }
    });
    document.querySelectorAll('[style*="0 0 40px rgba(212,175,55"]').forEach(el => {
      el.style.boxShadow = el.style.boxShadow.replace(/0 0 40px rgba\([^)]+\)/g, `0 0 50px rgba(${theme.glowRgb},0.12)`);
    });

    // Mobile header shadow
    document.querySelectorAll('[style*="filter: drop-shadow(0 4px 12px rgba(212,175,55"]').forEach(el => {
      el.style.filter = `drop-shadow(0 4px 12px rgba(${theme.glowRgb},0.4))`;
    });
  }

  function ensureOrbElement() {
    let orb = document.getElementById('theme-orb-2');
    if (currentTheme === 'premium' && !orb) {
      orb = document.createElement('div');
      orb.id = 'theme-orb-2';
      document.body.appendChild(orb);
    } else if (currentTheme !== 'premium' && orb) {
      orb.remove();
    }
  }

  function applyTheme(name) {
    if (!themes[name]) name = 'sutil';
    currentTheme = name;
    const theme = themes[name];

    document.documentElement.className = `theme-${name}`;

    const css = [
      buildPropertyDeclarations(theme),
      buildAnimatedBackground(theme),
      buildStructuralCSS(theme),
      buildConicBorder(theme),
      buildTailwindOverrides(theme),
    ].join('\n');

    injectStyleOverride(css);
    ensureOrbElement();
    applyInlineStyleOverrides(theme);

    localStorage.setItem('falpat-theme', name);
  }

  function init() {
    const saved = localStorage.getItem('falpat-theme') || 'sutil';
    applyTheme(saved);

    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      applyInlineStyleOverrides(themes[currentTheme]);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
  }

  return {
    init,
    applyTheme,
    getCurrentTheme: () => currentTheme,
    getThemes: () => Object.keys(themes),
  };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.ThemeEngine.init());
} else {
  window.ThemeEngine.init();
}
