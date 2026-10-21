import { useEffect } from 'react'

let locks = 0

/** Lock body scroll while `active` (ref-counted so a Modal over the drawer does not unlock early). */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    locks += 1
    document.body.style.overflow = 'hidden'
    return () => {
      locks -= 1
      if (locks <= 0) {
        locks = 0
        document.body.style.overflow = ''
      }
    }
  }, [active])
}
