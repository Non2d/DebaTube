import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

const safeAtomWithStorage = (key: string, initial: any) => {
  try {
    localStorage.setItem('__test__', '1')
    localStorage.removeItem('__test__')
    return atomWithStorage(key, initial)
  } catch {
    return atom(initial)
  }
}

export const userNameAtom = safeAtomWithStorage('user_name', '')
export const themeAtom = safeAtomWithStorage('theme', true)