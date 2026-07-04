/* @ds-bundle: {"format":3,"namespace":"StratifyDesignSystem_af4c64","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"SectionHeader","sourcePath":"components/core/Card.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"KpiTile","sourcePath":"components/esports/KpiTile.jsx"},{"name":"PlayerListItem","sourcePath":"components/esports/PlayerListItem.jsx"},{"name":"RatingBadge","sourcePath":"components/esports/RatingBadge.jsx"},{"name":"StatBar","sourcePath":"components/esports/StatBar.jsx"},{"name":"SegmentedTabs","sourcePath":"components/navigation/SegmentedTabs.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"35a68ad61883","components/core/Badge.jsx":"acfa7fab640d","components/core/Button.jsx":"6767ad6cfb1b","components/core/Card.jsx":"cb66caaf7924","components/core/IconButton.jsx":"1f5b788b6310","components/core/Input.jsx":"7f4eb93f48f7","components/esports/KpiTile.jsx":"11d8ef347f45","components/esports/PlayerListItem.jsx":"de6fb6d19cae","components/esports/RatingBadge.jsx":"42ae15a4f77c","components/esports/StatBar.jsx":"95d055642d54","components/navigation/SegmentedTabs.jsx":"da4a20c963ee","ui_kits/stratify_app/DashboardScreen.jsx":"f29ad263997e","ui_kits/stratify_app/LoginScreen.jsx":"0b8c9cfc8abf","ui_kits/stratify_app/MarketScreen.jsx":"884deac6a7f5","ui_kits/stratify_app/data.js":"8da55744b502"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.StratifyDesignSystem_af4c64 = window.StratifyDesignSystem_af4c64 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const FALLBACK_GRADIENTS = ['linear-gradient(135deg,#10B981,#059669)', 'linear-gradient(135deg,#6366F1,#4338CA)', 'linear-gradient(135deg,#EC4899,#BE185D)', 'linear-gradient(135deg,#F59E0B,#B45309)', 'linear-gradient(135deg,#3B82F6,#1D4ED8)'];
function hashIndex(str, n) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = h * 31 + str.charCodeAt(i) >>> 0;
  return h % n;
}

/**
 * Avatar — player / team image with initials fallback on a colored gradient.
 * Optional status ring (online / injured) and selected emerald ring.
 */
function Avatar({
  src = null,
  name = '',
  size = 'md',
  status = null,
  // 'online' | 'injured' | 'suspended' | null
  selected = false,
  style,
  ...rest
}) {
  const sizes = {
    sm: 28,
    md: 36,
    lg: 56,
    xl: 72
  };
  const px = typeof size === 'number' ? size : sizes[size] || sizes.md;
  const initials = (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const statusColors = {
    online: 'var(--emerald-500)',
    injured: 'var(--danger)',
    suspended: 'var(--warning)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: 'relative',
      width: px,
      height: px,
      flexShrink: 0,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      overflow: 'hidden',
      background: src ? '#000' : FALLBACK_GRADIENTS[hashIndex(name, FALLBACK_GRADIENTS.length)],
      border: selected ? '2px solid var(--emerald-500)' : '1px solid var(--border-strong)',
      boxShadow: selected ? 'var(--glow-emerald-soft)' : 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      font: `var(--weight-extrabold) ${Math.round(px * 0.4)}px var(--font-sans)`,
      color: '#fff'
    }
  }, initials)), status && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: -1,
      bottom: -1,
      width: Math.max(9, px * 0.28),
      height: Math.max(9, px * 0.28),
      borderRadius: '50%',
      background: statusColors[status] || 'var(--text-muted)',
      border: '2px solid var(--surface-app)'
    }
  }));
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Badge / status pill. Compact label with a tinted fill matching a semantic
 * hue — used for player status (Online, Lesionado), roles, and counts.
 */
