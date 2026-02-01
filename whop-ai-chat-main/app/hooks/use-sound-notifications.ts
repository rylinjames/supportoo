/**
 * Sound Notification Hook
 *
 * Plays sound effects for new messages and other events
 * Uses gentle, non-intrusive sounds
 */

import { useEffect, useRef, useState } from 'react';

type SoundType = 'newMessage' | 'messageSent' | 'notification' | 'error';

// Gentler notification sounds - soft chime/ding tones
const SOUND_URLS: Record<SoundType, string> = {
  // Soft gentle chime for new messages
  newMessage: 'data:audio/wav;base64,UklGRoQEAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YWAEAACAgICAgICAgICBgYGBgYKCgoKCg4ODg4SEhISEhYWFhYaGhoaHh4eHiIiIiImJiYmKioqKi4uLi4yMjIyNjY2Njo6Ojm9vb29wcHBwcXFxcXJycnJzc3NzdHR0dHV1dXV2dnZ2d3d3d3h4eHh5eXl5enp6ent7e3t8fHx8fX19fX5+fn5/f39/gICAgIGBgYGCgoKCg4ODg4SEhISFhYWFhoaGhoeHh4eIiIiIiYmJiYqKioqLi4uLjIyMjI2NjY2Ojo6Oj4+Pj5CQkJCRkZGRkpKSkpOTk5OUlJSUlZWVlZaWlpaXl5eXmJiYmJmZmZmampqam5ubm5ycnJydnZ2dnp6enp+fn5+goKCgoaGhoaKioqKjo6OjpKSkpKWlpaWmpqampaWlpaSkpKSjo6OjoqKioqGhoaGgoKCgn5+fn56enp6dnZ2dnJycnJubm5uampqamZmZmZiYmJiXl5eXlpaWlpWVlZWUlJSUk5OTk5KSkpKRkZGRkJCQkI+Pj4+Ojo6OjY2NjYyMjIyLi4uLioqKiomJiYmIiIiIh4eHh4aGhoaFhYWFhISEhIODg4OCgoKCgYGBgYCAgIB/f39/fn5+fn19fX18fHx8e3t7e3p6enp5eXl5eHh4eHd3d3d2dnZ2dXV1dXR0dHRzc3NzcnJycnFxcXFwcHBwb29vb25ubm5tbW1tbGxsbGtra2tqampqaWlpaWhpaGhnZ2dnZmZmZmVlZWVkZGRkY2NjY2JiYmJhYWFhYGBgYF9fX19eXl5eXV1dXVxcXFxbW1tbWlpaWllZWVlYWFhYV1dXV1ZWVlZVVVVVVFRUVFNTU1NSUlJSUVFRUVBQUFBPT09PTk5OTk1NTU1MTExMS0tLS0pKSkpJSUlJSEhISEdHR0dGRkZGRUVFRURERERDQ0NDQkJCQkFBQUFAQEBAQ0NDQ0ZGRkZJSUlJTExMTE9PT09SUlJSVVVVVVhYWFhbW1tbXl5eXmFhYWFkZGRkZ2dnZ2pqampsbGxsb29vb3Jycnh5eXl6enp6e3t7e3x8fHx9fX19fn5+fn9/f39/f39/gICAgICAgICAgICAgH9/f39+fn5+fX19fXx8fHx7e3t7enp6enl5eXl4eHh4d3d3d3Z2dnZ1dXV1dHR0dHNzc3NycnJycXFxcXBwcHBvb29vbm5ubm1tbW1sbGxsa2tra2pqamppamppaWlpaGhoaGdnZ2dmZmZmZWVlZWRkZGRjY2NjYmJiYmFhYWFgYGBgX19fX15eXl5dXV1dXFxcXFtbW1taWlpaWVlZWVhYWFhXV1dXVlZWVlVVVVVUVFRUU1NTU1JSUlJRUVFRUFBQUE9PT09OTk5OTU1NTUxMTExLS0tLSkpKSklJSUlISEhIR0dHR0ZGRkZFRUVFRERERA==',
  // Very soft pop for sent messages
  messageSent: 'data:audio/wav;base64,UklGRmQBAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YUABAAB/f39/gICAgIGBgYGCgoKCgoODg4ODhISEhISFhYWFhYaGhoaGh4eHh4eIiIiIiImJiYmJioqKioqLi4uLi4yMjIyMjY2NjY2Ojo6Ojo+Pj4+PkJCQkJCRkZGRkZKSkpKSkpOTk5OTlJSUlJSUlZWVlZWVlpaWlpaWl5eXl5eXmJiYmJiYmZmZmZmZmpqampqam5ubm5ubnJycnJycnZ2dnZ2dnp6enp6en5+fn5+foKCgoKCgoaGhoaGhoqKioqKio6Ojo6OjpKSkpKSkpKWlpaWlpaWmpqampqampqampqampqalpqampqampqampqampqampaWlpaWlpaSkpKSkpKSjo6Ojo6OioqKioqKhoaGhoaGgoKCgoKCfn5+fn5+enp6enp6dnZ2dnZ2cnJycnJybm5ubm5uampqamZmZmZmYmJiYmJeXl5eXlpaWlpaVlZWVlZSUlJSTk5OTk5KSkpKS',
  // Gentle notification chime
  notification: 'data:audio/wav;base64,UklGRoQCAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YWACAAB/f39/gICAgIGBgYGCgoKCg4ODg4SEhISFhYWFhoaGhoeHh4eIiIiIiYmJiYqKioqLi4uLjIyMjI2NjY2Ojo6Oj4+Pj5CQkJCRkZGRkpKSkpOTk5OUlJSUlZWVlZaWlpaXl5eXmJiYmJmZmZmampqam5ubm5ycnJydnZ2dnp6enp+fn5+goKCgoaGhoaKioqKjo6OjpKSkpKWlpaWmpqampaWlpaSkpKSjo6OjoqKioqGhoaGgoKCgn5+fn56enp6dnZ2dnJycnJubm5uampqamZmZmZiYmJiXl5eXlpaWlpWVlZWUlJSUk5OTk5KSkpKRkZGRkJCQkI+Pj4+Ojo6OjY2NjYyMjIyLi4uLioqKiomJiYmIiIiIh4eHh4aGhoaFhYWFhISEhIODg4OCgoKCgYGBgYCAgIB/f39/fn5+fn19fX18fHx8e3t7e3p6enp5eXl5eHh4eHd3d3d2dnZ2dXV1dXR0dHRzc3NzcnJycnFxcXFwcHBwb29vb25ubm5tbW1tbGxsbGtra2tqampqaWlpaWhpaGhnZ2dnZmZmZmVlZWVkZGRkY2NjY2JiYmJhYWFhYGBgYF9fX19eXl5eXV1dXVxcXFxbW1tbWlpaWllZWVlYWFhYV1dXV1ZWVlZVVVVVVFRUVFNTU1NSUlJSUVFRUQ==',
  // Soft error tone
  error: 'data:audio/wav;base64,UklGRoQBAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YWABAACDQ4OCgoKCgYGBgYCAgIB/f39/fn5+fn19fX18fHx8e3t7e3p6enp5eXl5eHh4eHd3d3d2dnZ2dXV1dXR0dHRzc3NzcnJycnFxcXFwcHBwb29vb25ubm5tbW1tbGxsbGtra2tqampqaWlpaWhpaGhnZ2dnZmZmZmVlZWVkZGRkY2NjY2JiYmJhYWFhYGBgYGFhYWFiYmJiY2NjY2RkZGRlZWVlZmZmZmdnZ2doaWhpaWlpaWpqamtra2tsbGxsbW1tbW5ubm5vb29vcHBwcHFxcXFycnJyc3Nzc3R0dHR1dXV1dnZ2dnd3d3d4eHh4eXl5eXp6enp7e3t7fHx8fH19fX1+fn5+f39/f4CAgICBgYGBgoKCgoODg4OEhISEhYWFhYaGhoaHh4eHiIiIiImJiYmKioqKi4uLi4yMjIyNjY2Njo6Ojg=='
};

const getStoredBoolean = (key: string, fallback: boolean) => {
  if (typeof window === "undefined") return fallback;
  const stored = localStorage.getItem(key);
  if (stored === null) return fallback;
  return stored === "true";
};

const getStoredNumber = (key: string, fallback: number) => {
  if (typeof window === "undefined") return fallback;
  const stored = localStorage.getItem(key);
  const parsed = stored ? Number(stored) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function useSoundNotifications() {
  const [enabled, setEnabled] = useState(() =>
    getStoredBoolean("soundNotifications", false)
  );
  const [volume, setVolume] = useState(() =>
    getStoredNumber("soundVolume", 0.3)
  ); // Lower default volume for gentler sound
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
      audio.muted = !enabled;
      audioRefs.current[type as SoundType] = audio;
    });

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
    Object.values(audioRefs.current).forEach(audio => {
      if (audio) {
        audio.muted = !enabled;
        if (!enabled) {
          audio.pause();
          audio.currentTime = 0;
        }
      }
    });
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
