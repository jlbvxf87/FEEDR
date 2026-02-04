/**
 * FEEDR Design Token System
 * Single source of truth for all visual styling
 * 
 * RULE: Never use raw hex codes in components.
 * Import tokens from this file instead.
 */

// ============================================
// COLORS
// ============================================

export const colors = {
  // Backgrounds
  bg: {
    primary: "#0B0E11",      // Main app background
    surface: "#11151C",      // Cards, panels, inputs
    elevated: "#161B24",     // Hover states, elevated surfaces
  },
  
  // Borders & Dividers
  border: {
    default: "#1C2230",      // Standard borders
    subtle: "#151A23",       // Subtle dividers
    focus: "rgba(46, 230, 201, 0.3)", // Focus rings
  },
  
  // Text
  text: {
    primary: "#FFFFFF",      // Primary text
    secondary: "#9CA3AF",    // Secondary text
    muted: "#6B7280",        // Muted text
    disabled: "#4B5563",     // Disabled/placeholder
  },
  
  // Brand Accent (Gradient)
  accent: {
    teal: "#2EE6C9",         // Primary accent
    cyan: "#1FB6FF",         // Secondary accent
    blue: "#3A7CFF",         // Electric blue
  },
  
  // Semantic
  semantic: {
    success: "#22C55E",      // Winner green
    danger: "#FF4D4F",       // Kill red
    warning: "#F59E0B",      // Warning amber
  },
} as const;

// ============================================
// GRADIENTS
// ============================================

export const gradients = {
  // Primary brand gradient (buttons, selected states)
  primary: "linear-gradient(135deg, #2EE6C9 0%, #1FB6FF 100%)",
  
  // Subtle glow gradient (backgrounds)
  glow: "radial-gradient(circle, rgba(46, 230, 201, 0.08) 0%, transparent 70%)",
  
  // Grid pattern
  grid: `
    linear-gradient(rgba(46, 230, 201, 0.5) 1px, transparent 1px),
    linear-gradient(90deg, rgba(46, 230, 201, 0.5) 1px, transparent 1px)
  `,
} as const;

// ============================================
// EFFECTS (Glow & Shadows)
// ============================================

export const effects = {
  // Glow intensities
  glow: {
    subtle: "0 0 20px rgba(46, 230, 201, 0.1)",
    medium: "0 0 20px rgba(46, 230, 201, 0.15), 0 0 40px rgba(31, 182, 255, 0.1)",
    strong: "0 0 30px rgba(46, 230, 201, 0.25), 0 0 60px rgba(31, 182, 255, 0.15)",
  },
  
  // Focus ring
  focusRing: "0 0 0 1px rgba(46, 230, 201, 0.3), 0 0 20px rgba(46, 230, 201, 0.1)",
  
  // Card hover
  cardHover: "0 10px 40px rgba(0, 0, 0, 0.3)",
} as const;

// ============================================
// ANIMATION (Terminal-grade: fast, subtle)
// ============================================

export const animation = {
  // Durations
  duration: {
    instant: "100ms",
    fast: "150ms",
    normal: "200ms",
    slow: "300ms",
  },
  
  // Easings
  easing: {
    default: "cubic-bezier(0.4, 0, 0.2, 1)",
    snap: "cubic-bezier(0.2, 0, 0, 1)",
    smooth: "cubic-bezier(0.4, 0, 0.6, 1)",
  },
} as const;

// ============================================
// SPACING
// ============================================

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  xxl: "32px",
  section: "48px",
} as const;

// ============================================
// TYPOGRAPHY
// ============================================

export const typography = {
  // Font sizes
  size: {
    xs: "11px",
    sm: "12px",
    base: "14px",
    lg: "16px",
    xl: "18px",
    xxl: "20px",
  },
  
  // Font weights
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  
  // Letter spacing for uppercase labels
  tracking: {
    normal: "0",
    wide: "0.05em",
    wider: "0.1em",
    widest: "0.2em",
  },
} as const;

// ============================================
// BORDER RADIUS
// ============================================

export const radius = {
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px",
} as const;

// ============================================
// PRESET TILE GRADIENTS (for visual variety)
// ============================================

export const presetGradients: Record<string, string> = {
  AUTO: `linear-gradient(135deg, ${colors.accent.teal} 0%, ${colors.accent.cyan} 100%)`,
  RAW_UGC_V1: "linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)",
  TIKTOK_AD_V1: "linear-gradient(135deg, #FF4D4F 0%, #E11D48 100%)",
  PODCAST_V1: "linear-gradient(135deg, #3A7CFF 0%, #2563EB 100%)",
  SENSORY_V1: "linear-gradient(135deg, #10B981 0%, #2EE6C9 100%)",
  CLEAN_V1: "linear-gradient(135deg, #64748B 0%, #475569 100%)",
  STORY_V1: "linear-gradient(135deg, #6366F1 0%, #3A7CFF 100%)",
  HOOK_V1: "linear-gradient(135deg, #FF4D4F 0%, #F97316 100%)",
  MINIMAL_V1: "linear-gradient(135deg, #737373 0%, #525252 100%)",
} as const;

// ============================================
// CSS CLASS RECIPES (for consistent styling)
// ============================================

export const recipes = {
  // Primary gradient button
  buttonPrimary: `
    feedr-gradient 
    text-[${colors.bg.primary}] 
    font-semibold 
    uppercase 
    tracking-wider 
    rounded-lg 
    transition-all 
    duration-200 
    hover:opacity-90 
    disabled:opacity-40 
    disabled:cursor-not-allowed
  `,
  
  // Secondary button
  buttonSecondary: `
    bg-[${colors.bg.surface}] 
    border 
    border-[${colors.border.default}] 
    text-[${colors.text.secondary}] 
    rounded-lg 
    transition-all 
    duration-200 
    hover:bg-[${colors.bg.elevated}] 
    hover:text-[${colors.text.primary}]
  `,
  
  // Input field
  input: `
    bg-[${colors.bg.surface}] 
    border 
    border-[${colors.border.default}] 
    text-[${colors.text.primary}] 
    placeholder:text-[${colors.text.disabled}] 
    rounded-lg 
    transition-all 
    duration-200 
    focus:outline-none 
    focus:border-[${colors.border.focus}] 
    feedr-input-glow
  `,
  
  // Card/Panel
  card: `
    bg-[${colors.bg.surface}] 
    border 
    border-[${colors.border.default}] 
    rounded-xl
  `,
  
  // Label (uppercase tracking)
  label: `
    text-xs 
    font-medium 
    text-[${colors.text.muted}] 
    uppercase 
    tracking-wider
  `,
} as const;

// ============================================
// FEEDR VOICE (Copy guidelines)
// ============================================

export const voice = {
  // Actions
  actions: {
    generate: "FEED",
    loading: "COOKING...",
    download: "DOWNLOAD",
    kill: "KILL",
    winner: "WINNER",
    enter: "ENTER",
    exit: "EXIT",
    create: "CREATE",
  },
  
  // States
  states: {
    inProgress: "Feeding the line...",
    complete: "Tray is full",
    empty: "Type something above and hit FEED",
    error: "Something broke. Try again.",
  },
  
  // Manufacturing steps
  steps: {
    interpret: "Reading intent",
    style: "Selecting style",
    scripts: "Writing scripts",
    voice: "Recording voice",
    render: "Rendering video",
    assemble: "Assembling clips",
  },
} as const;

// Type exports for strict typing
export type ColorKey = keyof typeof colors;
export type GradientKey = keyof typeof gradients;
export type EffectKey = keyof typeof effects;