function Badge({
  children,
  tone = 'neutral',
  variant = 'soft',
  dot = false,
  size = 'md',
  style,
  ...rest
}) {
  const tones = {
    neutral: {
      fg: 'var(--text-secondary)',
      solidBg: 'var(--surface-control)',
      softBg: 'var(--surface-control)',
      ring: 'var(--border-strong)'
    },
    emerald: {
      fg: 'var(--emerald-400)',
      solidBg: 'var(--emerald-500)',
      softBg: 'var(--emerald-tint-12)',
      ring: 'var(--emerald-tint-30)'
    },
    danger: {
      fg: '#f87171',
      solidBg: 'var(--danger)',
      softBg: 'var(--danger-tint)',
      ring: 'rgba(239,68,68,0.3)'
    },
    warning: {
      fg: '#fbbf24',
      solidBg: 'var(--warning)',
      softBg: 'var(--warning-tint)',
      ring: 'rgba(245,158,11,0.3)'
    },
    info: {
      fg: '#818cf8',
      solidBg: 'var(--info)',
      softBg: 'var(--info-tint)',
      ring: 'rgba(99,102,241,0.3)'
    },
    pink: {
      fg: '#f472b6',
      solidBg: 'var(--accent-pink)',
      softBg: 'var(--pink-tint)',
      ring: 'rgba(236,72,153,0.3)'
    }
  };
  const t = tones[tone] || tones.neutral;
  const sizes = {
    sm: {
      fs: 9,
      px: 7,
      h: 18
    },
    md: {
      fs: 10.5,
      px: 9,
      h: 22
    },
    lg: {
      fs: 12,
      px: 12,
      h: 26
    }
  };
  const s = sizes[size] || sizes.md;
  const solid = variant === 'solid';
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      height: s.h,
      padding: `0 ${s.px}px`,
      borderRadius: 'var(--radius-pill)',
      background: solid ? t.solidBg : t.softBg,
      border: `1px solid ${solid ? 'transparent' : t.ring}`,
      color: solid ? tone === 'emerald' ? '#000' : '#fff' : t.fg,
      font: `var(--weight-bold) ${s.fs}px var(--font-sans)`,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      lineHeight: 1,
      ...style
    }
  }, rest), dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: solid ? 'currentColor' : t.fg,
      flexShrink: 0
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/**
 * Stratify Button — the app's primary call-to-action.
 * Emerald fill with black label by default; heavy uppercase tracking; press
 * mimics React Native's TouchableOpacity (dip in opacity + slight scale).
 */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  iconLeft = null,
  iconRight = null,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const sizes = {
    sm: {
      h: 38,
      px: 16,
      fs: 12,
      ls: '0.06em'
    },
    md: {
      h: 48,
      px: 22,
      fs: 13,
      ls: '0.08em'
    },
    lg: {
      h: 54,
      px: 28,
      fs: 14,
      ls: '0.10em'
    }
  };
  const s = sizes[size] || sizes.md;
  const variants = {
    primary: {
      bg: 'var(--emerald-500)',
      bgHover: 'var(--emerald-400)',
      color: '#000',
      border: 'transparent'
    },
    secondary: {
      bg: 'var(--surface-control)',
      bgHover: 'var(--surface-hover)',
      color: 'var(--text-secondary)',
      border: 'var(--border-strong)'
    },
    ghost: {
      bg: 'transparent',
      bgHover: 'var(--surface-control)',
      color: 'var(--text-secondary)',
      border: 'transparent'
    },
    danger: {
      bg: 'var(--danger)',
      bgHover: '#f05252',
      color: '#fff',
      border: 'transparent'
    },
    outline: {
      bg: 'transparent',
      bgHover: 'var(--emerald-tint-12)',
      color: 'var(--emerald-500)',
      border: 'var(--emerald-tint-30)'
    }
  };
  const v = variants[variant] || variants.primary;
  const isDisabled = disabled || loading;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: isDisabled ? undefined : onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    disabled: isDisabled,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: fullWidth ? '100%' : 'auto',
      height: s.h,
      padding: `0 ${s.px}px`,
      font: `var(--weight-black) ${s.fs}px var(--font-sans)`,
      letterSpacing: s.ls,
      textTransform: 'uppercase',
      color: v.color,
      background: hover && !isDisabled ? v.bgHover : v.bg,
      border: `1px solid ${v.border}`,
      borderRadius: 'var(--radius-md)',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      opacity: isDisabled ? 0.5 : press ? 0.85 : 1,
      transform: press && !isDisabled ? 'scale(0.97)' : 'none',
      transition: 'background var(--dur-fast) var(--ease-standard), opacity var(--dur-fast), transform var(--dur-fast)',
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), loading && /*#__PURE__*/React.createElement(Spinner, {
    color: v.color
  }), !loading && iconLeft, children, !loading && iconRight);
}
function Spinner({
  color
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 14,
      borderRadius: '50%',
      border: `2px solid ${color === '#000' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)'}`,
      borderTopColor: color,
      display: 'inline-block',
      animation: 'stratify-spin 0.7s linear infinite'
    }
  });
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Surface card — the dark, hairline-bordered container that holds nearly
 * every block in the app (team list, performance, sheets sections).
 * Optional emerald glow ring for "active / highlighted" cards.
 */
function Card({
  children,
  glow = false,
  padded = true,
  surface = 'deep',
  style,
  ...rest
}) {
  const surfaces = {
    deep: 'var(--surface-deep)',
    raised: 'var(--surface-raised)',
    control: 'var(--surface-control)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: surfaces[surface] || surfaces.deep,
      border: `1px solid ${glow ? 'var(--emerald-tint-30)' : 'var(--border-subtle)'}`,
      borderRadius: 'var(--radius-2xl)',
      padding: padded ? 'var(--space-6)' : 0,
      boxShadow: glow ? 'var(--glow-emerald-soft)' : 'none',
      overflow: 'hidden',
      ...style
    }
  }, rest), children);
}

