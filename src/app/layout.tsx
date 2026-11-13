import '@fontsource/noto-sans-myanmar/400.css';
import '@fontsource/noto-sans-myanmar/700.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/vietnamese-400.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-800.css';
import '@fontsource/plus-jakarta-sans/vietnamese-800.css';
import '@fontsource/suse/latin-600.css';
import '@fontsource/suse/latin-700.css';
import '@fontsource/open-sans/latin-400.css';
import '@fontsource/open-sans/latin-600.css';
import './tailwind.css';
import './globals.css';
import './gamification.css';
import './training.css';
import './bee.css';
import './ux.css';
import './dark.css';
import './polish.css';
import './solaris.css';
import './gloss.css';
import './simple.css';
export const metadata = { title: 'Mingalar Fit · Myanmar Fitness Coach', description: 'Your workouts, plans and progress in one place.', manifest: '/manifest.webmanifest', appleWebApp: { capable: true, title: 'Mingalar Fit' } };
export const viewport = { themeColor: '#fc7a1e', viewportFit: 'cover', width: 'device-width', initialScale: 1 };
// Applies the saved theme before first paint (no light flash in dark mode). Static string, no user input.
const THEME_SCRIPT = "try{var m=localStorage.getItem('mingalar-theme')||'light';var d=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}";
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="my-MM" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}/></head><body>{children}</body></html>; }
