import { useState, useEffect, useRef } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Volume2,
  VolumeX,
  Sparkles,
  Layers,
  CheckCircle,
  Copy,
  Check,
  Film,
  Upload,
  Sliders,
  Link2
} from 'lucide-react'

// Curated 9:16 Vertical B-Roll Video Loops
const CURATED_BROLL_VIDEOS = [
  {
    id: 'MONEY_VAULT',
    label: '💵 Cash Stacks & Wealth',
    desc: 'Hundreds, bank vault & cash rain',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    fallbackTheme: 'GOLD_LIQUID'
  },
  {
    id: 'TRADING_TERMINAL',
    label: '📈 Live Trading Terminal',
    desc: 'High-frequency candlestick chart',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    fallbackTheme: 'MATRIX_STREAM'
  },
  {
    id: 'NEON_SUPERCAR',
    label: '🏎️ Night Highway Cruise',
    desc: 'Exotic supercar through neon city',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    fallbackTheme: 'CYBER_GRID'
  },
  {
    id: 'RAINY_SKYSCRAPER',
    label: '🏙️ Rainy Metropolis',
    desc: 'Moody penthouse skyline & lightning',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    fallbackTheme: 'DEEP_SPACE'
  }
]

export default function KineticCanvasPlayer({
  audioUri,
  duration = 30,
  cues = [],
  title = 'Viral Short',
  affiliateCopy = '',
  tags = []
}) {
  const canvasRef = useRef(null)
  const audioRef = useRef(null)
  const videoRef = useRef(null)
  const fileInputRef = useRef(null)
  const animFrameRef = useRef(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  
  // Background Mode: 'BROLL' (real video) or 'PROCEDURAL' (canvas art)
  const [bgMode, setBgMode] = useState('BROLL')
  const [selectedBrollId, setSelectedBrollId] = useState('MONEY_VAULT')
  const [activeVideoSrc, setActiveVideoSrc] = useState(CURATED_BROLL_VIDEOS[0].videoUrl)
  const [bgTheme, setBgTheme] = useState('GOLD_LIQUID')
  const [dimmerOpacity, setDimmerOpacity] = useState(0.40) // 40% contrast overlay
  const [customVideoName, setCustomVideoName] = useState(null)
  
  const [fontStyle, setFontStyle] = useState('HORMOZI') // 'HORMOZI' | 'BEAST' | 'CLEAN'
  const [isRecording, setIsRecording] = useState(false)
  const [recordProgress, setRecordProgress] = useState(0)
  const [copiedSection, setCopiedSection] = useState(null)
  const [enableBassDrop, setEnableBassDrop] = useState(true)

  // Cinematic Sub-Bass Impact Synthesizer for 0-3s Hook Retention
  const playCinematicBassDrop = () => {
    if (!enableBassDrop) return
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(110, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(36, ctx.currentTime + 1.1)

      gain.gain.setValueAtTime(0.35, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.3)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 1.4)
    } catch (e) {
      console.warn('Audio effect note:', e)
    }
  }

  // Initialize Audio element
  useEffect(() => {
    if (audioUri) {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      const audio = new Audio(audioUri)
      audioRef.current = audio

      audio.onended = () => {
        setIsPlaying(false)
        setCurrentTime(0)
      }
      setCurrentTime(0)
      setIsPlaying(false)
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [audioUri])

  // Play / Pause Toggle
  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      if (videoRef.current) videoRef.current.pause()
      setIsPlaying(false)
    } else {
      if (currentTime < 0.5) {
        playCinematicBassDrop()
      }
      audioRef.current.play()
      if (videoRef.current) videoRef.current.play().catch(() => {})
      setIsPlaying(true)
    }
  }

  // Reset / Rewind
  const handleReset = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
    setCurrentTime(0)
    setIsPlaying(false)
  }

  // Custom Video File Upload Handler
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setActiveVideoSrc(url)
    setSelectedBrollId('CUSTOM_UPLOAD')
    setCustomVideoName(file.name)
    setBgMode('BROLL')
  }

  // Active Cue Detection
  const activeCue = cues.find(c => currentTime >= c.start && currentTime <= c.end) || null

  // Canvas Render Loop (360 x 640 @ 60fps)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let frameCount = 0

    const render = () => {
      frameCount++

      // Update current playback time from audio (throttled to ~8 FPS to prevent React re-render thrashing)
      if (audioRef.current && isPlaying) {
        const audioTime = audioRef.current.currentTime
        if (frameCount % 8 === 0) {
          setCurrentTime(audioTime)
        }
      }

      const w = canvas.width
      const h = canvas.height

      // 1. Draw Background: Real B-Roll Video OR Procedural Canvas
      let videoRendered = false
      if (bgMode === 'BROLL' && videoRef.current) {
        try {
          const v = videoRef.current
          if (v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0) {
            const vw = v.videoWidth
            const vh = v.videoHeight
            const scale = Math.max(w / vw, h / vh)
            const sw = vw * scale
            const sh = vh * scale
            const sx = (w - sw) / 2
            const sy = (h - sh) / 2
            ctx.drawImage(v, sx, sy, sw, sh)
            videoRendered = true
          }
        } catch (e) {
          videoRendered = false
        }
      }

      // Procedural Atmosphere Fallback (active if procedural mode or video loading)
      if (!videoRendered) {
        if (bgTheme === 'CYBER_GRID') {
          // Deep purple to navy gradient
          const grad = ctx.createLinearGradient(0, 0, 0, h)
          grad.addColorStop(0, '#090514')
          grad.addColorStop(0.5, '#160d2e')
          grad.addColorStop(1, '#05030a')
          ctx.fillStyle = grad
          ctx.fillRect(0, 0, w, h)

          // Perspective Synthwave Grid
          ctx.strokeStyle = 'rgba(236, 72, 153, 0.28)'
          ctx.lineWidth = 1.5
          const horizon = h * 0.65
          const speed = (frameCount * 1.5) % 35

          for (let y = horizon; y < h; y += 30) {
            const dy = y + speed
            if (dy < h) {
              ctx.beginPath()
              ctx.moveTo(0, dy)
              ctx.lineTo(w, dy)
              ctx.stroke()
            }
          }

          const cx = w / 2
          for (let x = -w; x <= w * 2; x += 40) {
            ctx.beginPath()
            ctx.moveTo(cx, horizon)
            ctx.lineTo(x, h)
            ctx.stroke()
          }

          const sunGrad = ctx.createRadialGradient(cx, horizon - 20, 10, cx, horizon - 20, 80)
          sunGrad.addColorStop(0, 'rgba(244, 63, 94, 0.8)')
          sunGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.4)')
          sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
          ctx.fillStyle = sunGrad
          ctx.beginPath()
          ctx.arc(cx, horizon - 20, 80, 0, Math.PI * 2)
          ctx.fill()
        } else if (bgTheme === 'MATRIX_STREAM') {
          ctx.fillStyle = 'rgba(6, 10, 15, 0.35)'
          ctx.fillRect(0, 0, w, h)

          ctx.fillStyle = 'rgba(34, 197, 94, 0.35)'
          ctx.font = '11px monospace'
          for (let x = 15; x < w; x += 28) {
            const char = Math.random() > 0.5 ? '1' : '0'
            const y = ((frameCount * 3 + x * 8) % h)
            ctx.fillText(char, x, y)
            if (Math.random() > 0.8) {
              ctx.fillStyle = 'rgba(16, 185, 129, 0.7)'
              ctx.fillText('$' + Math.floor(Math.random() * 900), x, (y + 40) % h)
              ctx.fillStyle = 'rgba(34, 197, 94, 0.35)'
            }
          }
        } else if (bgTheme === 'DEEP_SPACE') {
          ctx.fillStyle = '#030712'
          ctx.fillRect(0, 0, w, h)

          for (let i = 0; i < 35; i++) {
            const sx = (Math.sin(i * 123 + frameCount * 0.01) * 0.5 + 0.5) * w
            const sy = (Math.cos(i * 321 + frameCount * 0.01) * 0.5 + 0.5) * h
            const alpha = Math.abs(Math.sin(frameCount * 0.05 + i)) * 0.8
            ctx.fillStyle = `rgba(147, 197, 253, ${alpha})`
            ctx.beginPath()
            ctx.arc(sx, sy, (i % 3) + 1, 0, Math.PI * 2)
            ctx.fill()
          }
        } else {
          // Luxury Gold Waves
          const grad = ctx.createLinearGradient(0, 0, w, h)
          grad.addColorStop(0, '#0c0a09')
          grad.addColorStop(0.5, '#1c1917')
          grad.addColorStop(1, '#0c0a09')
          ctx.fillStyle = grad
          ctx.fillRect(0, 0, w, h)

          ctx.strokeStyle = 'rgba(234, 179, 8, 0.22)'
          ctx.lineWidth = 2
          for (let i = 0; i < 4; i++) {
            ctx.beginPath()
            for (let x = 0; x <= w; x += 10) {
              const y = (h * 0.4) + Math.sin((x * 0.015) + (frameCount * 0.02) + i) * 60 + (i * 45)
              if (x === 0) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
            }
            ctx.stroke()
          }
        }
      }

      // 1.5 Contrast Dimmer Vignette (darkens video so subtitles pop)
      if (dimmerOpacity > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${dimmerOpacity})`
        ctx.fillRect(0, 0, w, h)
      }

      // 2. Draw Top Branding Badge
      ctx.save()
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)'
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(w / 2 - 65, 38, 130, 26, 13)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#38bdf8'
      ctx.font = 'bold 10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('⚡ VIRAL INTEL', w / 2, 54)
      ctx.restore()

      // 3. Draw Kinetic Word-by-Word Subtitles
      if (activeCue) {
        ctx.save()
        const textY = h * 0.52 // Center screen for maximum retention

        // Subtitle container card
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        if (fontStyle === 'HORMOZI') {
          // Bold Hormozi-style glowing block letters
          ctx.font = '900 24px "Impact", "Arial Black", sans-serif'
          ctx.shadowColor = 'rgba(0, 0, 0, 0.95)'
          ctx.shadowBlur = 14
          ctx.lineWidth = 6
          ctx.strokeStyle = '#000000'

          // Punch pop scale effect on word burst
          const cueProgress = Math.min(1, (currentTime - activeCue.start) / Math.max(0.1, activeCue.duration))
          const scale = 1.08 - (cueProgress * 0.08)

          ctx.translate(w / 2, textY)
          ctx.scale(scale, scale)

          // Outline stroke
          ctx.strokeText(activeCue.text, 0, 0)

          // Radiant Yellow / Cyan fill
          ctx.fillStyle = '#FACC15'
          ctx.fillText(activeCue.text, 0, 0)
        } else if (fontStyle === 'BEAST') {
          // MrBeast bold yellow on black pill
          ctx.font = '900 21px sans-serif'
          const metrics = ctx.measureText(activeCue.text)
          const boxW = metrics.width + 28
          const boxH = 40

          ctx.fillStyle = 'rgba(0, 0, 0, 0.88)'
          ctx.beginPath()
          ctx.roundRect((w - boxW) / 2, textY - 20, boxW, boxH, 8)
          ctx.fill()

          ctx.fillStyle = '#38BDF8'
          ctx.fillText(activeCue.text, w / 2, textY)
        } else {
          // Clean Modern White with Green Glow
          ctx.font = 'bold 22px sans-serif'
          ctx.lineWidth = 4
          ctx.strokeStyle = '#052e16'
          ctx.strokeText(activeCue.text, w / 2, textY)
          ctx.fillStyle = '#4ade80'
          ctx.fillText(activeCue.text, w / 2, textY)
        }

        ctx.restore()
      } else {
        // Idle watermark text when paused / starting
        ctx.save()
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Tap Play to Preview Viral Short', w / 2, h * 0.52)
        ctx.restore()
      }

      // 4. Draw Bottom Audio Wave / Progress Tracker
      const progressPct = duration > 0 ? Math.min(1, currentTime / duration) : 0
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.fillRect(20, h - 30, w - 40, 4)

      ctx.fillStyle = '#38bdf8'
      ctx.fillRect(20, h - 30, (w - 40) * progressPct, 4)

      animFrameRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [bgTheme, fontStyle, activeCue, isPlaying, duration, currentTime])

  // Direct MP4 / WebM Export using Canvas.captureStream + MediaRecorder
  const handleExportVideo = async () => {
    const canvas = canvasRef.current
    if (!canvas || !audioRef.current) {
      alert('Audio or Canvas not initialized!')
      return
    }

    setIsRecording(true)
    setRecordProgress(0)

    try {
      const stream = canvas.captureStream(30) // 30 FPS

      // Hook audio stream into recorder via Web Audio API
      let combinedStream = stream
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        const audioCtx = new AudioCtx()
        const source = audioCtx.createMediaElementSource(audioRef.current)
        const dest = audioCtx.createMediaStreamDestination()
        source.connect(dest)
        source.connect(audioCtx.destination)

        const audioTrack = dest.stream.getAudioTracks()[0]
        if (audioTrack) {
          combinedStream.addTrack(audioTrack)
        }
      } catch (e) {
        console.warn('Audio capture hook warning:', e)
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm'
      })

      const chunks = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30)}_viral_short.webm`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setIsRecording(false)
        setRecordProgress(100)
      }

      // Reset to beginning and play during recording
      audioRef.current.currentTime = 0
      if (videoRef.current) {
        videoRef.current.currentTime = 0
        videoRef.current.play().catch(() => {})
      }
      recorder.start()
      audioRef.current.play()
      setIsPlaying(true)

      // Automatically stop recording when audio ends
      const checkEnd = setInterval(() => {
        if (!audioRef.current) {
          clearInterval(checkEnd)
          if (videoRef.current) videoRef.current.pause()
          return
        }
        const pct = Math.min(100, Math.round((audioRef.current.currentTime / duration) * 100))
        setRecordProgress(pct)

        if (audioRef.current.currentTime >= duration || audioRef.current.ended) {
          clearInterval(checkEnd)
          recorder.stop()
          if (videoRef.current) videoRef.current.pause()
          setIsPlaying(false)
        }
      }, 250)
    } catch (err) {
      console.error('Export error:', err)
      alert('Failed to record video: ' + err.message)
      setIsRecording(false)
    }
  }

  const copyToClipboard = (text, key) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedSection(key)
      setTimeout(() => setCopiedSection(null), 2000)
    }
  }

  return (
    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* 9:16 Smartphone Simulator Frame */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          position: 'relative',
          width: '340px',
          height: '604px',
          background: '#090d16',
          borderRadius: '36px',
          padding: '10px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.15)',
          border: '3px solid #1e293b'
        }}>
          {/* Smartphone Camera Notch */}
          <div style={{
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '80px',
            height: '18px',
            background: '#000',
            borderRadius: '10px',
            zIndex: 10
          }} />

          {/* Canvas Viewport */}
          <canvas
            ref={canvasRef}
            width={320}
            height={580}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '26px',
              display: 'block',
              background: '#030712'
            }}
          />

          {/* Background Video Element for Canvas Compositing */}
          <video
            ref={videoRef}
            src={activeVideoSrc}
            crossOrigin="anonymous"
            loop
            muted
            playsInline
            style={{ display: 'none' }}
          />

          {/* Custom Video File Upload Input */}
          <input
            type="file"
            ref={fileInputRef}
            accept="video/mp4,video/webm"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
        </div>

        {/* Video Controls Toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginTop: '1rem',
          background: '#0f172a',
          padding: '8px 16px',
          borderRadius: '24px',
          border: '1px solid #1e293b'
        }}>
          <button
            onClick={togglePlay}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: isPlaying ? '#e11d48' : '#0284c7',
              border: 'none',
              color: '#fff',
              cursor: 'pointer'
            }}
            title={isPlaying ? 'Pause' : 'Play Preview'}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: '2px' }} />}
          </button>

          <button
            onClick={handleReset}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px'
            }}
            title="Restart to Beginning"
          >
            <RotateCcw size={16} />
          </button>

          <button
            onClick={() => {
              const nextState = !enableBassDrop
              setEnableBassDrop(nextState)
              if (nextState) playCinematicBassDrop()
            }}
            style={{
              background: enableBassDrop ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              border: `1px solid ${enableBassDrop ? '#38bdf8' : '#334155'}`,
              color: enableBassDrop ? '#38bdf8' : '#64748b',
              padding: '4px 9px',
              borderRadius: '12px',
              fontSize: '0.70rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Cinematic Sub-Bass rumble on 0-3s hook to maximize viewer retention"
          >
            <Volume2 size={13} />
            <span>{enableBassDrop ? 'Bass: ON' : 'Bass: OFF'}</span>
          </button>

          <span style={{ fontSize: '0.80rem', color: '#94a3b8', minWidth: '70px', textAlign: 'center' }}>
            {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
          </span>

          <button
            onClick={handleExportVideo}
            disabled={isRecording || !audioUri}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: isRecording ? '#d97706' : '#10b981',
              border: 'none',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: '16px',
              fontSize: '0.80rem',
              fontWeight: 700,
              cursor: isRecording || !audioUri ? 'not-allowed' : 'pointer'
            }}
          >
            <Download size={14} />
            <span>{isRecording ? `Rendering ${recordProgress}%` : 'Download 9:16 Video'}</span>
          </button>
        </div>
      </div>

      {/* Visual Customization & Export Package Deck */}
      <div style={{ flex: '1', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Background Atmosphere & B-Roll Video Studio Card */}
        <div style={{
          background: '#0f172a',
          padding: '1.15rem',
          borderRadius: '16px',
          border: '1px solid #1e293b'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Film size={14} style={{ color: '#38bdf8' }} />
              <span>Background Atmosphere & B-Roll</span>
            </h4>
            
            {/* Mode Switcher Pill */}
            <div style={{ display: 'flex', background: '#090d16', padding: '3px', borderRadius: '10px', border: '1px solid #1e293b' }}>
              <button
                onClick={() => setBgMode('BROLL')}
                style={{
                  background: bgMode === 'BROLL' ? '#0284c7' : 'transparent',
                  color: bgMode === 'BROLL' ? '#fff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '7px',
                  padding: '3px 10px',
                  fontSize: '0.70rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🎬 B-Roll Video
              </button>
              <button
                onClick={() => setBgMode('PROCEDURAL')}
                style={{
                  background: bgMode === 'PROCEDURAL' ? '#0284c7' : 'transparent',
                  color: bgMode === 'PROCEDURAL' ? '#fff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '7px',
                  padding: '3px 10px',
                  fontSize: '0.70rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🎨 Canvas Art
              </button>
            </div>
          </div>

          {/* Real B-Roll Video Selector */}
          {bgMode === 'BROLL' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                {CURATED_BROLL_VIDEOS.map(v => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedBrollId(v.id)
                      setActiveVideoSrc(v.videoUrl)
                      setBgTheme(v.fallbackTheme)
                      setCustomVideoName(null)
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: selectedBrollId === v.id ? '#1e293b' : '#0b1120',
                      border: `1px solid ${selectedBrollId === v.id ? '#38bdf8' : '#1e293b'}`,
                      color: selectedBrollId === v.id ? '#38bdf8' : '#94a3b8',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>{v.label}</div>
                    <div style={{ fontSize: '0.66rem', color: '#64748b' }}>{v.desc}</div>
                  </button>
                ))}
              </div>

              {/* Upload Custom Video File Input Trigger */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    flex: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    background: selectedBrollId === 'CUSTOM_UPLOAD' ? '#0284c7' : '#1e293b',
                    border: '1px dashed #38bdf8',
                    color: '#fff',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Upload size={13} />
                  <span>{customVideoName ? `📁 ${customVideoName.slice(0, 18)}...` : 'Upload Custom MP4 / WebM'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Procedural Canvas Themes */}
          {bgMode === 'PROCEDURAL' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { id: 'CYBER_GRID', label: '🌆 Synthwave Grid', desc: 'Futuristic horizon' },
                { id: 'MATRIX_STREAM', label: '📊 Financial Stream', desc: 'Matrix green candles' },
                { id: 'DEEP_SPACE', label: '🌌 Deep Nebula', desc: 'Cosmic particle field' },
                { id: 'GOLD_LIQUID', label: '🪙 Luxury Gold', desc: 'Flowing wealth wave' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setBgTheme(t.id)}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: bgTheme === t.id ? '#1e293b' : '#0b1120',
                    border: `1px solid ${bgTheme === t.id ? '#38bdf8' : '#1e293b'}`,
                    color: bgTheme === t.id ? '#38bdf8' : '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontSize: '0.80rem', fontWeight: 700 }}>{t.label}</div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{t.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* Contrast Dimmer Control (Crucial for subtitle readability) */}
          <div style={{
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sliders size={12} style={{ color: '#f59e0b' }} />
                <span>Text Contrast Dimmer:</span>
              </span>
              <span style={{ fontWeight: 700, color: '#f8fafc' }}>{Math.round(dimmerOpacity * 100)}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="range"
                min="0"
                max="0.85"
                step="0.05"
                value={dimmerOpacity}
                onChange={(e) => setDimmerOpacity(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: '#38bdf8', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', gap: '4px' }}>
                {[
                  { label: 'Light', val: 0.25 },
                  { label: 'Balanced', val: 0.45 },
                  { label: 'Dark', val: 0.65 }
                ].map(p => (
                  <button
                    key={p.label}
                    onClick={() => setDimmerOpacity(p.val)}
                    style={{
                      background: Math.abs(dimmerOpacity - p.val) < 0.05 ? '#38bdf8' : '#1e293b',
                      color: Math.abs(dimmerOpacity - p.val) < 0.05 ? '#000' : '#94a3b8',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Subtitle Font Style */}
        <div style={{
          background: '#0f172a',
          padding: '1rem',
          borderRadius: '16px',
          border: '1px solid #1e293b'
        }}>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} style={{ color: '#f59e0b' }} />
            <span>Kinetic Subtitle Typography</span>
          </h4>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { id: 'HORMOZI', label: '🔥 Hormozi Pop', desc: 'Yellow glowing punch' },
              { id: 'BEAST', label: '⚡ Beast Box', desc: 'Black pill box' },
              { id: 'CLEAN', label: '🟢 Clean Glow', desc: 'Neon green accent' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFontStyle(f.id)}
                style={{
                  flex: '1',
                  textAlign: 'center',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: fontStyle === f.id ? '#1e293b' : '#0b1120',
                  border: `1px solid ${fontStyle === f.id ? '#f59e0b' : '#1e293b'}`,
                  color: fontStyle === f.id ? '#f59e0b' : '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: '0.80rem', fontWeight: 700 }}>{f.label}</div>
                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{f.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Multi-Platform Monetization & Copy Box */}
        <div style={{
          background: '#0f172a',
          padding: '1rem',
          borderRadius: '16px',
          border: '1px solid #1e293b'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>💸 Affiliate Bio & Pinned Comment</span>
            <button
              onClick={() => copyToClipboard(affiliateCopy, 'affiliate')}
              style={{
                background: 'transparent',
                border: 'none',
                color: copiedSection === 'affiliate' ? '#10b981' : '#38bdf8',
                fontSize: '0.72rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {copiedSection === 'affiliate' ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiedSection === 'affiliate' ? 'Copied!' : 'Copy'}</span>
            </button>
          </h4>
          <p style={{
            fontSize: '0.75rem',
            background: '#0b1120',
            padding: '8px 10px',
            borderRadius: '6px',
            color: '#cbd5e1',
            margin: '0 0 0.75rem 0',
            lineHeight: 1.4
          }}>
            {affiliateCopy || '🎁 Grab up to 12 FREE Stocks (worth up to $3,000) on Webull: Link in bio!'}
          </p>

          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>#️⃣ Viral Hashtags</span>
            <button
              onClick={() => copyToClipboard(tags.join(' '), 'tags')}
              style={{
                background: 'transparent',
                border: 'none',
                color: copiedSection === 'tags' ? '#10b981' : '#38bdf8',
                fontSize: '0.72rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {copiedSection === 'tags' ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiedSection === 'tags' ? 'Copied!' : 'Copy'}</span>
            </button>
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {tags.map((t, idx) => (
              <span key={idx} style={{ fontSize: '0.70rem', background: '#1e293b', color: '#93c5fd', padding: '3px 8px', borderRadius: '4px' }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
