import { useState, useEffect } from 'react';

/**
 * A custom hook to detect if any modal or full-screen form backdrop is currently open in the DOM.
 * This checks for elements with tailwind backdrop-blur classes, native modal containers, or dark semi-transparent backdrops.
 */
export function useIsModalOpen() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkModal = () => {
      // Find elements containing typical backdrop or modal indicators
      const hasBackdrop = !!document.querySelector('[class*="backdrop-blur"]') || 
                          !!document.querySelector('.backdrop-blur-sm') || 
                          !!document.querySelector('.backdrop-blur-md') || 
                          !!document.querySelector('.backdrop-blur-l') || 
                          !!document.querySelector('.backdrop-blur-2xl') ||
                          // Escaped slashes for utility classes like bg-slate-900/40
                          !!document.querySelector('[class*="bg-slate-900/40"]') ||
                          !!document.querySelector('[class*="bg-slate-900\\/40"]') ||
                          !!document.querySelector('[class*="bg-slate-950\\/95"]') ||
                          // Fallback check on divs specifically matching standard backdrop styles
                          Array.from(document.querySelectorAll('div')).some(el => {
                            const className = el.className || '';
                            if (typeof className !== 'string') return false;
                            return (
                              (className.includes('bg-slate-900/40') || className.includes('bg-slate-950/80') || className.includes('bg-slate-900/60')) &&
                              (className.includes('backdrop-blur') || className.includes('fixed inset-0'))
                            );
                          });

      setIsOpen(hasBackdrop);
    };

    // Initial check
    checkModal();

    // Use MutationObserver for high-performance reactive updates
    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, { 
      childList: true, 
      subtree: true, 
      attributes: true, 
      attributeFilter: ['class', 'style'] 
    });

    // Fallback polling for maximum reliability across complex transitions
    const interval = setInterval(checkModal, 400);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  return isOpen;
}

export default useIsModalOpen;
