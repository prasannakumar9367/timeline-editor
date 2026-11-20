import { useRef, useState, useEffect, useCallback } from 'react';
import './TimelineDemo.css';
import { useFadeIn } from '../../hooks/useFadeIn';

interface Clip {
  id: number;
  track: number;
  start: number;   // in px
  width: number;    // in px
  color: string;
  label: string;
}

const TRACK_H = 44;
const TIMELINE_W = 960;
const DURATION = 10; // seconds
const FPS_HISTORY = 30;

const initialClips: Clip[] = [
  { id: 1, track: 0, start: 0,   width: 200, color: '#e33529', label: 'Intro' },
  { id: 2, track: 0, start: 220, width: 180, color: '#2b52d9', label: 'Scene A' },
  { id: 3, track: 0, start: 420, width: 260, color: '#f2a900', label: 'Scene B' },
  { id: 4, track: 0, start: 700, width: 200, color: '#16a34a', label: 'Outro' },
  { id: 5, track: 1, start: 40,  width: 340, color: '#8b5cf6', label: 'Voiceover' },
  { id: 6, track: 1, start: 420, width: 300, color: '#ec4899', label: 'Music' },
  { id: 7, track: 2, start: 0,   width: 160, color: '#06b6d4', label: 'Title Card' },
  { id: 8, track: 2, start: 500, width: 200, color: '#f97316', label: 'Captions' },
  { id: 9, track: 2, start: 740, width: 160, color: '#14b8a6', label: 'Credits' },
];

