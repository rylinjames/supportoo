/**
 * Sound Notification Hook
 * 
 * Plays sound effects for new messages and other events
 */

import { useEffect, useRef, useState } from 'react';

type SoundType = 'newMessage' | 'messageSent' | 'notification' | 'error';

const SOUND_URLS: Record<SoundType, string> = {
  newMessage: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi77OueTRAMUKfh8LViFAY4kdnzzHksBSR3yPDekEEKFFuz5+umVBYKR5/i8b5sIAUrg8/y2oo2CBlov+zqnk0QDFCn4e+1YRQGOJHa8st+KwUkd8jx3pJCChRbseXppVYWDEif4PG+bCAELITQ8tiJNgcZaL3u66BODwxPqOPwtmQVBjiS1/PMeS0GI3fH8N+RQAoUW7Pl66VVFApIneLwvmwhBCyBzvHaiTYIGWq+7OucTREMUKfi77ZiFQU4kdfz0HksBiN3yPDekUAKFFux5eqnVRQKSJ7j8b5rIAQsgs/y2Io2CBlov+7rnU0RDFCo4e+2YhQFOpPX8s1+LAgld8nx3pFDCRVbsuXrplQYCkef4vG+ayAFLIHQ8tmJNggZaLzs66BNEQxQp+HwtmEYBjiS1/PMeS4FI3fH8d+RQAoUXLTm66hVFApGn+DyvmwhBSuBzvLaiTYIGWi57OugTRAMUKfh8LViFAU4ktjzzHksBSN3yPDekEEKFFyz5+upVRYKR5/i8b5sIAUrgs7x2oo2CBlov+3rnk0RDFCn4PG2YhYGOJLZ8st8KwUkd8jw3pFAChRbsOXppVYWCkeA4e++bSEFLITQ8diINQcZaLvs66BPEAxPqOPwtmMcBjiR1/PMeS4GI3fH8N+RQAoUW7Pl66VWFApGn+DyvmwhBSyBzvLaiDUIGWi87OqfTRAMUKfh8LVhFAU4ktfzzHgsBiN3yPHekUEKFFux5+unVxQKSJ/i8L5rIAQsg8/y2Io2CBlov+7rnU0RDFCo4PG2YxQGOJLX8s15KwYkd8jx3pBAChVbsuXqp1QWCkef4vG+bCAELIHP8tiJNggZaLzs66BNEAxQp+HwtmEUBjiS1/PMeS0FJHfH8d+RQAoUXLTl66dVFApGn+DyvmshBSyBzvLaiTYIGWm77OufTRAMUKjh8LVhFAY4ktfzzHksBiN3yPDekEEKFFux5eqpVRQKSJ/i8b5sIAUsgs/y2oo2CBlov+3rnU0RDFCn4fC2YhQGOJLZ8st8KwUkd8jw3pJAChRbsOXppVYWCkef4vG+ayEELIPP8NmKNggZaL/s655NEAxPqOHwtmMUBjiS1/PMeS4GJHfH8N+RQAoUW7Pl66VWFApGn+DyvmwhBCuCzvLaiTYIGWi77OufTRAMUKfh8LVhGAY4ktfzzHksBiN3yPDekEEKFFux5eqpVRQMSJ/i8b5sIAUsgs/y2oo2CBlov+3rnU0RDFCn4fC2YhQGOJLZ8st8KwUkd8nx3pJAChRbsOXppVYWCkef4vG+ayEELIPP8NmKNggZaL/s655NEAxPqOHwtmMUBjiS1/PMeS4GJHfH8N+RQAoUW7Pl66VWFApGn+DyvmwhBCuCzvLaiTYIGWi77OufTRAMUKfh8LVhGAY4ktfzzHksBiN3yPDekEEKFFux5eqpVRQMSJ/i8b5sIAUsgs/y2oo2CBlov+3rnU0RDFCn4fC2YhQGOJLZ8st8KwUkd8nx3pJAChVbsOXppVYWCkef4vG+bCAELIPP8diKNggZaL7s659NEAxPqOPwtmMUBjiS1/PMeS4GJHfH8N+RQAoUW7Xl7KVWFApGn+DyvmwhBCuCzvLaiTYIGWi77OufTRAMUKfh8LVhGAY4ktfzzHksBiN3yPDekEEKFFux5eqpVRQMSJ/i8b5sIAUsgs/y2oo2CBlov+3rnU0RDFCn4fC2YhQGOJLZ8st8KwUkd8nx3pJAChRbsOXppVYWCkef4vG+bCAELIPP8diKCAA=',
  messageSent: 'data:audio/wav;base64,UklGRmQCAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YUACAAAAAAEAAQACAAIAAwADAAQABAAFAAUABgAGAAcABwAIAAgACQAJAAoACgALAAsADAAMAA0ADQAOAA4ADwAPABAAEAARABEAEgASABMAEwAUABQAFQAVABYAFgAXABcAGAAYABkAGQAaABoAGwAbABwAHAAdAB0AHgAeAB8AHwAgACAAIQAhACIAIgAjACMAJAAkACUAJQAmACYAJwAnACgAKAApACkAKgAqACsAKwAsACwALQAtAC4ALgAvAC8AMAAwADEAMQAyADIAMwAzADQANAA1ADUANQA2ADcANwA4ADgAOQA5ADoAOgA7ADsAPAA8AD0APQA+AD4APwA/AEAAQABBAEEAQgBCAEMAQwBEAEQARQBFAEYARgBHAEcASABIAEkASQBKAEoASwBLAEwATABNAE0ATgBOAE8ATwBQAFAAUQBRAFIAUgBTAFMAVABUAFUAVQBWAFYAVwBXAFgAWABZAFkAWgBaAFsAWwBcAFwAXQBdAF4AXgBfAF8AYABgAGEAYQBiAGIAYwBjAGQAZABlAGUAZgBmAGcAZwBoAGgAaQBpAGoAagBrAGsAbABsAG0AbQBuAG4AbwBvAHAAcABxAHEAcgByAHMAcwB0AHQAdQB1AHYAdgB3AHcAeAB4AHkAeQB6AHoAewB7AHwAfAB9AH0Afg==',
  notification: 'data:audio/wav;base64,UklGRigBAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQBAACAAIA4wDjAOMA4wDjAOMA4wDjAOMB4AAAAeMAAgHgAAIAAAAA4wACAOMB4AAAAgAAAAIA4wDjAOMAAgAAAAIAAAAA4wDjAOMA4wACAeMAAADjAOMA4wDjAAAA4wDjAAAA4wDjAAAA4wAAAOMA4wDjAAAA4wHjAOMA4wDjAOMA4wICAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAgIA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMAAgDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMAAADjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wIAAAAA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wDjA',
  error: 'data:audio/wav;base64,UklGRgQCAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGf0YbQBAABkYXRhZAEAAP//AAABAP//AAABAP//AAABAP//AAABAP7/AAABAAAA//8AAAEA//8AAAEA//8AAAEA//8AAAEAAAD//wAAAQD//wAAAQD+/wAAAQD//wAAAAD//wAAAAAAAP//AAAAAAAAAQAAAP//AQAAAP//AQAAAP//AQAAAP//AQAAAP//AQAAAP//AAABAAAA//8AAAEAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//AAAAAAAAAAAAAAAAAAD//wAAAAAAAAAAAAAAAAEAAAAAAP//AQAAAP//AQAAAP//AQAAAP//AQAAAP//AQAAAP7/AAABAAAA//8AAAAA//8AAAAAAAD+/wAAAQD//wAAAAD//wAAAQAAAAAAAAD//wAAAQAAAP//AAABAAAA//8AAAEAAAAAAP//AAACAAAA//8AAAEA//8AAAEAAAD//wAAAQAAAP//AAABAAAA//8AAAEAAAD//wAAAQAAAP//AAABAA=='
};