/** Header row inside a section: eyebrow label on the left, optional action link on the right. */
function SectionHeader({
  title,
  action,
  onAction,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 'var(--space-4)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-extrabold) var(--text-xs) var(--font-sans)',
      letterSpacing: 'var(--tracking-wider)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, title), action && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onAction,
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      font: 'var(--weight-semibold) var(--text-sm) var(--font-sans)',
      color: 'var(--emerald-500)'
    }
  }, action));
}
Object.assign(__ds_scope, { Card, SectionHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/**
 * Round icon button — the circular control used for back (‹), bell (🔔),
 * and profile actions in screen headers. 36px dark chip with subtle border.
 */
function IconButton({
  children,
  size = 36,
  variant = 'control',
  badge = null,
  onClick,
  ariaLabel,
  style,
  ...rest
}) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const variants = {
    control: {
      bg: 'var(--surface-control)',
      border: 'var(--border-strong)',
      color: 'var(--text-primary)'
    },
    accent: {
      bg: 'var(--emerald-500)',
      border: 'transparent',
      color: '#000'
    },
    ghost: {
      bg: 'transparent',
      border: 'transparent',
      color: 'var(--text-secondary)'
    }
  };
  const v = variants[variant] || variants.control;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": ariaLabel,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    style: {
      position: 'relative',
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: '50%',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: v.bg,
      border: `1px solid ${v.border}`,
      color: v.color,
      fontSize: Math.round(size * 0.44),
      lineHeight: 1,
      cursor: 'pointer',
      filter: hover ? 'brightness(1.15)' : 'none',
      transform: press ? 'scale(0.92)' : 'none',
      transition: 'transform var(--dur-fast) var(--ease-standard), filter var(--dur-fast)',
      ...style
    }
  }, rest), children, badge != null && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 16,
      height: 16,
      padding: '0 3px',
      borderRadius: 8,
      background: 'var(--danger)',
      color: '#fff',
      font: 'var(--weight-extrabold) 9px var(--font-sans)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, typeof badge === 'number' && badge > 9 ? '9+' : badge));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/**
 * Text input — the dark field used across login, search and forms. Resting
 * outline brightens to emerald on focus. Optional leading icon and label.
 */
function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  iconLeft = null,
  error = null,
  disabled = false,
  style,
  inputStyle,
  ...rest
}) {
  const [focus, setFocus] = useState(false);
  const borderColor = error ? 'var(--danger)' : focus ? 'var(--emerald-500)' : 'var(--border-input)';
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginBottom: 8,
      font: 'var(--weight-semibold) var(--text-sm) var(--font-sans)',
      color: 'var(--text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      height: 'var(--control-h)',
      padding: '0 14px',
      background: 'var(--surface-deep)',
      border: `1.5px solid ${borderColor}`,
      borderRadius: 'var(--radius-md)',
      boxShadow: focus && !error ? 'var(--glow-emerald-soft)' : 'none',
      opacity: disabled ? 0.5 : 1,
      transition: 'border-color var(--dur-base) var(--ease-standard), box-shadow var(--dur-base)'
    }
  }, iconLeft && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 16,
      display: 'flex'
    }
  }, iconLeft), /*#__PURE__*/React.createElement("input", _extends({
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      height: '100%',
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: 'var(--text-primary)',
      font: 'var(--weight-medium) var(--text-base) var(--font-sans)',
      ...inputStyle
    }
  }, rest))), error && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: 6,
      font: 'var(--weight-medium) var(--text-xs) var(--font-sans)',
      color: 'var(--danger)'
    }
  }, error));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/esports/KpiTile.jsx
