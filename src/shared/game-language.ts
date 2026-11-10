import en from '@/locales/game-en';
import my from '@/locales/game-my';
import { useLanguage } from './language';
export function useGameLanguage(){const {locale}=useLanguage();return locale==='my-MM'?my:en;}