export function useSoundNotifications() {
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolume] = useState(0.5);
  const audioRefs = useRef<Record<SoundType, HTMLAudioElement | null>>({
    newMessage: null,
    messageSent: null,
    notification: null,
    error: null
  });

  // Initialize audio elements
  useEffect(() => {
    Object.entries(SOUND_URLS).forEach(([type, url]) => {
      const audio = new Audio(url);
      audio.volume = volume;
      audioRefs.current[type as SoundType] = audio;
    });

    // Load settings from localStorage
    const savedEnabled = localStorage.getItem('soundNotifications');
    const savedVolume = localStorage.getItem('soundVolume');
    
    if (savedEnabled !== null) {
      setEnabled(savedEnabled === 'true');
    }
    
    if (savedVolume !== null) {
      const vol = parseFloat(savedVolume);
      if (!isNaN(vol)) {
        setVolume(vol);
      }
    }

    return () => {
      // Cleanup audio elements
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
    };
  }, []);

  // Update volume when changed
  useEffect(() => {
    Object.values(audioRefs.current).forEach(audio => {
      if (audio) {
        audio.volume = volume;
      }
    });
    localStorage.setItem('soundVolume', volume.toString());
  }, [volume]);

  // Update enabled state
  useEffect(() => {
    localStorage.setItem('soundNotifications', enabled.toString());
  }, [enabled]);

  const playSound = (type: SoundType) => {
    if (!enabled) return;
    
    const audio = audioRefs.current[type];
    if (audio) {
      // Reset and play
      audio.currentTime = 0;
      audio.play().catch(err => {
        console.warn('Failed to play sound:', err);
      });
    }
  };

  return {
    playSound,
    enabled,
    setEnabled,
    volume,
    setVolume
  };
}