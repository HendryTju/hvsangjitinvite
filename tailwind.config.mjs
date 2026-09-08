/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			colors: {
				primary: '#fef08a', // Pastel Yellow
				secondary: '#dcfce7', // Pastel Sage Green
				accent: '#fce7f3', // Pastel Pink
				dark: '#1c1917', // Dark gray for text
				light: '#fafaf9', // Off-white
			},
			fontFamily: {
				sans: ['Inter', 'sans-serif'],
				serif: ['"Cormorant Garamond"', 'serif'],
			},
		},
	},
	plugins: [],
}
