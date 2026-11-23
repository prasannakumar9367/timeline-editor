import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';

/**
 * Global keyboard shortcuts for the editor.
 */
export function useKeyboard() {
  const togglePlay = useEditorStore((s) => s.togglePlay);
  const deleteClip = useEditorStore((s) => s.deleteClip);
  const duplicateClip = useEditorStore((s) => s.duplicateClip);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const selectClip = useEditorStore((s) => s.selectClip);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const stop = useEditorStore((s) => s.stop);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Don't capture when user is typing in an input / textarea
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      switch (e.code) {
        case 'KeyZ':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
          }
          break;

        case 'KeyY':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            redo();
          }
          break;

        case 'Space':
          e.preventDefault();
          togglePlay();
          break;

        case 'Delete':
        case 'Backspace':
          if (selectedClipId) {
            e.preventDefault();
            deleteClip(selectedClipId);
          }
          break;

        case 'KeyD':
          if ((e.ctrlKey || e.metaKey) && selectedClipId) {
            e.preventDefault();
            duplicateClip(selectedClipId);
          }
          break;

        case 'Escape':
          if (useEditorStore.getState().isCropMode) {
            useEditorStore.getState().setCropMode(false);
          } else {
            selectClip(null);
          }
          break;

        case 'Home':
          e.preventDefault();
          setCurrentTime(0);
          break;

        case 'Period':
          // Stop / return to start
          e.preventDefault();
          stop();
          break;

        case 'KeyS':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            toggleSnap();
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, deleteClip, duplicateClip, selectedClipId, selectClip, setCurrentTime, stop, toggleSnap, undo, redo]);
}
