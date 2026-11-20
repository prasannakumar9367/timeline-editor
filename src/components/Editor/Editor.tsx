import { useEffect } from 'react';
import Toolbar from '../Toolbar/Toolbar';
import MediaLibrary from '../MediaLibrary/MediaLibrary';
import Preview from '../Preview/Preview';
import Timeline from '../Timeline/Timeline';
import PropertiesPanel from '../PropertiesPanel/PropertiesPanel';
import ExportModal from '../ExportModal/ExportModal';
import { useKeyboard } from '../../hooks/useKeyboard';
import { usePlayback } from '../../hooks/usePlayback';
import { useEditorStore } from '../../store/editorStore';
import './Editor.css';

export default function Editor() {
  useKeyboard();
  const fps = usePlayback();
  const loadSavedProject = useEditorStore((s) => s.loadSavedProject);

  useEffect(() => {
    void loadSavedProject();
  }, [loadSavedProject]);

  return (
    <div className="editor-container">
      <div className="editor-toolbar">
        <Toolbar fps={fps} />
      </div>
      <div className="editor-media-library editor-media-lib">
        <MediaLibrary />
      </div>
      <div className="editor-preview">
        <Preview />
      </div>
      <div className="editor-properties editor-props">
        <PropertiesPanel />
      </div>
      <div className="editor-timeline">
        <Timeline />
      </div>
      <ExportModal />
    </div>
  );
}
