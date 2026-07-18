/**
 * useToast.hook.js
 * ─────────────────────────────────────────────────────────────────────────────
 * In-app toast notification system for Zyron.
 *
 * Manages the toast state, enter/exit animations (opacity + translateY),
 * horizontal swipe-to-dismiss via PanResponder, and the auto-dismiss timer.
 *
 * Returns:
 *   {
 *     toast,          — { title, message, type } | null
 *     toastOpacity,   — Animated.Value (native driver)
 *     toastPan,       — Animated.ValueXY (JS driver — mixed with translateX/Y)
 *     panResponder,   — PanResponder instance
 *     showToast,      — (title, message, type?) => void
 *     dismissToast,   — () => void
 *   }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef } from 'react';
import { Animated, PanResponder } from 'react-native';

/**
 * useToast
 * @returns toast state and helpers
 */
export default function useToast() {
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const toastPan = useRef(new Animated.ValueXY({ x: 0, y: -50 })).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // ── Helpers ────────────────────────────────────────────────────────────
  const briefToastText = (text) => {
    if (!text) return text;
    const cleaned = String(text).replace(/\s+/g, ' ').trim();
    return cleaned.length > 96 ? `${cleaned.slice(0, 93)}...` : cleaned;
  };

  const dismissToast = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(toastPan.y, {
        toValue: -50,
        duration: 200,
        useNativeDriver: false,
      })
    ]).start(({ finished }) => {
      if (finished) {
        setToast(null);
      }
    });
  };

  const showToast = (title, message, type = 'info') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    toastOpacity.stopAnimation();
    toastPan.x.stopAnimation();
    toastPan.y.stopAnimation();
    toastPan.setValue({ x: 0, y: -50 });
    toastOpacity.setValue(0);

    setToast({ title: briefToastText(title), message: briefToastText(message), type });

    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(toastPan.y, {
        toValue: 0,
        tension: 40,
        friction: 7,
        useNativeDriver: false,
      })
    ]).start();

    toastTimerRef.current = setTimeout(() => {
      dismissToast();
    }, 3200);
  };

  // ── PanResponder for horizontal swipe-to-dismiss ───────────────────────
  // opacity uses useNativeDriver:true; translateX/Y use useNativeDriver:false.
  // React Native forbids mixing both drivers on the same Animated.View node —
  // doing so throws "attempting to run JS driven animation on a node that has
  // been moved to native". Fix: nest two Animated.Views so each node only ever
  // sees values from a single driver.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        toastPan.x.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = 120;
        if (gestureState.dx > threshold) {
          Animated.parallel([
            Animated.timing(toastPan.x, {
              toValue: 500,
              duration: 150,
              useNativeDriver: false,
            }),
            Animated.timing(toastOpacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            })
          ]).start(() => {
            if (toastTimerRef.current) {
              clearTimeout(toastTimerRef.current);
              toastTimerRef.current = null;
            }
            setToast(null);
          });
        } else if (gestureState.dx < -threshold) {
          Animated.parallel([
            Animated.timing(toastPan.x, {
              toValue: -500,
              duration: 150,
              useNativeDriver: false,
            }),
            Animated.timing(toastOpacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            })
          ]).start(() => {
            if (toastTimerRef.current) {
              clearTimeout(toastTimerRef.current);
              toastTimerRef.current = null;
            }
            setToast(null);
          });
        } else {
          Animated.spring(toastPan.x, {
            toValue: 0,
            tension: 50,
            friction: 5,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  return {
    toast,
    toastOpacity,
    toastPan,
    panResponder,
    showToast,
    dismissToast,
    toastTimerRef,
  };
}
