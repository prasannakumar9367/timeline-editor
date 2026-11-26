import React, { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { CameraIcon, CloseIcon, MicIcon, StopIcon, UploadIcon } from '../Icons/Icons';
import './RecordModal.css';

type SourceMode = 'camera' | 'screen';

export default function RecordModal(): React.JSX.Element | null {
  const isOpen = useEditorStore((s) => s.isRecordModalOpen);
  const closeRecordModal = useEditorStore((s) => s.closeRecordModal);
  const addMediaAndPlaceClip = useEditorStore((s) => s.addMediaAndPlaceClip);

  const [sourceMode, setSourceMode] = useState<SourceMode>('camera');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number>(0);

  const stopStream = () => {
    window.clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
    setIsStreamReady(false);
    setIsRecording(false);
  };

  const startLivePreview = async (mode: SourceMode, withAudio: boolean) => {
    stopStream();
    setError(null);
    try {
      let stream: MediaStream;
      if (mode === 'screen') {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: withAudio,
        });
        if (withAudio && displayStream.getAudioTracks().length === 0) {
          try {
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream = new MediaStream([
              ...displayStream.getVideoTracks(),
              ...micStream.getAudioTracks(),
            ]);
          } catch {
            stream = displayStream;
          }
        } else {
          stream = displayStream;
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: withAudio,
        });
      }

      streamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play().catch(() => {});
      }
      setIsStreamReady(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not access camera/screen. Please allow browser permissions.'
      );
    }
  };

  // Start camera automatically when modal opens (unless viewing a recorded clip)
  useEffect(() => {
    if (isOpen && !recordedUrl) {
      void startLivePreview(sourceMode, includeAudio);
    }
    if (!isOpen) {
      stopStream();
    }
    return () => {
      if (!isOpen) stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sourceMode, includeAudio]);

  if (!isOpen) return null;

  const handleStartRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;

    setError(null);
    chunksRef.current = [];

    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];
    const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 })
      : new MediaRecorder(stream);

    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const finalType = mimeType || 'video/webm';
      const ext = finalType.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunksRef.current, { type: finalType });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(11, 19);
      const file = new File([blob], `live-recording-${stamp}.${ext}`, { type: finalType });

      setRecordedFile(file);
      setRecordedUrl(URL.createObjectURL(blob));
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setIsStreamReady(false);
    };

    recorder.start(200);
    setIsRecording(true);
    setElapsedSec(0);
    timerRef.current = window.setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
  };

  const handleStopRecording = () => {
    window.clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleRetake = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setRecordedFile(null);
    setElapsedSec(0);
    void startLivePreview(sourceMode, includeAudio);
  };

  const handleUploadToEditor = async () => {
    if (!recordedFile) return;
    setIsUploading(true);
    await addMediaAndPlaceClip(recordedFile);
    setIsUploading(false);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setRecordedFile(null);
    closeRecordModal();
  };

  const handleClose = () => {
    stopStream();
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setRecordedFile(null);
    setElapsedSec(0);
    closeRecordModal();
  };

  const formatTimer = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="record-modal-backdrop" onClick={handleClose}>
      <div
        className="record-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="record-modal-header">
          <h2 id="record-modal-title" className="record-modal-title">
            <CameraIcon size={16} />
            <span>Record Live Video</span>
          </h2>
          <button
            type="button"
            className="record-modal-close"
            onClick={handleClose}
            aria-label="Close"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="record-modal-body">
          {/* Source & Audio Controls */}
          {!recordedUrl && (
            <div className="record-controls-row">
              <div className="record-mode-group">
                <button
                  type="button"
                  className={`record-mode-btn ${sourceMode === 'camera' ? 'active' : ''}`}
                  disabled={isRecording}
                  onClick={() => setSourceMode('camera')}
                >
                  Camera
                </button>
                <button
                  type="button"
                  className={`record-mode-btn ${sourceMode === 'screen' ? 'active' : ''}`}
                  disabled={isRecording}
                  onClick={() => setSourceMode('screen')}
                >
                  Screen
                </button>
              </div>

              <label className="record-audio-toggle">
                <input
                  type="checkbox"
                  checked={includeAudio}
                  disabled={isRecording}
                  onChange={(e) => setIncludeAudio(e.target.checked)}
                />
                <MicIcon size={13} />
                <span>Include Audio</span>
              </label>
            </div>
          )}

          {/* Video Stage */}
          <div className="record-stage">
            {recordedUrl ? (
              <video src={recordedUrl} controls autoPlay className="record-video" />
            ) : (
              <>
                <video
                  ref={liveVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`record-video ${sourceMode === 'camera' ? 'record-video--mirrored' : ''}`}
                />
                {isRecording && (
                  <div className="record-live-badge">
                    <span className="record-live-dot" />
                    <span>REC {formatTimer(elapsedSec)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {error && <div className="record-error">{error}</div>}
        </div>

        <div className="record-modal-footer">
          {recordedUrl ? (
            <>
              <button
                type="button"
                className="record-btn record-btn-secondary"
                onClick={handleRetake}
                disabled={isUploading}
              >
                Retake
              </button>
              <button
                type="button"
                className="record-btn record-btn-primary"
                onClick={handleUploadToEditor}
                disabled={isUploading}
              >
                <UploadIcon size={14} />
                <span>{isUploading ? 'Uploading…' : 'Upload to Timeline'}</span>
              </button>
            </>
          ) : (
            <>
              <button type="button" className="record-btn record-btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              {isRecording ? (
                <button
                  type="button"
                  className="record-btn record-btn-danger"
                  onClick={handleStopRecording}
                >
                  <StopIcon size={12} />
                  <span>Stop Recording ({formatTimer(elapsedSec)})</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="record-btn record-btn-danger"
                  onClick={handleStartRecording}
                  disabled={!isStreamReady}
                >
                  <span className="record-btn-dot" />
                  <span>Start Recording</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