try { (() => {
/**
 * KpiTile — compact metric tile from the dashboard grid. Icon chip, big mono
 * value, small label, optional delta in green/red.
 */
function KpiTile({
  icon,
  value,
  label,
  tone = 'emerald',
  delta = null,
  style
}) {
  const tones = {
    emerald: {
      fg: 'var(--emerald-400)',
      bg: 'var(--emerald-tint-12)'
    },
    danger: {
      fg: '#f87171',
      bg: 'var(--danger-tint)'
    },
    warning: {
      fg: '#fbbf24',
      bg: 'var(--warning-tint)'
    },
    info: {
      fg: '#818cf8',
      bg: 'var(--info-tint)'
    },
    pink: {
      fg: '#f472b6',
      bg: 'var(--pink-tint)'
    }
  };
  const t = tones[tone] || tones.emerald;
  const deltaUp = delta != null && !String(delta).trim().startsWith('-');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-deep)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-2xl)',
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      minWidth: 0,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, icon != null && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 'var(--radius-md)',
      background: t.bg,
      color: t.fg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 17
    }
  }, icon), delta != null && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-bold) var(--text-xs) var(--font-mono)',
      color: deltaUp ? 'var(--emerald-500)' : 'var(--danger)'
    }
  }, deltaUp ? '▲' : '▼', " ", String(delta).replace('-', ''))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-black) var(--text-2xl) var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--text-primary)',
      lineHeight: 1
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 5,
      font: 'var(--weight-semibold) var(--text-xs) var(--font-sans)',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, label)));
}
Object.assign(__ds_scope, { KpiTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/esports/KpiTile.jsx", error: String((e && e.message) || e) }); }

// components/esports/RatingBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * RatingBadge — the colored overall-rating chip on player cards. The fill hue
 * scales with the score (elite emerald → mid amber → low red), mono numerals.
 */
function RatingBadge({
  value,
  size = 'md',
  style,
  ...rest
}) {
  const tier = value >= 90 ? {
    bg: 'var(--emerald-tint-20)',
    fg: 'var(--emerald-400)',
    ring: 'var(--emerald-tint-30)'
  } : value >= 80 ? {
    bg: 'rgba(59,130,246,0.14)',
    fg: '#60a5fa',
    ring: 'rgba(59,130,246,0.3)'
  } : value >= 70 ? {
    bg: 'var(--warning-tint)',
    fg: '#fbbf24',
    ring: 'rgba(245,158,11,0.3)'
  } : {
    bg: 'var(--danger-tint)',
    fg: '#f87171',
    ring: 'rgba(239,68,68,0.3)'
  };
  const sizes = {
    sm: {
      w: 34,
      fs: 14
    },
    md: {
      w: 42,
      fs: 17
    },
    lg: {
      w: 52,
      fs: 22
    }
  };
  const s = sizes[size] || sizes.md;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      width: s.w,
      height: s.w,
      flexShrink: 0,
      borderRadius: 'var(--radius-md)',
      background: tier.bg,
      border: `1px solid ${tier.ring}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: `var(--weight-black) ${s.fs}px var(--font-mono)`,
      fontVariantNumeric: 'tabular-nums',
      color: tier.fg,
      ...style
    }
  }, rest), value);
}
Object.assign(__ds_scope, { RatingBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/esports/RatingBadge.jsx", error: String((e && e.message) || e) }); }

// components/esports/PlayerListItem.jsx
try { (() => {
const {
  useState
} = React;
/**
 * PlayerListItem — the repeating roster/market row: avatar, name + role meta,
 * a status badge, the rating chip, and a trailing chevron / action slot.
 */
function PlayerListItem({
  name,
  role,
  meta,
  rating,
  avatar = null,
  status = null,
  // 'online' | 'injured' | 'suspended'
  statusLabel = null,
  trailing = null,
  onClick,
  style
}) {
  const [hover, setHover] = useState(false);
  const statusTone = {
    online: 'emerald',
    injured: 'danger',
    suspended: 'warning'
  }[status] || 'neutral';
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      background: hover ? 'var(--surface-raised)' : 'var(--surface-deep)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'background var(--dur-fast) var(--ease-standard)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: name,
    src: avatar,
    size: 44,
    status: status
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-bold) var(--text-base) var(--font-sans)',
      color: 'var(--text-primary)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, name), statusLabel && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: statusTone,
    size: "sm",
    dot: true
  }, statusLabel)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 3,
      font: 'var(--weight-medium) var(--text-xs) var(--font-sans)',
      color: 'var(--text-muted)',
      letterSpacing: '0.02em'
    }
  }, role, role && meta ? ' · ' : '', meta)), rating != null && /*#__PURE__*/React.createElement(__ds_scope.RatingBadge, {
    value: rating
  }), trailing != null ? trailing : onClick && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-ghost)',
      fontSize: 20,
      marginLeft: 2
    }
  }, "\u203A"));
}
Object.assign(__ds_scope, { PlayerListItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/esports/PlayerListItem.jsx", error: String((e && e.message) || e) }); }

// components/esports/StatBar.jsx
try { (() => {
/**
 * StatBar — labeled progress meter for player attributes (Aim, Game Sense,
 * Awareness…). Track over dark, fill in a per-attribute hue, mono value.
 */
function StatBar({
  label,
  value,
  max = 100,
  tone = 'emerald',
  showValue = true,
  style
}) {
  const tones = {
    emerald: 'var(--emerald-500)',
    blue: 'var(--accent-blue)',
    purple: 'var(--accent-purple)',
    pink: 'var(--accent-pink)',
    warning: 'var(--warning)'
  };
  const pct = Math.max(0, Math.min(100, value / max * 100));
  const color = tones[tone] || tones.emerald;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-semibold) var(--text-xs) var(--font-sans)',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, label), showValue && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-bold) var(--text-sm) var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--text-primary)'
    }
  }, value)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--surface-control)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${pct}%`,
      height: '100%',
      borderRadius: 'var(--radius-pill)',
      background: color,
      transition: 'width var(--dur-slow) var(--ease-standard)'
    }
  })));
}
Object.assign(__ds_scope, { StatBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/esports/StatBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SegmentedTabs.jsx
try { (() => {
const {
  useState
} = React;
/**
 * SegmentedTabs — the pill segmented control used to switch views (Visão Geral
 * / Elenco / Estatísticas). Active segment is an emerald-tinted chip.
 */
function SegmentedTabs({
  tabs = [],
  value,
  defaultValue,
  onChange,
  fullWidth = true,
  style
}) {
  const [internal, setInternal] = useState(defaultValue ?? (tabs[0] && (tabs[0].id ?? tabs[0])));
  const active = value !== undefined ? value : internal;
  const select = id => {
    if (value === undefined) setInternal(id);
    onChange && onChange(id);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      padding: 4,
      background: 'var(--surface-deep)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-pill)',
      ...style
    }
  }, tabs.map(t => {
    const id = t.id ?? t;
    const label = t.label ?? t;
    const isActive = id === active;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      type: "button",
      onClick: () => select(id),
      style: {
        flex: fullWidth ? 1 : 'initial',
        height: 34,
        padding: '0 16px',
        borderRadius: 'var(--radius-pill)',
        border: 'none',
        cursor: 'pointer',
        background: isActive ? 'var(--emerald-tint-12)' : 'transparent',
        color: isActive ? 'var(--emerald-400)' : 'var(--text-muted)',
        font: `${isActive ? 'var(--weight-bold)' : 'var(--weight-semibold)'} var(--text-sm) var(--font-sans)`,
        letterSpacing: '0.02em',
        boxShadow: isActive ? 'inset 0 0 0 1px var(--emerald-tint-30)' : 'none',
        transition: 'background var(--dur-fast), color var(--dur-fast)',
        whiteSpace: 'nowrap'
      }
    }, label);
  }));
}
Object.assign(__ds_scope, { SegmentedTabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SegmentedTabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/stratify_app/DashboardScreen.jsx
try { (() => {
// DashboardScreen — the home view: top header (wordmark + bell + profile),
// hero next-match card with countdown, KPI row, roster, quick actions, perf bars.
function DashboardScreen({
  onNavigate,
  onOpenNotifs,
  unread
}) {
  const S = window.StratifyDesignSystem_af4c64;
  const {
    Card,
    SectionHeader,
    IconButton,
    PlayerListItem,
    StatBar,
    Avatar
  } = S;
  const d = window.STRATIFY_DATA;
  const fmtMoney = n => '$' + (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : (n / 1e3).toFixed(0) + 'K');
  const avg = (d.roster.reduce((s, p) => s + p.rating, 0) / d.roster.length).toFixed(1);
  const kpis = [{
    value: fmtMoney(d.team.budget),
    label: 'Orçamento',
    sub: 'disponível'
  }, {
    value: '#' + d.team.ranking,
    label: 'Ranking',
    sub: 'global'
  }, {
    value: (d.team.fans / 1000).toFixed(0) + 'K',
    label: 'Fãs',
    sub: 'seguidores'
  }, {
    value: d.team.wins + '-' + d.team.losses,
    label: 'Recorde',
    sub: d.team.wins + d.team.losses + ' partidas'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 18px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--emerald-500)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-black) 18px var(--font-display)',
      letterSpacing: '0.28em',
      color: '#fff',
      paddingLeft: '0.28em'
    }
  }, "STRATIFY")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    badge: unread || null,
    ariaLabel: "Notifica\xE7\xF5es",
    onClick: onOpenNotifs
  }, "\uD83D\uDD14"), /*#__PURE__*/React.createElement(Avatar, {
    name: "Gabriel Souza",
    size: 36
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      padding: '4px 16px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      borderRadius: 'var(--radius-3xl)',
      overflow: 'hidden',
      background: 'var(--gradient-hero)',
      border: '1px solid #1A3D2A',
      boxShadow: 'var(--glow-emerald-soft)',
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--emerald-500)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-extrabold) 10px var(--font-sans)',
      letterSpacing: '0.16em',
      color: 'var(--emerald-400)'
    }
  }, d.nextMatch.badge)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-black) 26px var(--font-display)',
      letterSpacing: '0.02em',
      color: '#fff',
      lineHeight: 1.05
    }
  }, d.nextMatch.title), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4,
      font: 'var(--weight-medium) 14px var(--font-sans)',
      color: 'var(--text-secondary)'
    }
  }, d.nextMatch.opponent), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 10,
      margin: '18px 0'
    }
  }, d.nextMatch.countdown.map((c, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-black) 22px var(--font-mono)',
      color: 'var(--text-ghost)',
      paddingBottom: 14
    }
  }, ":"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid var(--border-strong)',
      borderRadius: 'var(--radius-md)',
      padding: '8px 12px',
      textAlign: 'center',
      minWidth: 52
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-black) 22px var(--font-mono)',
      color: '#fff',
      fontVariantNumeric: 'tabular-nums'
    }
  }, String(c.v).padStart(2, '0')), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-bold) 8px var(--font-sans)',
      letterSpacing: '0.1em',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, c.l))))), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-black) 12px var(--font-sans)',
      letterSpacing: '0.08em',
      color: 'var(--emerald-400)',
      cursor: 'pointer'
    }
  }, "VER DETALHES  \u2192")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2,1fr)',
      gap: 10
    }
  }, kpis.map((k, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: 'var(--surface-deep)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-2xl)',
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-black) 24px var(--font-mono)',
      color: '#fff',
      fontVariantNumeric: 'tabular-nums',
      lineHeight: 1
    }
  }, k.value), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      font: 'var(--weight-bold) 11px var(--font-sans)',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: 'var(--text-secondary)'
    }
  }, k.label), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-medium) 10px var(--font-sans)',
      color: 'var(--text-faint)'
    }
  }, k.sub)))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(SectionHeader, {
    title: "Time Principal",
    action: "gerenciar"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-black) 16px var(--font-display)',
      letterSpacing: '0.02em',
      color: '#fff'
    }
  }, d.team.name), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-bold) 10px var(--font-mono)',
      color: 'var(--emerald-400)',
      background: 'var(--emerald-tint-12)',
      border: '1px solid var(--emerald-tint-30)',
      borderRadius: 'var(--radius-pill)',
      padding: '3px 8px'
    }
  }, avg, " AVG")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, d.roster.map(p => /*#__PURE__*/React.createElement(PlayerListItem, {
    key: p.id,
    name: p.name,
    role: p.role,
    rating: p.rating,
    status: p.status === 'banned' ? 'suspended' : p.status,
    statusLabel: p.statusLabel
  })))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-extrabold) 11px var(--font-sans)',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      marginBottom: 12
    }
  }, "A\xE7\xF5es R\xE1pidas"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2,1fr)',
      gap: 10
    }
  }, d.actions.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: () => a.screen && onNavigate(a.screen),
    style: {
      background: 'var(--surface-deep)',
      border: `1px solid color-mix(in srgb, ${a.accent} 30%, transparent)`,
      borderRadius: 'var(--radius-2xl)',
      padding: 14,
      cursor: a.screen ? 'pointer' : 'default'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--radius-md)',
      background: `color-mix(in srgb, ${a.accent} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 19,
      marginBottom: 10
    }
  }, a.icon), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-black) 13px var(--font-sans)',
      letterSpacing: '0.06em',
      color: a.accent
    }
  }, a.label), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-medium) 11px var(--font-sans)',
      color: 'var(--text-faint)',
      marginTop: 2
    }
  }, a.sub))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(SectionHeader, {
    title: "Performance"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, d.performance.map((m, i) => /*#__PURE__*/React.createElement(StatBar, {
    key: i,
    label: m.label,
    value: m.value,
    tone: m.tone
  }))))));
}
window.DashboardScreen = DashboardScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/stratify_app/DashboardScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/stratify_app/LoginScreen.jsx
try { (() => {
// LoginScreen — dark auth screen: logo crest, wordmark, tagline, email/password
// fields with emerald focus, forgot link, primary CTA, signup footer.
function LoginScreen({
  onLogin
}) {
  const {
    Button,
    Input
  } = window.StratifyDesignSystem_af4c64;
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const submit = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin && onLogin();
    }, 900);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '0 24px',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--bg-glow-emerald)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      textAlign: 'center',
      marginBottom: 36
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/stratify-logo.png",
    alt: "Stratify",
    style: {
      height: 84,
      marginBottom: 14
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-black) 26px var(--font-display)',
      letterSpacing: '0.32em',
      color: '#fff',
      paddingLeft: '0.32em'
    }
  }, "STRATIFY"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      font: 'var(--weight-medium) 13px var(--font-sans)',
      color: 'var(--text-muted)'
    }
  }, "Gerencie seu time. Conquiste o topo.")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "E-mail",
    type: "email",
    placeholder: "usuario@esports.gg",
    value: email,
    onChange: e => setEmail(e.target.value)
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Senha",
    type: "password",
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    value: password,
    onChange: e => setPassword(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right',
      marginTop: -4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-semibold) 12px var(--font-sans)',
      color: 'var(--emerald-500)',
      cursor: 'pointer'
    }
  }, "Esqueceu a senha?")), /*#__PURE__*/React.createElement(Button, {
    fullWidth: true,
    size: "lg",
    loading: loading,
    onClick: submit
  }, loading ? 'Entrando' : 'Entrar')), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      textAlign: 'center',
      marginTop: 28,
      font: 'var(--weight-medium) 13px var(--font-sans)',
      color: 'var(--text-muted)'
    }
  }, "N\xE3o tem conta? ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--emerald-500)',
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Criar time")));
}
window.LoginScreen = LoginScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/stratify_app/LoginScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/stratify_app/MarketScreen.jsx
try { (() => {
// MarketScreen — transfer market: header w/ back + budget pill, search, role
// filter pills, segmented sort, auction cards (rating, timer, current bid).
// Tapping a card opens a bid bottom-sheet with the player's skill bars.
function MarketScreen({
  onBack
}) {
  const S = window.StratifyDesignSystem_af4c64;
  const {
    IconButton,
    Input,
    Badge,
    RatingBadge,
    StatBar,
    Button,
    SegmentedTabs
  } = S;
  const d = window.STRATIFY_DATA;
  const [search, setSearch] = React.useState('');
  const [role, setRole] = React.useState(null);
  const [detail, setDetail] = React.useState(null);
  const fmt = n => '$' + (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : (n / 1e3).toFixed(0) + 'K');
  const list = d.market.filter(p => (!role || p.role === role) && (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.team.toLowerCase().includes(search.toLowerCase())));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 16px',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    ariaLabel: "Voltar",
    onClick: onBack
  }, "\u2039"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: 'var(--emerald-500)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-black) 16px var(--font-display)',
      letterSpacing: '0.2em',
      color: '#fff',
      paddingLeft: '0.2em'
    }
  }, "MERCADO")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right',
      background: 'var(--surface-deep)',
      border: '1px solid var(--border-strong)',
      borderRadius: 'var(--radius-md)',
      padding: '6px 10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-bold) 8px var(--font-sans)',
      letterSpacing: '0.08em',
      color: 'var(--text-muted)'
    }
  }, "OR\xC7AMENTO"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-black) 13px var(--font-mono)',
      color: 'var(--emerald-400)'
    }
  }, fmt(d.team.budget)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Input, {
    iconLeft: "\uD83D\uDD0D",
    placeholder: "Buscar jogador ou time...",
    value: search,
    onChange: e => setSearch(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      overflowX: 'auto',
      paddingBottom: 2
    }
  }, [null, ...d.roles].map((r, i) => {
    const active = role === r;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      onClick: () => setRole(r),
      style: {
        flexShrink: 0,
        height: 30,
        padding: '0 14px',
        borderRadius: 'var(--radius-pill)',
        cursor: 'pointer',
        background: active ? 'var(--emerald-tint-12)' : 'var(--surface-control)',
        border: `1px solid ${active ? 'var(--emerald-tint-30)' : 'var(--border-strong)'}`,
        color: active ? 'var(--emerald-400)' : 'var(--text-muted)',
        font: 'var(--weight-bold) 11px var(--font-sans)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase'
      }
    }, r || 'Todos');
  })), /*#__PURE__*/React.createElement(SegmentedTabs, {
    tabs: [{
      id: 't',
      label: 'Tempo'
    }, {
      id: 'b',
      label: 'Lance'
    }, {
      id: 'r',
      label: 'Rating'
    }],
    defaultValue: "t"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      paddingBottom: 24
    }
  }, list.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    onClick: () => setDetail(p),
    style: {
      background: 'var(--surface-deep)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-2xl)',
      padding: 14,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(RatingBadge, {
    value: p.rating,
    size: "lg"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-bold) 16px var(--font-sans)',
      color: '#fff'
    }
  }, p.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "info",
    size: "sm"
  }, p.role), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-medium) 11px var(--font-sans)',
      color: 'var(--text-faint)'
    }
  }, p.team))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      font: 'var(--weight-bold) 12px var(--font-mono)',
      color: 'var(--danger)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11
    }
  }, "\u23F1"), p.endsAt)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingTop: 12,
      borderTop: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-semibold) 9px var(--font-sans)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, "Lance atual"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-black) 18px var(--font-mono)',
      color: '#fff'
    }
  }, fmt(p.bid))), p.bidder ? /*#__PURE__*/React.createElement(Badge, {
    tone: p.bidder === 'Você' ? 'emerald' : 'neutral',
    dot: p.bidder === 'Você'
  }, p.bidder === 'Você' ? 'Seu lance' : p.bidder) : /*#__PURE__*/React.createElement(Badge, {
    tone: "emerald",
    variant: "solid"
  }, "Sem lances")))), list.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '40px 0',
      color: 'var(--text-faint)',
      font: 'var(--weight-medium) 13px var(--font-sans)'
    }
  }, "Nenhum jogador encontrado"))), detail && /*#__PURE__*/React.createElement(BidSheet, {
    player: detail,
    fmt: fmt,
    onClose: () => setDetail(null)
  }));
}
function BidSheet({
  player,
  fmt,
  onClose
}) {
  const {
    Button,
    RatingBadge,
    StatBar,
    Badge
  } = window.StratifyDesignSystem_af4c64;
  const next = player.bid + 200000;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--surface-overlay)',
      display: 'flex',
      alignItems: 'flex-end',
      zIndex: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      background: 'var(--surface-deep)',
      borderTopLeftRadius: 'var(--radius-sheet)',
      borderTopRightRadius: 'var(--radius-sheet)',
      borderTop: '1px solid var(--border-strong)',
      boxShadow: 'var(--shadow-sheet)',
      padding: '14px 20px 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 2,
      background: 'var(--border-input)',
      margin: '0 auto 18px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(RatingBadge, {
    value: player.rating,
    size: "lg"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-black) 18px var(--font-sans)',
      color: '#fff'
    }
  }, player.name), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "info",
    size: "sm"
  }, player.role), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-medium) 11px var(--font-sans)',
      color: 'var(--text-faint)'
    }
  }, player.team))), /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      color: 'var(--text-muted)',
      fontSize: 18,
      cursor: 'pointer',
      padding: 4
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 13,
      marginBottom: 18
    }
  }, Object.entries(player.skills).map(([k, v]) => /*#__PURE__*/React.createElement(StatBar, {
    key: k,
    label: k,
    value: v,
    tone: v >= 90 ? 'emerald' : v >= 80 ? 'blue' : 'warning'
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      padding: '12px 14px',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-semibold) 9px var(--font-sans)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, "Pr\xF3ximo lance m\xEDnimo"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-black) 22px var(--font-mono)',
      color: 'var(--emerald-400)'
    }
  }, fmt(next))), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-medium) 11px var(--font-mono)',
      color: 'var(--danger)'
    }
  }, "\u23F1 ", player.endsAt)), /*#__PURE__*/React.createElement(Button, {
    fullWidth: true,
    size: "lg",
    onClick: onClose
  }, "Dar Lance \xB7 ", fmt(next))));
}
window.MarketScreen = MarketScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/stratify_app/MarketScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/stratify_app/data.js
try { (() => {
// Mock data for the Stratify app UI kit — mirrors the real Supabase schema
// (teams, players, notifications, auctions) with stand-in content.

window.STRATIFY_DATA = {
  team: {
    name: 'BLACKOUT',
    budget: 8400000,
    ranking: 12,
    fans: 248000,
    wins: 34,
    losses: 11
  },
  nextMatch: {
    badge: 'PRÓXIMA PARTIDA',
    title: 'FINAL DO TORNEIO',
    opponent: 'vs. Team Liquid',
    countdown: [{
      v: 2,
      l: 'DIAS'
    }, {
      v: 14,
      l: 'HRS'
    }, {
      v: 32,
      l: 'MIN'
    }]
  },
  roster: [{
    id: 1,
    name: 'Gabriel Souza',
    role: 'IGL · Rifler',
    status: 'online',
    statusLabel: 'Online',
    rating: 91
  }, {
    id: 2,
    name: 'Rafael Costa',
    role: 'AWPer',
    status: 'online',
    statusLabel: 'Online',
    rating: 88
  }, {
    id: 3,
    name: 'Lucas Lima',
    role: 'Entry Fragger',
    status: 'injured',
    statusLabel: 'Lesão',
    rating: 79
  }, {
    id: 4,
    name: 'Pedro Alves',
    role: 'Support',
    status: 'online',
    statusLabel: 'Online',
    rating: 84
  }, {
    id: 5,
    name: 'Matheus Rocha',
    role: 'Lurker',
    status: 'banned',
    statusLabel: 'Banido',
    rating: 72
  }],
  performance: [{
    label: 'Moral',
    value: 85,
    tone: 'emerald'
  }, {
    label: 'Forma',
    value: 92,
    tone: 'blue'
  }, {
    label: 'Hype',
    value: 78,
    tone: 'warning'
  }, {
    label: 'Comunicação',
    value: 70,
    tone: 'pink'
  }],
  actions: [{
    icon: '🎯',
    label: 'TREINAR',
    sub: 'Melhorar skills',
    accent: 'var(--emerald-500)',
    screen: 'training'
  }, {
    icon: '🏪',
    label: 'MERCADO',
    sub: 'Contratar jogadores',
    accent: 'var(--info)',
    screen: 'market'
  }, {
    icon: '📋',
    label: 'TÁTICAS',
    sub: 'Estratégias do time',
    accent: 'var(--warning)',
    screen: null
  }, {
    icon: '🎮',
    label: 'PARTIDAS',
    sub: 'Ver calendário',
    accent: 'var(--accent-pink)',
    screen: null
  }],
  notifications: [{
    id: 1,
    type: 'success',
    tag: 'TRANSFERÊNCIA',
    message: 'Sua proposta por "kRavenz" foi aceita. Bem-vindo ao time!',
    read: false,
    date: '24 jun · 14:32'
  }, {
    id: 2,
    type: 'alert',
    tag: 'LESÃO',
    message: 'Lucas Lima sofreu uma lesão e ficará 3 dias indisponível.',
    read: false,
    date: '24 jun · 09:10'
  }, {
    id: 3,
    type: 'info',
    tag: 'MERCADO',
    message: 'Novo leilão aberto: AWPer rating 90 disponível por 6h.',
    read: true,
    date: '23 jun · 21:45'
  }],
  market: [{
    id: 11,
    name: 'kRavenz',
    role: 'AWPer',
    team: 'Free Agent',
    rating: 92,
    bid: 4200000,
    bidder: 'MIBR',
    endsAt: '02:14:08',
    skills: {
      Mira: 95,
      'Game Sense': 88,
      Awareness: 90
    }
  }, {
    id: 12,
    name: 'b1t0',
    role: 'Rifler',
    team: 'Pain Gaming',
    rating: 86,
    bid: 2800000,
    bidder: 'Você',
    endsAt: '05:41:22',
    skills: {
      Mira: 84,
      'Game Sense': 89,
      Awareness: 82
    }
  }, {
    id: 13,
    name: 'zelW',
    role: 'IGL',
    team: 'Imperial',
    rating: 83,
    bid: 1900000,
    bidder: 'LOUD',
    endsAt: '11:08:55',
    skills: {
      Mira: 72,
      'Game Sense': 94,
      Awareness: 88
    }
  }, {
    id: 14,
    name: 'noxiD',
    role: 'Support',
    team: 'Free Agent',
    rating: 77,
    bid: 950000,
    bidder: null,
    endsAt: '18:30:00',
    skills: {
      Mira: 70,
      'Game Sense': 80,
      Awareness: 84
    }
  }],
  roles: ['AWPer', 'Rifler', 'IGL', 'Entry', 'Support']
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/stratify_app/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.SectionHeader = __ds_scope.SectionHeader;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.KpiTile = __ds_scope.KpiTile;

__ds_ns.PlayerListItem = __ds_scope.PlayerListItem;

__ds_ns.RatingBadge = __ds_scope.RatingBadge;

__ds_ns.StatBar = __ds_scope.StatBar;

__ds_ns.SegmentedTabs = __ds_scope.SegmentedTabs;

})();
