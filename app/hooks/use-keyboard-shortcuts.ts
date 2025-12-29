/**
 * Keyboard Shortcuts Hook
 * 
 * Provides keyboard shortcuts for common actions in the support interface
 */

import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Find matching shortcut
    const shortcut = shortcuts.find(s => {
      const keyMatch = event.key.toLowerCase() === s.key.toLowerCase();
      const ctrlMatch = s.ctrlKey ? (event.ctrlKey || event.metaKey) : true;
      const metaMatch = s.metaKey ? event.metaKey : true;
      const shiftMatch = s.shiftKey ? event.shiftKey : !event.shiftKey;
      const altMatch = s.altKey ? event.altKey : !event.altKey;
      
      return keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch;
    });
    
    if (shortcut) {
      event.preventDefault();
      event.stopPropagation();
      shortcut.action();
    }
  }, [shortcuts]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Common shortcuts for the support interface
export const SUPPORT_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: '/',
    description: 'Focus search',
    action: () => {
      const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    }
  },
  {
    key: 'n',
    ctrlKey: true,
    description: 'New conversation',
    action: () => {
      toast.info('New conversation shortcut activated');
      // This would open new conversation dialog
    }
  },
  {
    key: 'r',
    ctrlKey: true,
    description: 'Mark as resolved',
    action: () => {
      const resolveButton = document.querySelector('[data-shortcut="resolve"]') as HTMLButtonElement;
      if (resolveButton) {
        resolveButton.click();
      }
    }
  },
  {
    key: 'e',
    ctrlKey: true,
    description: 'Export conversation',
    action: () => {
      const exportButton = document.querySelector('[data-shortcut="export"]') as HTMLButtonElement;
      if (exportButton) {
        exportButton.click();
      }
    }
  },
  {
    key: '?',
    shiftKey: true,
    description: 'Show keyboard shortcuts',
    action: () => {
      const modal = document.querySelector('[data-shortcut="help"]') as HTMLElement;
      if (modal) {
        modal.click();
      } else {
        // Show shortcuts in a toast as fallback
        toast.info('Press ? to see keyboard shortcuts', { duration: 3000 });
      }
    }
  }
];

// Conversation-specific shortcuts
export function useConversationShortcuts(
  onSendMessage?: () => void,
  onMarkResolved?: () => void,
  onExport?: () => void,
  onToggleNotes?: () => void
) {
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'Enter',
      ctrlKey: true,
      description: 'Send message',
      action: () => {
        if (onSendMessage) {
          onSendMessage();
        }
      }
    },
    {
      key: 'r',
      ctrlKey: true,
      description: 'Mark as resolved',
      action: () => {
        if (onMarkResolved) {
          onMarkResolved();
        }
      }
    },
    {
      key: 'e',
      ctrlKey: true,
      description: 'Export conversation',
      action: () => {
        if (onExport) {
          onExport();
        }
      }
    },
    {
      key: 'n',
      ctrlKey: true,
      shiftKey: true,
      description: 'Toggle internal notes',
      action: () => {
        if (onToggleNotes) {
          onToggleNotes();
        }
      }
    },
    {
      key: 'Escape',
      description: 'Close dialogs',
      action: () => {
        // Close any open modals/dialogs
        const closeButtons = document.querySelectorAll('[data-close-dialog]');
        closeButtons.forEach((btn: Element) => {
          (btn as HTMLButtonElement).click();
        });
      }
    }
  ];
  
  useKeyboardShortcuts(shortcuts);
}