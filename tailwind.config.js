import colors from 'tailwindcss/colors';

// Charte SIGTB (maquettes du proprietaire, 2026-11-09, D-018) :
//  - orange : orange bauxite des maquettes (actions, accents, marque) ;
//  - bauxite : bruns profonds du menu lateral et des bandeaux ;
//  - slate et gray : pierre chaude (neutres) ;
//  - blue, green, red, purple, yellow : couleurs semantiques standard
//    (indicateurs et statuts, comme sur les maquettes).
const orangeSigtb = {
  50: '#fff5ed',
  100: '#ffe8d5',
  200: '#fdcaa5',
  300: '#fba56b',
  400: '#f6853a',
  500: '#ec6b1b',
  600: '#d45513',
  700: '#ad4212',
  800: '#8a3616',
  900: '#702f16',
  950: '#3d1508',
};

const bauxite = {
  50: '#fbf4f1',
  100: '#f4e3dc',
  200: '#e7c3b3',
  300: '#d49a82',
  400: '#bb6f52',
  500: '#9c5236',
  600: '#7e3f28',
  700: '#62301f',
  800: '#4a2418',
  900: '#361a12',
  950: '#22100b',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        orange: orangeSigtb,
        bauxite,
        slate: colors.stone,
        gray: colors.stone,
        sable: '#faf6f2',
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        carte: '0 1px 2px rgba(54, 26, 18, 0.06), 0 4px 16px rgba(54, 26, 18, 0.06)',
      },
    },
  },
  plugins: [],
};
