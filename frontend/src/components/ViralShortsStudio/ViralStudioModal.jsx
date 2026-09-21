import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  X,
  Video,
  Mic,
  FileText,
  DollarSign,
  TrendingUp,
  Play,
  RotateCcw,
  Layers,
  Wand2,
  CheckCircle,
  ExternalLink,
  ChevronRight,
  Flame
} from 'lucide-react'
import KineticCanvasPlayer from './KineticCanvasPlayer'

export default function ViralStudioModal({
  isOpen = false,
  onClose,
  isFullScreen = false,
  onSwitchToQuant,
  API_BASE_URL = 'http://127.0.0.1:8000'
}) {
  const [activeStep, setActiveStep] = useState(1) // 1: Niche, 2: Script, 3: Voice, 4: Video
  const [niches, setNiches] = useState([])
  const [selectedNiche, setSelectedNiche] = useState('psychology_secrets')
  const [customPrompt, setCustomPrompt] = useState('')

  // Script State
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [scriptData, setScriptData] = useState(null)
  const [editableScript, setEditableScript] = useState('')

  // Voice State
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState('christopher')
  const [speechRate, setSpeechRate] = useState('+10%')
  const [isSynthesizingVoice, setIsSynthesizingVoice] = useState(false)
  const [voiceData, setVoiceData] = useState(null)

  // Fetch Niches and Voices on mount
  useEffect(() => {
    if (isOpen || isFullScreen) {
      fetch(`${API_BASE_URL}/api/viral/niches/`)
        .then(res => res.json())
        .then(data => {
          setNiches(data)
          if (data.length > 0 && !selectedNiche) {
            setSelectedNiche(data[0].id)
          }
        })
        .catch(err => console.error('Failed to fetch niches:', err))

      fetch(`${API_BASE_URL}/api/viral/voices/`)
        .then(res => res.json())
        .then(data => setVoices(data))
        .catch(err => console.error('Failed to fetch voices:', err))
    }
  }, [isOpen, isFullScreen, API_BASE_URL])

  // Step 1 -> 2: Generate Script
  const handleGenerateScript = async () => {
    setIsGeneratingScript(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/viral/generate-script/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: selectedNiche,
          prompt: customPrompt.trim() || null
        })
      })
      if (res.ok) {
        const data = await res.json()
        setScriptData(data)
        setEditableScript(data.full_script)
        setActiveStep(2)
      }
    } catch (e) {
      console.error('Error generating script:', e)
    } finally {
      setIsGeneratingScript(false)
    }
  }

  // Step 2 -> 3: Synthesize Voice
  const handleSynthesizeVoice = async () => {
    if (!editableScript.trim()) return
    setIsSynthesizingVoice(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/viral/synthesize-voice/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: editableScript,
          voice: selectedVoice,
          rate: speechRate
        })
      })
      if (res.ok) {
        const data = await res.json()
        setVoiceData(data)
        setActiveStep(4) // Directly advance to 9:16 Video Canvas Player!
      }
    } catch (e) {
      console.error('Error synthesizing voice:', e)
    } finally {
      setIsSynthesizingVoice(false)
    }
  }

  if (!isOpen && !isFullScreen) return null

  const studioInnerContent = (
    <>
      {/* Studio Header */}
      <div style={{
        padding: isFullScreen ? '1.25rem 2.5rem' : '1.25rem 1.75rem',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#0c1222'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0284c7, #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 15px rgba(2, 132, 199, 0.5)'
          }}>
            <Video size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc', fontWeight: 800 }}>
                VIRAL-AGENT
              </h3>
              <span style={{
                fontSize: '0.65rem',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: 700
              }}>
                0% PROMOTION • PURE AD REVENUE
              </span>
              <span style={{
                fontSize: '0.65rem',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: 700
              }}>
                100% RE-WATCH LOOPS
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: '#64748b' }}>
              Faceless high-retention vertical video factory engineered for YouTube Shorts & TikTok ad monetization.
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isFullScreen && onSwitchToQuant && (
            <button
              onClick={onSwitchToQuant}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#38bdf8',
                padding: '6px 14px',
                borderRadius: '16px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Switch back to Quant Terminal"
            >
              <span>📊 Quant Terminal</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: '#1e293b',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

          {/* 4-Step Pipeline Breadcrumb Bar */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid #1e293b',
            background: '#080c18'
          }}>
            {[
              { num: 1, label: '🎯 1. Niche & Topic', icon: Flame },
              { num: 2, label: '✍️ 2. Hook & Script', icon: FileText },
              { num: 3, label: '🎙️ 3. Neural Voice', icon: Mic },
              { num: 4, label: '🎬 4. 9:16 Video Player', icon: Play }
            ].map(step => (
              <button
                key={step.num}
                onClick={() => {
                  if (step.num <= 2 || (step.num === 3 && scriptData) || (step.num === 4 && voiceData)) {
                    setActiveStep(step.num)
                  }
                }}
                style={{
                  flex: '1',
                  padding: '12px 16px',
                  background: activeStep === step.num ? '#0f172a' : 'transparent',
                  border: 'none',
                  borderBottom: activeStep === step.num ? '2px solid #38bdf8' : '2px solid transparent',
                  color: activeStep === step.num ? '#38bdf8' : '#64748b',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                {step.label}
              </button>
            ))}
          </div>

          {/* Main Body Viewport */}
          <div style={{ flex: '1', overflowY: 'auto', padding: '1.5rem', background: '#090d16' }}>
            {/* STEP 1: NICHE & TOPIC SCOUT */}
            {activeStep === 1 && (
              <div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: '#f8fafc' }}>
                    Select High-Earning Content Niche
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                    Each niche is calibrated for maximum ad CPM and high-ticket affiliate monetization.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  {niches.map(n => (
                    <div
                      key={n.id}
                      onClick={() => setSelectedNiche(n.id)}
                      style={{
                        padding: '1.2rem',
                        borderRadius: '16px',
                        background: selectedNiche === n.id ? '#131f37' : '#0f172a',
                        border: `1.5px solid ${selectedNiche === n.id ? '#38bdf8' : '#1e293b'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f8fafc', marginBottom: '6px' }}>
                        {n.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, marginBottom: '6px' }}>
                        {n.rpm}
                      </div>
                      <div style={{ fontSize: '0.70rem', color: '#94a3b8', marginBottom: '10px' }}>
                        Audience: {n.target_audience}
                      </div>
                      <div style={{
                        fontSize: '0.68rem',
                        background: '#0b1120',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        color: '#cbd5e1'
                      }}>
                        💵 {n.affiliate_type}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom Topic Prompt */}
                <div style={{
                  background: '#0f172a',
                  padding: '1.25rem',
                  borderRadius: '16px',
                  border: '1px solid #1e293b',
                  marginBottom: '1.5rem'
                }}>
                  <label style={{ display: 'block', fontSize: '0.80rem', color: '#f8fafc', fontWeight: 700, marginBottom: '6px' }}>
                    Custom Topic Idea (Optional — Leave blank to auto-pick a viral story):
                  </label>
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="e.g. How a trader flipped $30 into $400 on 0DTE options, or 3 psychological tricks to detect liars"
                    style={{
                      width: '100%',
                      background: '#080c18',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#f8fafc',
                      fontSize: '0.82rem',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Action Bar */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleGenerateScript}
                    disabled={isGeneratingScript}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                      border: 'none',
                      color: '#fff',
                      padding: '12px 24px',
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: isGeneratingScript ? 'not-allowed' : 'pointer',
                      boxShadow: '0 0 20px rgba(2, 132, 199, 0.4)'
                    }}
                  >
                    <Wand2 size={16} />
                    <span>{isGeneratingScript ? 'Drafting 3-Sec Hook...' : 'Generate High-Retention Script'}</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: HOOK & SCRIPT LAB */}
            {activeStep === 2 && scriptData && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: '#f8fafc' }}>
                      Viral Script & Hook Review
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                      Pacing: {scriptData.word_count} words (~{scriptData.estimated_seconds} seconds) — Optimized for 9:16 vertical retention.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveStep(3)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#10b981',
                      border: 'none',
                      color: '#fff',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '0.80rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <span>Proceed to Neural Voice</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* 3-Second Hook Callout Card */}
                <div style={{
                  background: 'rgba(234, 179, 8, 0.10)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  padding: '1rem',
                  borderRadius: '12px',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontSize: '0.72rem', color: '#eab308', fontWeight: 800, marginBottom: '4px' }}>
                    ⚡ 0–3 SECOND SHOCK HOOK (Stops the scroll):
                  </div>
                  <div style={{ fontSize: '0.88rem', color: '#fef08a', fontWeight: 700 }}>
                    "{scriptData.hook}"
                  </div>
                </div>

                {/* Editable Full Script Box */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>
                    Full Narration Script (You can freely edit or polish before generating voice):
                  </label>
                  <textarea
                    value={editableScript}
                    onChange={(e) => setEditableScript(e.target.value)}
                    rows={7}
                    style={{
                      width: '100%',
                      background: '#080c18',
                      border: '1px solid #1e293b',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                      lineHeight: 1.6,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Call To Action Box */}
                <div style={{
                  background: '#0f172a',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid #1e293b'
                }}>
                  <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 800, marginBottom: '4px' }}>
                    💸 CALL TO ACTION & BIO MONETIZATION:
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                    {scriptData.cta}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: NEURAL VOICE STUDIO */}
            {activeStep === 3 && (
              <div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: '#f8fafc' }}>
                    Select Studio Neural Voice
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                    Free Microsoft Edge Neural TTS with human emotion, breath pacing, and zero subscription fees.
                  </p>
                </div>

                {/* Voice Selection Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  {voices.map(v => (
                    <div
                      key={v.id}
                      onClick={() => {
                        const key = Object.keys(v).length ? v.id.split('-')[2].toLowerCase().replace('neural', '') : 'christopher'
                        setSelectedVoice(key)
                      }}
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        background: selectedVoice === v.id.split('-')[2].toLowerCase().replace('neural', '') ? '#131f37' : '#0f172a',
                        border: `1.5px solid ${selectedVoice === v.id.split('-')[2].toLowerCase().replace('neural', '') ? '#38bdf8' : '#1e293b'}`,
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc', marginBottom: '4px' }}>
                        {v.name}
                      </div>
                      <div style={{ fontSize: '0.70rem', color: '#38bdf8', marginBottom: '2px' }}>
                        Vibe: {v.vibe}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                        Gender: {v.gender}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Speech Pacing Toggle */}
                <div style={{
                  background: '#0f172a',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid #1e293b',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: '0.80rem', color: '#f8fafc', fontWeight: 700 }}>
                      Speech Pacing Rate
                    </div>
                    <div style={{ fontSize: '0.70rem', color: '#64748b' }}>
                      +10% speed is statistically proven to increase short-form watch-through completion rates.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['+0%', '+10%', '+15%', '+20%'].map(r => (
                      <button
                        key={r}
                        onClick={() => setSpeechRate(r)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: speechRate === r ? '#0284c7' : '#0b1120',
                          border: `1px solid ${speechRate === r ? '#38bdf8' : '#1e293b'}`,
                          color: '#fff',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Synthesize Button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    onClick={handleSynthesizeVoice}
                    disabled={isSynthesizingVoice}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      border: 'none',
                      color: '#fff',
                      padding: '12px 24px',
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: isSynthesizingVoice ? 'not-allowed' : 'pointer',
                      boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)'
                    }}
                  >
                    <Mic size={16} />
                    <span>{isSynthesizingVoice ? 'Generating Voice & Word Timings...' : 'Synthesize Audio & Kinetic Subtitles'}</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: 9:16 VIDEO PLAYER & EXPORT */}
            {activeStep === 4 && voiceData && (
              <KineticCanvasPlayer
                audioUri={voiceData.audio_uri}
                duration={voiceData.duration_seconds}
                cues={voiceData.cues}
                title={scriptData?.title || 'Viral Short'}
                affiliateCopy={scriptData?.affiliate_bio || ''}
                tags={scriptData?.tags || []}
              />
            )}
          </div>
    </>
  )

  if (isFullScreen) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: '100vh',
          background: '#070b14',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'monospace'
        }}
      >
        {studioInnerContent}
      </div>
    )
  }

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3, 7, 18, 0.85)',
          backdropFilter: 'blur(12px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}
        onClick={onClose}
      >
        <motion.div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '1080px',
            maxHeight: '92vh',
            background: '#090d16',
            borderRadius: '24px',
            border: '1px solid #1e293b',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(56, 189, 248, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'monospace'
          }}
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
        >
          {studioInnerContent}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
