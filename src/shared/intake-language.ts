import en from '@/locales/intake-en';
import my from '@/locales/intake-my';
import { useLanguage } from './language';
export function useIntakeLanguage() { return useLanguage().locale === 'my-MM' ? my : en; }
