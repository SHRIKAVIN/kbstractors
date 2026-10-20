/** @type {import('tailwindcss').Config} */

// Tractor-screen colours are CSS variables (space-separated RGB, defined in
// src/index.css) so they follow the device's light/dark setting and still
// support Tailwind opacity modifiers like `bg-brand/10`.
const themed = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          950: themed('night-950'), // page
          900: themed('night-900'), // sheets
          850: themed('night-850'), // cards
          800: themed('night-800'), // raised / expanded cards
          700: themed('night-700'), // menus, toasts
          600: themed('night-600'),
        },
        fog: themed('fog'), // primary text
        line: themed('line'), // hairlines and subtle fills
        brand: {
          DEFAULT: themed('brand'), // KBS logo green
          hover: themed('brand-hover'),
          fg: themed('brand-fg'),
        },
        pos: themed('pos'), // money received
        coral: {
          300: themed('coral-300'),
          400: themed('coral-400'),
          500: themed('coral-500'),
        },
      },
      fontFamily: {
        app: ['Geist', '"Anek Tamil"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translate(-50%, 16px) scale(0.94)' },
          to: { opacity: '1', transform: 'translate(-50%, 0) scale(1)' },
        },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.6)' },
          '60%': { opacity: '1', transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)' },
        },
        draw: {
          to: { strokeDashoffset: '0' },
        },
        caret: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        'sheet-up': 'sheet-up 420ms cubic-bezier(0.32, 0.72, 0, 1)',
        'fade-in': 'fade-in 240ms ease-out',
        'toast-in': 'toast-in 320ms cubic-bezier(0.32, 0.72, 0, 1)',
        'rise-in': 'rise-in 520ms cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 2.8s linear infinite',
        'pop-in': 'pop-in 480ms cubic-bezier(0.22, 1, 0.36, 1) both',
        draw: 'draw 520ms 220ms cubic-bezier(0.65, 0, 0.35, 1) forwards',
        caret: 'caret 1s step-end infinite',
      },
    },
  },
  plugins: [],
};
