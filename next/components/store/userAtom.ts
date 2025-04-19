import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

const safeAtomWithStorage = (key: string, initial: string) => {
  try {
    localStorage.setItem('__test__', '1')
    localStorage.removeItem('__test__')
    return atomWithStorage(key, initial)
  } catch {
    return atom(initial)
  }
}

export const userNameAtom = safeAtomWithStorage('user_name', '')