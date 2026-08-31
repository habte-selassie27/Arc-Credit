/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#000000",
        "bone-white": "#ffffff",
        "ash-gray": "#9a9a9a",
        "silver-mist": "#bdbdbd",
        "electric-iris": "#8052ff",
        "saffron-spark": "#ffb829",
        "deep-verdant": "#15846e",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      fontSize: {
        caption: ["12px", { lineHeight: "1.5" }],
        "nav-label": [
          "14px",
          { lineHeight: "1.2", letterSpacing: "0.025em" },
        ],
        body: ["18px", { lineHeight: "1.5" }],
        "heading-2xs": ["24px", { lineHeight: "1.25", letterSpacing: "-0.02em" }],
        "heading-xs": ["27px", { lineHeight: "1" }],
        subheading: ["36px", { lineHeight: "1.2" }],
        "heading-sm": ["42px", { lineHeight: "1.2", letterSpacing: "-0.04em" }],
        heading: ["48px", { lineHeight: "1.1", letterSpacing: "-0.035em" }],
        "heading-lg": ["78px", { lineHeight: "1.1", letterSpacing: "-0.04em" }],
        display: ["113px", { lineHeight: "1.1", letterSpacing: "-0.04em" }],
      },
      spacing: {
        6: "6px",
        12: "12px",
        18: "18px",
        24: "24px",
        30: "30px",
        36: "36px",
        60: "60px",
        96: "96px",
        120: "120px",
      },
      borderRadius: {
        "3xl": "24px",
        full: "9999px",
      },
      maxWidth: {
        page: "1280px",
      },
    },
  },
  plugins: [],
};