export default function TimelineDemo() {
  const ref = useFadeIn();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [clips, setClips] = useState<Clip[]>(initialClips);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dragging, setDragging] = useState<{ id: number; offsetX: number } | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [fps, setFps] = useState(60);
  const fpsRef = useRef<number[]>([]);
  const lastFrame = useRef(performance.now());
  const rafRef = useRef(0);

  const pxToTime = (px: number) => (px / TIMELINE_W) * DURATION;
  const timeToPx = (t: number) => (t / DURATION) * TIMELINE_W;

  /* ── Canvas rendering ── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const scaleX = w / TIMELINE_W;
    const trackCount = 3;

    // Grid lines
    for (let i = 0; i <= DURATION; i++) {
      const x = timeToPx(i) * scaleX;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.strokeStyle = i % 5 === 0 ? 'rgba(28,27,26,.12)' : 'rgba(28,27,26,.05)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // time label
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(28,27,26,.35)';
        ctx.font = '10px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(`${i}s`, x, 12);
      }
    }

    // Track separators
    for (let t = 0; t < trackCount; t++) {
      const y = 18 + t * TRACK_H;
      ctx.fillStyle = t % 2 === 0 ? 'rgba(0,0,0,.015)' : 'transparent';
      ctx.fillRect(0, y, w, TRACK_H);
    }

    // Clips
    clips.forEach((clip) => {
      const x = clip.start * scaleX;
      const cw = clip.width * scaleX;
      const y = 18 + clip.track * TRACK_H + 4;
      const ch = TRACK_H - 8;
      const r = 6;

      // Shadow
      ctx.shadowColor = 'rgba(0,0,0,.12)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;

      // Rounded rect fill
      ctx.beginPath();
      ctx.roundRect(x, y, cw, ch, r);
      ctx.fillStyle = clip.color;
      ctx.fill();

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Label
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.font = 'bold 11px Inter, system-ui';
      ctx.textAlign = 'left';
      const textW = ctx.measureText(clip.label).width;
      if (textW < cw - 12) {
        ctx.fillText(clip.label, x + 8, y + ch / 2 + 4);
      }

      // Trim handles
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.fillRect(x + 2, y + ch/2 - 6, 2, 12);
      ctx.fillRect(x + cw - 4, y + ch/2 - 6, 2, 12);
    });

    // Playhead
    const phX = timeToPx(playhead) * scaleX;
    ctx.beginPath();
    ctx.moveTo(phX, 0);
    ctx.lineTo(phX, h);
    ctx.strokeStyle = '#e33529';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Playhead triangle
    ctx.beginPath();
    ctx.moveTo(phX - 6, 0);
    ctx.lineTo(phX + 6, 0);
    ctx.lineTo(phX, 8);
    ctx.closePath();
    ctx.fillStyle = '#e33529';
    ctx.fill();
  }, [clips, playhead]);

  /* ── Animation loop ── */
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      const now = performance.now();
      const delta = now - lastFrame.current;
      lastFrame.current = now;

      // FPS
      fpsRef.current.push(1000 / delta);
      if (fpsRef.current.length > FPS_HISTORY) fpsRef.current.shift();
      const avgFps = fpsRef.current.reduce((a, b) => a + b, 0) / fpsRef.current.length;
      setFps(Math.round(avgFps));

      if (playing) {
        setPlayhead((prev) => {
          const next = prev + delta / 1000;
          return next >= DURATION ? 0 : next;
        });
      }

      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [playing, draw]);

  /* ── Keyboard ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).closest('.tl-demo')) {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ── Mouse interactions ── */
  const getMousePos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * TIMELINE_W, y: e.clientY - rect.top };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    // Check if clicking on a clip
    for (const clip of clips) {
      const y = 18 + clip.track * TRACK_H;
      if (pos.x >= clip.start && pos.x <= clip.start + clip.width && pos.y >= y && pos.y <= y + TRACK_H) {
        setDragging({ id: clip.id, offsetX: pos.x - clip.start });
        return;
      }
    }
    // Otherwise scrub
    setScrubbing(true);
    setPlayhead(pxToTime(Math.max(0, Math.min(TIMELINE_W, pos.x))));
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    if (dragging) {
      setClips((prev) =>
        prev.map((c) =>
          c.id === dragging.id
            ? { ...c, start: Math.max(0, Math.min(TIMELINE_W - c.width, pos.x - dragging.offsetX)) }
            : c
        )
      );
    } else if (scrubbing) {
      setPlayhead(pxToTime(Math.max(0, Math.min(TIMELINE_W, pos.x))));
    }
  };

  const onMouseUp = () => {
    setDragging(null);
    setScrubbing(false);
  };

  return (
    <section id="demo" ref={ref} className="tl-demo">
      <div className="container">
        <p className="section-sub anim anim-up">Interactive Proof of Concept</p>
        <h2 className="section-title tl-title anim anim-up">
          <span className="section-num">🎬</span> Mini Timeline Editor
        </h2>
        <p className="tl-subtitle anim anim-up">
          Built with <strong>Canvas API</strong> + <strong>requestAnimationFrame</strong> — drag clips, scrub the playhead, press <kbd>Space</kbd> to play. This is the kind of editor surface I want to build at Atlabs.
        </p>

        <div className="tl-wrapper anim anim-zoom">
          {/* Controls bar */}
          <div className="tl-controls">
            <button className="tl-play" onClick={() => setPlaying(!playing)}>
              {playing ? '⏸' : '▶️'}
            </button>
            <span className="tl-time">
              {playhead.toFixed(1)}s / {DURATION}s
            </span>
            <div className="tl-spacer" />
            <span className={`tl-fps ${fps >= 55 ? 'green' : fps >= 30 ? 'yellow' : 'red'}`}>
              {fps} FPS
            </span>
            <span className="tl-hint">Drag clips · Click to scrub · Space to play</span>
          </div>

          {/* Track labels */}
          <div className="tl-body">
            <div className="tl-labels">
              <div className="tl-label">🎬 Video</div>
              <div className="tl-label">🎙️ Audio</div>
              <div className="tl-label">✏️ Text</div>
            </div>

            {/* Canvas */}
            <div className="tl-canvas-wrap">
              <canvas
                ref={canvasRef}
                className="tl-canvas"
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
              />
            </div>
          </div>

          {/* Features */}
          <div className="tl-features">
            {[
              { icon: '🖱️', label: 'Drag & Drop Clips' },
              { icon: '⏱️', label: 'Smooth Scrubbing' },
              { icon: '🎨', label: 'Canvas Rendering' },
              { icon: '⚡', label: '60fps rAF Loop' },
              { icon: '⌨️', label: 'Keyboard Shortcuts' },
              { icon: '📐', label: 'DPR-Aware Scaling' },
            ].map((f, i) => (
              <div key={i} className="tl-feat">
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
