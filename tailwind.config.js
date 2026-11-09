import colors from 'tailwindcss/colors';

// Charte SIGTB : terre de bauxite (laterite), acier industriel, pierre.
// Les palettes Tailwind utilisees par les ecrans sont redefinies ici pour
// que tout l'outil adopte la charte sans reecrire chaque composant :
//  - orange : rouille de bauxite (couleur de marque) ;
//  - blue   : acier (information, actions secondaires) ;
//  - slate et gray : pierre chaude.
// red (danger), green (succes) et yellow (alerte) gardent leur sens.
const bauxite = {
  50: '#fdf5f1',
  100: '#fae6dc',
  200: '#f4c9b4',
  300: '#eaa284',
  400: '#dc7650',
  500: '#c95a32',
  600: '#b04524',
  700: '#8f371f',
  800: '#732e1e',
  900: '#5e281c',
  950: '#33130c',
};

const acier = {
  50: '#f2f6f8',
  100: '#e1eaef',
  200: '#c5d6df',
  300: '#9cb9c8',
  400: '#6c95aa',
  500: '#4d7a90',
  600: '#3d6378',
  700: '#345163',
  800: '#2f4553',
  900: '#2a3b47',
  950: '#1b2630',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        orange: bauxite,
        bauxite,
        blue: acier,
        acier,
        slate: colors.stone,
        gray: colors.stone,
        ocre: colors.amber,
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
