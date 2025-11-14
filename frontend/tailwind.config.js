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
          primary: "#000000",
          secondary: "#0A0A0A",
          tertiary: "#141414",
          hover: "#1A1A1A",
        },
        text: {
          primary: "#FFFFFF",
          secondary: "#A3A3A3",
          tertiary: "#525252",
        },
        accent: {
          primary: "#FFFFFF",
          border: "#262626",
          success: "#22C55E",
          error: "#EF4444",
          warning: "#F59E0B",
        },
      },
      fontFamily: {
        mono: ["'SF Mono'", "'Fira Code'", "'Roboto Mono'", "Consolas", "monospace"],
      },
      animation: {
        "pulse-border": "pulse-border 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
      },
      keyframes: {
        "pulse-border": {
          "0%, 100%": { borderColor: "#262626" },
          "50%": { borderColor: "#FFFFFF" },
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