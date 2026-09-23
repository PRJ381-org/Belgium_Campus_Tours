import { useEffect } from 'react';

/**
 * Calls onOutside when a click lands outside the element in `ref`.
 */
export default function useClickOutside(ref, onOutside) {
  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [ref, onOutside]);
}
