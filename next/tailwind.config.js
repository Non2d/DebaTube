/** @type {import('tailwindcss').Config} */
module.exports = {
  purge: {
    enabled: false,
    // content: [
    //   "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    //   "./components/**/*.{js,ts,jsx,tsx,mdx}",
    //   "./app/**/*.{js,ts,jsx,tsx,mdx}",
    // ]
  },
  theme: {
    extend: {
      spacing: {
        "128": "32rem",
        "144": "36rem",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      borderWidth: {
        "1": "1px",
        "3": "3px",
        "5": "5px",
      }
    },
  },
  plugins: [],
};
