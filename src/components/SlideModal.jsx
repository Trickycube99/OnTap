import React, { useState, useEffect, useRef, useCallback } from 'react';
import { playTapSound } from '../utils/audio';

/**
 * SlideModal - Universal High-Performance Slide Up / Slide Down Modal
 * Features:
 * - Native Slide-Up on open and Slide-Down on close for mobile & desktop
 * - Swipe-down / drag-to-dismiss gesture on Android & Apple iOS touchscreens
 * - iOS/Android Safe Area insets support (env(safe-area-inset-bottom))
 * - Light dismiss (backdrop tap & Escape key) with exit animation
 * - Accessible ARIA attributes & keyboard support
 */
export default function SlideModal({
  isOpen,
  onClose,
  children,
  maxWidth = 520,
  maxHeight = '92vh',
  className = '',
  overlayClassName = '',
  isDark = false,
  showDragPill = true,
  ariaLabel = 'Modal dialog',
  zIndex = 10000,
  contentStyle = {}
}) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);
  const sheetRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
      setDragY(0);
    } else if (isRendered && !isClosing) {
      handleDismiss();
    }
  }, [isOpen]);

  const handleDismiss = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setIsRendered(false);
      setDragY(0);
      if (onClose) onClose();
    }, 220); // Matches slideDown animation duration (220ms)
  }, [isClosing, onClose]);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isRendered && !isClosing) {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRendered, isClosing, handleDismiss]);

  // Body scroll lock while modal is open
  useEffect(() => {
    if (isRendered) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isRendered]);

  // Touch gesture handlers for mobile swipe-down (Android & Apple iOS)
  const handleTouchStart = (e) => {
    const isPill = e.target.closest('.modal-drag-pill');
    const scrollable = e.target.closest('[data-scrollable="true"], .modal-scroll-area');

    if (scrollable && scrollable.scrollTop > 2) {
      isDragging.current = false;
      return;
    }

    if (isPill || (sheetRef.current && sheetRef.current.scrollTop <= 5 && (!scrollable || scrollable.scrollTop <= 2))) {
      touchStartY.current = e.touches[0].clientY;
      isDragging.current = true;
    } else {
      isDragging.current = false;
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging.current) return;
    const scrollable = e.target.closest('[data-scrollable="true"], .modal-scroll-area');
    if (scrollable && scrollable.scrollTop > 2) {
      isDragging.current = false;
      setDragY(0);
      return;
    }
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;
    if (deltaY > 15) {
      if (e.cancelable && (e.target.closest('.modal-drag-pill') || !scrollable)) {
        e.preventDefault();
      }
      setDragY(deltaY);
    } else {
      setDragY(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (dragY > 80) {
      playTapSound();
      handleDismiss();
    } else {
      setDragY(0);
    }
  };

  if (!isRendered) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className={`modal-overlay ${isClosing ? 'overlay-closing' : ''} ${overlayClassName}`}
      style={{ zIndex }}
      onClick={() => {
        playTapSound();
        handleDismiss();
      }}
    >
      <div
        ref={sheetRef}
        className={`modal-content-sheet ${isDark ? 'dark-sheet' : ''} ${isClosing ? 'sheet-closing' : ''} ${className}`}
        style={{
          maxWidth,
          maxHeight,
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging.current ? 'none' : 'transform 0.22s ease-out',
          ...contentStyle
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {showDragPill && (
          <div className={`modal-drag-pill ${isDark ? 'dark-drag-pill' : ''}`} />
        )}
        {typeof children === 'function' ? children({ dismiss: handleDismiss }) : children}
      </div>
    </div>
  );
}
