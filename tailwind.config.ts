import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
      },
      screens: {
        "2xl": "1200px",
      },
    },
    colors: {
      border: {
        DEFAULT: "hsl(var(--hairline))",
        soft: "hsl(var(--hairline-soft))",
      },
      input: "hsl(var(--hairline))",
      ring: "hsl(var(--ink))",
      background: "hsl(var(--canvas))",
      foreground: "hsl(var(--ink))",
      ink: "hsl(var(--ink))",
      body: "hsl(var(--body))",
      muted: "hsl(var(--muted))",
      "muted-soft": "hsl(var(--muted-soft))",
      canvas: "hsl(var(--canvas))",
      hairline: "hsl(var(--hairline))",
      "hairline-soft": "hsl(var(--hairline-soft))",
      primary: {
        DEFAULT: "hsl(var(--primary))",
        foreground: "hsl(var(--on-primary))",
        active: "hsl(var(--primary-active))",
        disabled: "hsl(var(--primary-disabled))",
      },
      secondary: {
        DEFAULT: "hsl(var(--surface-soft))",
        foreground: "hsl(var(--ink))",
      },
      destructive: {
        DEFAULT: "hsl(var(--error))",
        foreground: "hsl(var(--on-primary))",
      },
      accent: {
        DEFAULT: "hsl(var(--brand-accent))",
        foreground: "hsl(var(--on-primary))",
      },
      popover: {
        DEFAULT: "hsl(var(--canvas))",
        foreground: "hsl(var(--ink))",
      },
      card: {
        DEFAULT: "hsl(var(--surface-card))",
        foreground: "hsl(var(--ink))",
      },
      surface: {
        canvas: "hsl(var(--canvas))",
        soft: "hsl(var(--surface-soft))",
        card: "hsl(var(--surface-card))",
        strong: "hsl(var(--surface-strong))",
        dark: "hsl(var(--surface-dark))",
        "dark-elevated": "hsl(var(--surface-dark-elevated))",
      },
      semantic: {
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        error: "hsl(var(--error))",
      },
      badge: {
        orange: "hsl(var(--badge-orange))",
        pink: "hsl(var(--badge-pink))",
        violet: "hsl(var(--badge-violet))",
        emerald: "hsl(var(--badge-emerald))",
      },
      on: {
        primary: "hsl(var(--on-primary))",
        dark: "hsl(var(--on-dark))",
        "dark-soft": "hsl(var(--on-dark-soft))",
      },
    },
    fontFamily: {
      display: ["var(--font-display)", "Inter", "ui-sans-serif", "system-ui"],
      sans: ["var(--font-sans)", "Inter", "ui-sans-serif", "system-ui"],
      mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
    },
    fontSize: {
      "display-xl": ["64px", { lineHeight: "1.05", letterSpacing: "-0.031em", fontWeight: "600" }],
      "display-lg": ["48px", { lineHeight: "1.1", letterSpacing: "-0.023em", fontWeight: "600" }],
      "display-md": ["36px", { lineHeight: "1.15", letterSpacing: "-0.016em", fontWeight: "600" }],
      "display-sm": ["28px", { lineHeight: "1.2", letterSpacing: "-0.008em", fontWeight: "600" }],
      "title-lg": ["22px", { lineHeight: "1.3", letterSpacing: "-0.005em", fontWeight: "600" }],
      "title-md": ["18px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "600" }],
      "title-sm": ["16px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "600" }],
      "body-md": ["16px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "400" }],
      "body-sm": ["14px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "400" }],
      caption: ["13px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "500" }],
      code: ["14px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "400" }],
      button: ["14px", { lineHeight: "1", letterSpacing: "0", fontWeight: "600" }],
      "nav-link": ["14px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "500" }],
    },
    extend: {
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
        xs: "var(--radius-xs)",
        xl: "var(--radius-xl)",
        pill: "9999px",
      },
      spacing: {
        xxs: "4px",
        xs: "8px",
        sm: "12px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        xxl: "48px",
        section: "96px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
