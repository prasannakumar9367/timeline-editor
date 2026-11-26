import React, { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { CloseIcon, MicIcon, PlayIcon, StopIcon, VolumeOnIcon } from '../Icons/Icons';
import './TtsModal.css';

/** Encode captured mono Float32Array PCM chunks into a standard 16-bit PCM WAV File. */
function encodePcmToWavFile(
  chunks: Float32Array[],
  sampleRate: number,
  filename: string
): File {
  const totalLength = chunks.reduce((sum, arr) => sum + arr.length, 0);
  const dataSize = totalLength * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      const s = Math.max(-1, Math.min(1, chunk[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new File([buffer], filename, { type: 'audio/wav' });
}

/** Create a minimal valid silent PCM WAV file of `durationSec` so TTS clips save & load cleanly. */
function createSilentWavFile(durationSec: number, filename: string): File {
  const sampleRate = 8000;
  const numSamples = Math.max(sampleRate, Math.floor(sampleRate * durationSec));
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  return new File([buffer], filename, { type: 'audio/wav' });
}

/** Generate a realistic speech-cadence waveform from text for the timeline wave display. */
function buildSpeechWaveform(text: string, bars = 120): number[] {
  const peaks: number[] = [];
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = Math.max(1, words.length);

  for (let i = 0; i < bars; i++) {
    const t = i / bars;
    const wordIdx = Math.min(wordCount - 1, Math.floor(t * wordCount));
    const localPos = (t * wordCount) % 1;
    // Brief pause between words
    if (localPos > 0.86) {
      peaks.push(0.08);
      continue;
    }
    const word = words[wordIdx];
    const ch = word.charCodeAt(i % word.length) || 65;
    const wave = 0.32 + 0.58 * Math.abs(Math.sin(i * 0.65 + (ch % 11)));
    peaks.push(Number(Math.min(1, wave).toFixed(3)));
  }
  return peaks;
}

export default function TtsModal(): React.JSX.Element | null {
  const isOpen = useEditorStore((s) => s.isTtsModalOpen);
  const closeTtsModal = useEditorStore((s) => s.closeTtsModal);
  const addTtsClip = useEditorStore((s) => s.addTtsClip);
  const addMediaAndPlaceClip = useEditorStore((s) => s.addMediaAndPlaceClip);

  const [tab, setTab] = useState<'tts' | 'mic'>('tts');

  /* ── TTS State ── */
  const [text, setText] = useState('Welcome to Timeline Editor!');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [measuredDuration, setMeasuredDuration] = useState<number | null>(null);

  /* ── Mic Voiceover State ── */
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [micSeconds, setMicSeconds] = useState(0);
  const [micDuration, setMicDuration] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [micPreviewUrl, setMicPreviewUrl] = useState<string | null>(null);
  const [micFile, setMicFile] = useState<File | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef<number>(44100);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const micTimerRef = useRef<number>(0);
  const micStartWallRef = useRef<number>(0);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const waveRafRef = useRef<number>(0);

  const refreshMicDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === 'audioinput');
      setMicDevices(inputs);
      if (inputs.length > 0 && !selectedMicId) {
        setSelectedMicId(inputs[0].deviceId);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen && tab === 'mic') {
      void refreshMicDevices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tab]);

  // Load browser speech synthesis voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices();
      setVoices(list);
      if (list.length > 0 && !selectedVoice) {
        const defaultV = list.find((v) => v.default) ?? list[0];
        setSelectedVoice(defaultV.name);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoice]);

  // Cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setIsSpeaking(false);
      stopMicHardware();
    }
  }, [isOpen]);

  const stopMicVisualizer = () => {
    cancelAnimationFrame(waveRafRef.current);
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      void audioCtxRef.current.close();
    }
    audioCtxRef.current = null;
    setMicLevel(0);
  };

  const stopMicHardware = () => {
    window.clearInterval(micTimerRef.current);
    stopMicVisualizer();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    setIsRecordingMic(false);
  };

  if (!isOpen) return null;

  const estimatedDuration = (() => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1.5, Number(((words / 2.4) / rate).toFixed(1)));
  })();

  const handlePreviewSpeak = () => {
    if (!('speechSynthesis' in window) || !text.trim()) return;
    window.speechSynthesis.cancel();

    if (isSpeaking) {
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text.trim());
    const voiceObj = voices.find((v) => v.name === selectedVoice);
    if (voiceObj) utterance.voice = voiceObj;
    utterance.rate = rate;
    utterance.pitch = pitch;

    const startedAt = performance.now();
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      const sec = Math.max(1, Number(((performance.now() - startedAt) / 1000).toFixed(1)));
      setMeasuredDuration(sec);
    };
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleAddTts = () => {
    const clean = text.trim();
    if (!clean) return;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);

    const dur = measuredDuration ?? estimatedDuration;
    const safeSlug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20) || 'speech';
    const wavFile = createSilentWavFile(dur, `tts-${safeSlug}.wav`);
    const waveform = buildSpeechWaveform(clean, Math.max(80, Math.round(dur * 35)));

    addTtsClip({
      text: clean,
      voice: selectedVoice,
      rate,
      pitch,
      duration: dur,
      waveform,
      file: wavFile,
    });
    closeTtsModal();
  };

  const handleStartMic = async () => {
    setMicError(null);
    if (micPreviewUrl) {
      URL.revokeObjectURL(micPreviewUrl);
      setMicPreviewUrl(null);
      setMicFile(null);
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicError('Microphone recording is not supported in this browser.');
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      setMicError('Web Audio API is not supported in this browser.');
      return;
    }

    try {
      const audioConstraints: MediaTrackConstraints = selectedMicId
        ? {
            deviceId: { exact: selectedMicId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: true,
          }
        : {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: true,
          };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      micStreamRef.current = stream;
      // Refresh device labels now that permission is granted
      void refreshMicDevices();

      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      sampleRateRef.current = audioCtx.sampleRate;
      pcmChunksRef.current = [];

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;

      // Capture raw PCM audio directly from the live graph (immune to MediaRecorder silent-WebM bugs)
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        // Copy buffer so subsequent frames don't overwrite it
        pcmChunksRef.current.push(new Float32Array(input));
      };

      // Route through zero-gain node to destination so Chrome always pulls live audio frames without echo
      const zeroGain = audioCtx.createGain();
      zeroGain.gain.value = 0;

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(zeroGain);
      zeroGain.connect(audioCtx.destination);

      // Start live waveform canvas loop
      const timeData = new Uint8Array(analyser.fftSize);
      const history: number[] = new Array(56).fill(0.05);

      const draw = () => {
        analyser.getByteTimeDomainData(timeData);

        let sumSq = 0;
        for (let i = 0; i < timeData.length; i++) {
          const norm = (timeData[i] - 128) / 128;
          sumSq += norm * norm;
        }
        const rms = Math.sqrt(sumSq / timeData.length);
        const level = Math.min(1, rms * 4.5);
        setMicLevel(level);

        history.shift();
        history.push(Math.max(0.06, level));

        const canvas = waveCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = canvas.clientWidth || 380;
            const h = canvas.clientHeight || 64;
            if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
              canvas.width = Math.floor(w * dpr);
              canvas.height = Math.floor(h * dpr);
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);

            const midY = h / 2;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(0, midY - 0.5, w, 1);

            const barCount = history.length;
            const gap = 2.5;
            const barW = Math.max(2, (w - gap * (barCount - 1)) / barCount);

            for (let i = 0; i < barCount; i++) {
              const amp = history[i];
              const halfH = Math.max(2, amp * (h * 0.44));
              const x = i * (barW + gap);
              const y = midY - halfH;

              const grad = ctx.createLinearGradient(0, y, 0, y + halfH * 2);
              grad.addColorStop(0, '#38bdf8');
              grad.addColorStop(0.5, '#60a5fa');
              grad.addColorStop(1, '#38bdf8');
              ctx.fillStyle = amp > 0.12 ? grad : 'rgba(148, 163, 184, 0.35)';

              ctx.beginPath();
              ctx.roundRect(x, y, barW, halfH * 2, 2);
              ctx.fill();
            }
          }
        }

        waveRafRef.current = requestAnimationFrame(draw);
      };

      micStartWallRef.current = performance.now();
      setIsRecordingMic(true);
      setMicSeconds(0);
      waveRafRef.current = requestAnimationFrame(draw);

      micTimerRef.current = window.setInterval(() => {
        setMicSeconds(Math.floor((performance.now() - micStartWallRef.current) / 1000));
      }, 250);
    } catch (err) {
      setMicError(
        err instanceof Error
          ? err.message
          : 'Microphone access denied. Please allow microphone permission.'
      );
    }
  };

  const handleStopMic = () => {
    window.clearInterval(micTimerRef.current);
    const capturedChunks = pcmChunksRef.current;
    const sampleRate = sampleRateRef.current;

    stopMicVisualizer();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    setIsRecordingMic(false);

    const totalSamples = capturedChunks.reduce((sum, c) => sum + c.length, 0);
    if (totalSamples === 0) {
      setMicError('No audio was captured. Try selecting a different microphone above.');
      return;
    }

    // Check if the captured audio is completely flat/muted
    let maxAbs = 0;
    for (const chunk of capturedChunks) {
      for (let i = 0; i < chunk.length; i += 8) {
        const v = Math.abs(chunk[i]);
        if (v > maxAbs) maxAbs = v;
      }
    }
    if (maxAbs < 0.0005) {
      setMicError(
        'Microphone captured silence. Please switch the Microphone dropdown above or check your Windows mic privacy/mute settings.'
      );
    }

    const actualDuration = Math.max(0.5, Number((totalSamples / sampleRate).toFixed(2)));
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(11, 19);
    const wavFile = encodePcmToWavFile(capturedChunks, sampleRate, `voiceover-${stamp}.wav`);

    setMicDuration(actualDuration);
    setMicFile(wavFile);
    setMicPreviewUrl(URL.createObjectURL(wavFile));
    pcmChunksRef.current = [];
  };

  const handleUploadMic = async () => {
    if (!micFile) return;
    await addMediaAndPlaceClip(micFile, micDuration);
    if (micPreviewUrl) URL.revokeObjectURL(micPreviewUrl);
    setMicPreviewUrl(null);
    setMicFile(null);
    closeTtsModal();
  };

  const handleClose = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    stopMicHardware();
    if (micPreviewUrl) URL.revokeObjectURL(micPreviewUrl);
    setMicPreviewUrl(null);
    setMicFile(null);
    closeTtsModal();
  };

  const formatSec = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="tts-modal-backdrop" onClick={handleClose}>
      <div
        className="tts-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tts-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tts-modal-header">
          <h2 id="tts-modal-title" className="tts-modal-title">
            <VolumeOnIcon size={16} />
            <span>Text to Speech & Voiceover</span>
          </h2>
          <button
            type="button"
            className="tts-modal-close"
            onClick={handleClose}
            aria-label="Close"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="tts-tabs">
          <button
            type="button"
            className={`tts-tab ${tab === 'tts' ? 'active' : ''}`}
            onClick={() => setTab('tts')}
          >
            <VolumeOnIcon size={13} />
            <span>Text to Speech</span>
          </button>
          <button
            type="button"
            className={`tts-tab ${tab === 'mic' ? 'active' : ''}`}
            onClick={() => setTab('mic')}
          >
            <MicIcon size={13} />
            <span>Record Mic Voiceover</span>
          </button>
        </div>

        {tab === 'tts' ? (
          <>
            <div className="tts-modal-body">
              <div className="tts-field">
                <label htmlFor="tts-script" className="tts-label">
                  Script Text
                </label>
                <textarea
                  id="tts-script"
                  className="tts-textarea"
                  rows={4}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setMeasuredDuration(null);
                  }}
                  placeholder="Type what you want spoken..."
                />
              </div>

              <div className="tts-field">
                <label htmlFor="tts-voice" className="tts-label">
                  Voice
                </label>
                <select
                  id="tts-voice"
                  className="tts-select"
                  value={selectedVoice}
                  onChange={(e) => {
                    setSelectedVoice(e.target.value);
                    setMeasuredDuration(null);
                  }}
                >
                  {voices.length === 0 ? (
                    <option value="">Default System Voice</option>
                  ) : (
                    voices.map((v) => (
                      <option key={`${v.name}-${v.lang}`} value={v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="tts-row">
                <div className="tts-field">
                  <div className="tts-field-head">
                    <label htmlFor="tts-rate" className="tts-label">
                      Speed
                    </label>
                    <span className="tts-val">{rate.toFixed(1)}x</span>
                  </div>
                  <input
                    id="tts-rate"
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={rate}
                    onChange={(e) => {
                      setRate(Number(e.target.value));
                      setMeasuredDuration(null);
                    }}
                    className="tts-slider"
                  />
                </div>

                <div className="tts-field">
                  <div className="tts-field-head">
                    <label htmlFor="tts-pitch" className="tts-label">
                      Pitch
                    </label>
                    <span className="tts-val">{pitch.toFixed(1)}</span>
                  </div>
                  <input
                    id="tts-pitch"
                    type="range"
                    min={0.5}
                    max={1.5}
                    step={0.1}
                    value={pitch}
                    onChange={(e) => setPitch(Number(e.target.value))}
                    className="tts-slider"
                  />
                </div>
              </div>

              <div className="tts-info-bar">
                <span>Estimated duration: <strong>{(measuredDuration ?? estimatedDuration).toFixed(1)}s</strong></span>
                <button
                  type="button"
                  className="tts-btn tts-btn-secondary"
                  onClick={handlePreviewSpeak}
                  disabled={!text.trim()}
                >
                  {isSpeaking ? <StopIcon size={12} /> : <PlayIcon size={12} />}
                  <span>{isSpeaking ? 'Stop Preview' : 'Preview Voice'}</span>
                </button>
              </div>
            </div>

            <div className="tts-modal-footer">
              <button type="button" className="tts-btn tts-btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button
                type="button"
                className="tts-btn tts-btn-primary"
                onClick={handleAddTts}
                disabled={!text.trim()}
              >
                Add to Audio Track
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="tts-modal-body">
              {micDevices.length > 0 && (
                <div className="tts-field">
                  <label htmlFor="tts-mic-device" className="tts-label">
                    Microphone Input
                  </label>
                  <select
                    id="tts-mic-device"
                    className="tts-select"
                    value={selectedMicId}
                    disabled={isRecordingMic}
                    onChange={(e) => setSelectedMicId(e.target.value)}
                  >
                    {micDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `Microphone ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="tts-mic-box">
                <div className={`tts-mic-indicator ${isRecordingMic ? 'recording' : ''}`}>
                  <MicIcon size={24} />
                </div>
                <div className="tts-mic-timer">{formatSec(micSeconds)}</div>

                {/* Live Pitch / Amplitude Waveform Canvas */}
                {isRecordingMic && (
                  <div className="tts-mic-wave-wrap">
                    <canvas ref={waveCanvasRef} className="tts-mic-wave-canvas" />
                    <div className="tts-mic-signal-row">
                      <span
                        className={`tts-mic-signal-dot ${micLevel > 0.08 ? 'active' : ''}`}
                      />
                      <span>
                        {micLevel > 0.08 ? 'Voice detected — recording' : 'Listening… speak into your mic'}
                      </span>
                    </div>
                  </div>
                )}

                <p className="tts-mic-hint">
                  {isRecordingMic
                    ? 'Speak clearly — waveform reacts live to your voice'
                    : micPreviewUrl
                    ? `Recording ready (${micDuration.toFixed(1)}s) — preview or upload to timeline`
                    : 'Record a live voiceover directly into your Audio track'}
                </p>

                <div className="tts-mic-actions">
                  {isRecordingMic ? (
                    <button
                      type="button"
                      className="tts-btn tts-btn-danger"
                      onClick={handleStopMic}
                    >
                      <StopIcon size={12} />
                      <span>Stop Recording</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="tts-btn tts-btn-primary"
                      onClick={handleStartMic}
                    >
                      <MicIcon size={13} />
                      <span>{micPreviewUrl ? 'Record Again' : 'Start Recording'}</span>
                    </button>
                  )}
                </div>

                {micPreviewUrl && (
                  <audio src={micPreviewUrl} controls className="tts-mic-audio" />
                )}
              </div>

              {micError && <div className="tts-error">{micError}</div>}
            </div>

            <div className="tts-modal-footer">
              <button type="button" className="tts-btn tts-btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button
                type="button"
                className="tts-btn tts-btn-primary"
                onClick={handleUploadMic}
                disabled={!micFile || isRecordingMic}
              >
                Upload to Audio Track
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
