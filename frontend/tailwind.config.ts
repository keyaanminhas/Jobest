import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        paper: "#f4f7fb",
        line: "#d7dfec",
        accent: "#1d4ed8",
        mint: "#1f9d74",
        amber: "#d68a11",
        coral: "#dc4b4b",
      },
      boxShadow: {
        panel: "0 18px 60px rgba(17, 43, 94, 0.08)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      backgroundImage: {
        aura: "radial-gradient(circle at top left, rgba(29,78,216,0.14), transparent 32%), radial-gradient(circle at top right, rgba(31,157,116,0.08), transparent 24%)",
      },
      fontFamily: {
        heading: ["var(--font-manrope)"],
        body: ["var(--font-plex)"],
      },
    },
  },
  plugins: [],
};

export default config;
