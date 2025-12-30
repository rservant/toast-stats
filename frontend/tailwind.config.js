/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Toastmasters Brand Colors
      colors: {
        'tm-loyal-blue': 'var(--tm-loyal-blue)',
        'tm-true-maroon': 'var(--tm-true-maroon)',
        'tm-cool-gray': 'var(--tm-cool-gray)',
        'tm-happy-yellow': 'var(--tm-happy-yellow)',
        'tm-black': 'var(--tm-black)',
        'tm-white': 'var(--tm-white)',
        // Color opacity variations
        'tm-loyal-blue-90': 'var(--tm-loyal-blue-90)',
        'tm-loyal-blue-80': 'var(--tm-loyal-blue-80)',
        'tm-loyal-blue-70': 'var(--tm-loyal-blue-70)',
        'tm-loyal-blue-60': 'var(--tm-loyal-blue-60)',
        'tm-loyal-blue-50': 'var(--tm-loyal-blue-50)',
        'tm-loyal-blue-40': 'var(--tm-loyal-blue-40)',
        'tm-loyal-blue-30': 'var(--tm-loyal-blue-30)',
        'tm-loyal-blue-20': 'var(--tm-loyal-blue-20)',
        'tm-loyal-blue-10': 'var(--tm-loyal-blue-10)',
        'tm-true-maroon-90': 'var(--tm-true-maroon-90)',
        'tm-true-maroon-80': 'var(--tm-true-maroon-80)',
        'tm-true-maroon-70': 'var(--tm-true-maroon-70)',
        'tm-true-maroon-60': 'var(--tm-true-maroon-60)',
        'tm-true-maroon-50': 'var(--tm-true-maroon-50)',
        'tm-true-maroon-40': 'var(--tm-true-maroon-40)',
        'tm-true-maroon-30': 'var(--tm-true-maroon-30)',
        'tm-true-maroon-20': 'var(--tm-true-maroon-20)',
        'tm-true-maroon-10': 'var(--tm-true-maroon-10)',
        'tm-cool-gray-90': 'var(--tm-cool-gray-90)',
        'tm-cool-gray-80': 'var(--tm-cool-gray-80)',
        'tm-cool-gray-70': 'var(--tm-cool-gray-70)',
        'tm-cool-gray-60': 'var(--tm-cool-gray-60)',
        'tm-cool-gray-50': 'var(--tm-cool-gray-50)',
        'tm-cool-gray-40': 'var(--tm-cool-gray-40)',
        'tm-cool-gray-30': 'var(--tm-cool-gray-30)',
        'tm-cool-gray-20': 'var(--tm-cool-gray-20)',
        'tm-cool-gray-10': 'var(--tm-cool-gray-10)',
        'tm-happy-yellow-90': 'var(--tm-happy-yellow-90)',
        'tm-happy-yellow-80': 'var(--tm-happy-yellow-80)',
        'tm-happy-yellow-70': 'var(--tm-happy-yellow-70)',
        'tm-happy-yellow-60': 'var(--tm-happy-yellow-60)',
        'tm-happy-yellow-50': 'var(--tm-happy-yellow-50)',
        'tm-happy-yellow-40': 'var(--tm-happy-yellow-40)',
        'tm-happy-yellow-30': 'var(--tm-happy-yellow-30)',
        'tm-happy-yellow-20': 'var(--tm-happy-yellow-20)',
        'tm-happy-yellow-10': 'var(--tm-happy-yellow-10)',
      },

      // Toastmasters Typography
      fontFamily: {
        'tm-headline': 'var(--tm-font-headline)',
        'tm-body': 'var(--tm-font-body)',
      },

      // Toastmasters Spacing
      spacing: {
        'tm-touch': 'var(--tm-touch-target)',
        'tm-xs': 'var(--tm-space-xs)',
        'tm-sm': 'var(--tm-space-sm)',
        'tm-md': 'var(--tm-space-md)',
        'tm-lg': 'var(--tm-space-lg)',
        'tm-xl': 'var(--tm-space-xl)',
        'tm-2xl': 'var(--tm-space-2xl)',
        'tm-3xl': 'var(--tm-space-3xl)',
      },

      // Toastmasters Border Radius
      borderRadius: {
        'tm-sm': 'var(--tm-radius-sm)',
        'tm-md': 'var(--tm-radius-md)',
        'tm-lg': 'var(--tm-radius-lg)',
        'tm-xl': 'var(--tm-radius-xl)',
        'tm-2xl': 'var(--tm-radius-2xl)',
      },

      // Brand Gradients
      backgroundImage: {
        'tm-gradient-loyal-blue': 'var(--tm-gradient-loyal-blue)',
        'tm-gradient-true-maroon': 'var(--tm-gradient-true-maroon)',
        'tm-gradient-cool-gray': 'var(--tm-gradient-cool-gray)',
        'tm-gradient-loyal-blue-radial': 'var(--tm-gradient-loyal-blue-radial)',
        'tm-gradient-true-maroon-radial':
          'var(--tm-gradient-true-maroon-radial)',
        'tm-gradient-cool-gray-radial': 'var(--tm-gradient-cool-gray-radial)',
        'tm-gradient-loyal-blue-vertical':
          'var(--tm-gradient-loyal-blue-vertical)',
        'tm-gradient-true-maroon-vertical':
          'var(--tm-gradient-true-maroon-vertical)',
        'tm-gradient-cool-gray-vertical':
          'var(--tm-gradient-cool-gray-vertical)',
        'tm-gradient-loyal-blue-horizontal':
          'var(--tm-gradient-loyal-blue-horizontal)',
        'tm-gradient-true-maroon-horizontal':
          'var(--tm-gradient-true-maroon-horizontal)',
        'tm-gradient-cool-gray-horizontal':
          'var(--tm-gradient-cool-gray-horizontal)',
        'tm-gradient-overlay-dark': 'var(--tm-gradient-overlay-dark)',
        'tm-gradient-overlay-light': 'var(--tm-gradient-overlay-light)',
      },

      // Responsive Breakpoints (Toastmasters Brand Guidelines)
      screens: {
        'tm-mobile': '320px',
        'tm-tablet': '768px',
        'tm-desktop': '1024px',
        'tm-wide': '1440px',
      },

      // Font Sizes with Brand Requirements
      fontSize: {
        'tm-xs': [
          'var(--tm-font-size-xs)',
          { lineHeight: 'var(--tm-line-height-normal)' },
        ],
        'tm-sm': [
          'var(--tm-font-size-sm)',
          { lineHeight: 'var(--tm-line-height-normal)' },
        ],
        'tm-base': [
          'var(--tm-font-size-base)',
          { lineHeight: 'var(--tm-line-height-normal)' },
        ],
        'tm-lg': [
          'var(--tm-font-size-lg)',
          { lineHeight: 'var(--tm-line-height-relaxed)' },
        ],
        'tm-xl': [
          'var(--tm-font-size-xl)',
          { lineHeight: 'var(--tm-line-height-relaxed)' },
        ],
        'tm-2xl': [
          'var(--tm-font-size-2xl)',
          { lineHeight: 'var(--tm-line-height-tight)' },
        ],
        'tm-3xl': [
          'var(--tm-font-size-3xl)',
          { lineHeight: 'var(--tm-line-height-tight)' },
        ],
        'tm-4xl': [
          'var(--tm-font-size-4xl)',
          { lineHeight: 'var(--tm-line-height-tight)' },
        ],
        'tm-5xl': [
          'var(--tm-font-size-5xl)',
          { lineHeight: 'var(--tm-line-height-tight)' },
        ],
        'tm-6xl': [
          'var(--tm-font-size-6xl)',
          { lineHeight: 'var(--tm-line-height-tight)' },
        ],
      },

      // Font Weights
      fontWeight: {
        'tm-regular': 'var(--tm-font-weight-regular)',
        'tm-medium': 'var(--tm-font-weight-medium)',
        'tm-semibold': 'var(--tm-font-weight-semibold)',
        'tm-bold': 'var(--tm-font-weight-bold)',
        'tm-black': 'var(--tm-font-weight-black)',
      },

      // Line Heights
      lineHeight: {
        'tm-tight': 'var(--tm-line-height-tight)',
        'tm-snug': 'var(--tm-line-height-snug)',
        'tm-normal': 'var(--tm-line-height-normal)',
        'tm-relaxed': 'var(--tm-line-height-relaxed)',
        'tm-loose': 'var(--tm-line-height-loose)',
      },

      // Letter Spacing
      letterSpacing: {
        'tm-tighter': 'var(--tm-letter-spacing-tighter)',
        'tm-tight': 'var(--tm-letter-spacing-tight)',
        'tm-normal': 'var(--tm-letter-spacing-normal)',
        'tm-wide': 'var(--tm-letter-spacing-wide)',
        'tm-wider': 'var(--tm-letter-spacing-wider)',
        'tm-widest': 'var(--tm-letter-spacing-widest)',
      },
    },
  },
  plugins: [],
}
