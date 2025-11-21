/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#020202",
          secondary: "rgba(255,255,255,0.04)",
          tertiary: "rgba(255,255,255,0.08)",
          hover: "rgba(255,255,255,0.14)",
        },
        text: {
          primary: "#FFFFFF",
          secondary: "rgba(255,255,255,0.78)",
          tertiary: "rgba(255,255,255,0.48)",
        },
        accent: {
          primary: "#FFFFFF",
          border: "rgba(255,255,255,0.18)",
          success: "#8FFFBE",
          error: "#FF8FA3",
          warning: "#F5E960",
        },
      },
      fontFamily: {
        sans: ['"Geist"', "Inter", "system-ui", "sans-serif"],
        mono: ["'SF Mono'", "'Fira Code'", "'Roboto Mono'", "Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 25px 80px rgba(0,0,0,0.65)",
        "inner-glow": "inset 0 0 0 1px rgba(255,255,255,0.08)",
      },
      animation: {
        "pulse-border": "pulse-border 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 12s ease-in-out infinite",
        shine: "shine 8s linear infinite",
        "pulse-glow": "pulseGlow 6s ease-in-out infinite",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
      },
      keyframes: {
        "pulse-border": {
          "0%, 100%": { borderColor: "rgba(255,255,255,0.12)" },
          "50%": { borderColor: "rgba(255,255,255,0.4)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px) scale(1)" },
          "50%": { transform: "translateY(-18px) scale(1.01)" },
        },
        shine: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(200%)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "0.95" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}