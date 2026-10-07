/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        abyss: '#050C16',
        deep: '#08121F',
        panel: '#0B1827',
        raised: '#102238',
        line: '#173049',
        line2: '#21496C',
        ink: '#E6F1F7',
        mute: '#93ABBE',
        dim: '#5F7B92',
        sonar: { DEFAULT: '#2FD3E6', soft: '#1AA6B8', deep: '#0E6E80' },
        teal: { DEFAULT: '#19B9A6' },
        hz: { high: '#FF5A5F', med: '#F6A623', low: '#3FD98F' },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        display: ['Outfit', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: { '2xs': ['0.6875rem', '1rem'] },
      keyframes: {
        ring: { '0%': { transform: 'scale(0.6)', opacity: '0.9' }, '100%': { transform: 'scale(2.2)', opacity: '0' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        slidein: { from: { transform: 'translateX(24px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        sweep: { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(100%)' } },
        fadein: { from: { opacity: '0' }, to: { opacity: '1' } },
        ringout: { '0%': { transform: 'scale(0.15)', opacity: '0.7' }, '100%': { transform: 'scale(3.2)', opacity: '0' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
      },
      animation: {
        ring: 'ring 2.4s ease-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
        slidein: 'slidein 0.22s ease-out',
        sweep: 'sweep 1.4s linear infinite',
        fadein: 'fadein 0.7s ease-out both',
        ringout: 'ringout 1.1s ease-out forwards',
        floaty: 'floaty 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
