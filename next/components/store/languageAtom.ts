import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

type Language = 'en' | 'ja';

const safeAtomWithStorage = <T>(key: string, initial: T) => {
    try {
        // Check if localStorage is available
        if (typeof window !== 'undefined') {
            localStorage.setItem('__test__', '1')
            localStorage.removeItem('__test__')
            return atomWithStorage<T>(key, initial)
        }
        return atom<T>(initial)
    } catch {
        return atom<T>(initial)
    }
}

export const languageAtom = safeAtomWithStorage<Language>('app_language', 'en');
