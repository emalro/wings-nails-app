import React, { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_OUTPUT_SIZE = 1024 * 1024 // 1MB after compression
const BUCKET = 'gallery-images'
const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25

type AspectRatio = '4:3' | '1:1'

interface ImageUploadProps {
  orden: number
  currentImageUrl: string | null
  onUploadComplete: (url: string) => void
  onError: (message: string) => void
}

export default function ImageUpload({
  orden,
  currentImageUrl,
  onUploadComplete,
  onError,
}: ImageUploadProps) {
  const [showCropModal, setShowCropModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null)
  const [aspect, setAspect] = useState<AspectRatio>('4:3')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Crop interaction state
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [cropX, setCropX] = useState(0) // crop area offset X (canvas pixels)
  const [cropY, setCropY] = useState(0) // crop area offset Y (canvas pixels)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragCropStart, setDragCropStart] = useState({ x: 0, y: 0 })
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  // ── File validation ─────────────────────────────────────────────────
  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Formato no soportado. Usá JPG, PNG, WebP o GIF'
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'La imagen no puede superar 5MB'
    }
    return null
  }

  // ── File selection ───────────────────────────────────────────────────
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const error = validateFile(file)
      if (error) {
        onError(error)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      setSelectedFile(file)
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedPreview(reader.result as string)
        setShowCropModal(true)
        setZoom(1)
        setCropX(0)
        setCropY(0)
      }
      reader.readAsDataURL(file)

      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [onError],
  )

  // ── Calculate crop box dimensions ────────────────────────────────────
  const getCropBox = useCallback(
    (imgW: number, imgH: number, canvasW: number, canvasH: number) => {
      const aspectW = aspect === '4:3' ? 4 : 1
      const aspectH = aspect === '4:3' ? 3 : 1

      // The image is drawn at imgW * zoom, imgH * zoom on the canvas
      const drawW = imgW * zoom
      const drawH = imgH * zoom

      // Crop box fits within the drawn image
      let boxW = drawW
      let boxH = drawH

      if (boxW / boxH > aspectW / aspectH) {
        boxW = Math.round(boxH * (aspectW / aspectH))
      } else {
        boxH = Math.round(boxW / (aspectW / aspectH))
      }

      return { boxW, boxH, drawW, drawH }
    },
    [aspect, zoom],
  )

  // ── Draw canvas ──────────────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cw = canvas.width
    const ch = canvas.height

    // Clear
    ctx.clearRect(0, 0, cw, ch)

    // Draw image centered
    const { boxW, boxH, drawW, drawH } = getCropBox(img.naturalWidth, img.naturalHeight, cw, ch)
    const imgX = (cw - drawW) / 2
    const imgY = (ch - drawH) / 2

    ctx.drawImage(img, imgX, imgY, drawW, drawH)

    // Clamp crop position so box stays within image bounds
    const minCropX = imgX
    const minCropY = imgY
    const maxCropX = imgX + drawW - boxW
    const maxCropY = imgY + drawH - boxH
    const cx = Math.max(minCropX, Math.min(maxCropX, imgX + cropX))
    const cy = Math.max(minCropY, Math.min(maxCropY, imgY + cropY))

    // Draw darkened overlay outside crop area
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    // Top
    ctx.fillRect(0, 0, cw, cy)
    // Bottom
    ctx.fillRect(0, cy + boxH, cw, ch - cy - boxH)
    // Left
    ctx.fillRect(0, cy, cx, boxH)
    // Right
    ctx.fillRect(cx + boxW, cy, cw - cx - boxW, boxH)

    // Draw crop box border
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.strokeRect(cx, cy, boxW, boxH)

    // Draw rule-of-thirds grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.lineWidth = 1
    for (let i = 1; i <= 2; i++) {
      // Vertical
      ctx.beginPath()
      ctx.moveTo(cx + (boxW * i) / 3, cy)
      ctx.lineTo(cx + (boxW * i) / 3, cy + boxH)
      ctx.stroke()
      // Horizontal
      ctx.beginPath()
      ctx.moveTo(cx, cy + (boxH * i) / 3)
      ctx.lineTo(cx + boxW, cy + (boxH * i) / 3)
      ctx.stroke()
    }

    // Draw corner handles
    const handleSize = 12
    ctx.fillStyle = '#fff'
    // Top-left
    ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize)
    // Top-right
    ctx.fillRect(cx + boxW - handleSize / 2, cy - handleSize / 2, handleSize, handleSize)
    // Bottom-left
    ctx.fillRect(cx - handleSize / 2, cy + boxH - handleSize / 2, handleSize, handleSize)
    // Bottom-right
    ctx.fillRect(cx + boxW - handleSize / 2, cy + boxH - handleSize / 2, handleSize, handleSize)
  }, [cropX, cropY, getCropBox])

  // ── Load image and set up canvas ─────────────────────────────────────
  useEffect(() => {
    if (!showCropModal || !selectedPreview) return

    const img = new Image()
    img.onload = () => {
      imgRef.current = img

      // Set canvas size to fit container
      const container = containerRef.current
      if (!container) return

      const maxW = Math.min(container.clientWidth, 800)
      const maxH = window.innerHeight * 0.5

      let cw = img.naturalWidth
      let ch = img.naturalHeight

      if (cw > maxW) {
        ch = Math.round(ch * (maxW / cw))
        cw = maxW
      }
      if (ch > maxH) {
        cw = Math.round(cw * (maxH / ch))
        ch = maxH
      }

      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = cw
        canvas.height = ch
        setCanvasSize({ width: cw, height: ch })
        setCropX(0)
        setCropY(0)
      }
    }
    img.src = selectedPreview
  }, [showCropModal, selectedPreview])

  // ── Redraw when crop params change ───────────────────────────────────
  useEffect(() => {
    drawCanvas()
  }, [drawCanvas, canvasSize])

  // ── Reset crop on aspect/zoom change ─────────────────────────────────
  useEffect(() => {
    setCropX(0)
    setCropY(0)
  }, [aspect])

  useEffect(() => {
    // Keep crop centered when zoom changes
    setCropX(0)
    setCropY(0)
  }, [zoom])

  // ── Drag handlers ────────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isProcessing || isUploading) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    setDragCropStart({ x: cropX, y: cropY })
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    setCropX(dragCropStart.x + dx)
    setCropY(dragCropStart.y + dy)
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  // ── Zoom controls ────────────────────────────────────────────────────
  const handleZoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))
  const handleZoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))
  const handleZoomReset = () => { setZoom(1); setCropX(0); setCropY(0) }

  // ── Crop & compress ─────────────────────────────────────────────────
  const processAndUpload = useCallback(async () => {
    if (!selectedFile || !selectedPreview) return

    setIsProcessing(true)
    try {
      const img = imgRef.current
      if (!img) throw new Error('Image not loaded')

      const canvas = canvasRef.current
      if (!canvas) throw new Error('Canvas not available')

      const cw = canvas.width
      const ch = canvas.height
      const { boxW, boxH, drawW, drawH } = getCropBox(img.naturalWidth, img.naturalHeight, cw, ch)

      // Calculate image position on canvas
      const imgX = (cw - drawW) / 2
      const imgY = (ch - drawH) / 2

      // Clamp crop position
      const minCropX = imgX
      const minCropY = imgY
      const maxCropX = imgX + drawW - boxW
      const maxCropY = imgY + drawH - boxH
      const cx = Math.max(minCropX, Math.min(maxCropX, imgX + cropX))
      const cy = Math.max(minCropY, Math.min(maxCropY, imgY + cropY))

      // Map canvas crop box back to original image coordinates
      const scaleX = img.naturalWidth / drawW
      const scaleY = img.naturalHeight / drawH
      const srcX = (cx - imgX) * scaleX
      const srcY = (cy - imgY) * scaleY
      const srcW = boxW * scaleX
      const srcH = boxH * scaleY

      // Scale down to max 1200px wide
      const maxWidth = 1200
      let targetW = Math.round(srcW)
      let targetH = Math.round(srcH)
      if (targetW > maxWidth) {
        targetH = Math.round(targetH * (maxWidth / targetW))
        targetW = maxWidth
      }

      const outCanvas = document.createElement('canvas')
      outCanvas.width = targetW
      outCanvas.height = targetH
      const ctx = outCanvas.getContext('2d')!
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH)

      // Compress to ≤1MB — reduce quality iteratively
      let blob: Blob | null = null
      let quality = 0.9
      const minQuality = 0.3
      const qualityStep = 0.1

      while (quality >= minQuality) {
        blob = await new Promise<Blob | null>((resolve) => {
          outCanvas.toBlob(resolve, selectedFile.type, quality)
        })
        if (blob && blob.size <= MAX_OUTPUT_SIZE) break
        quality -= qualityStep
      }

      if (!blob) {
        onError('No se pudo procesar la imagen. Intentá con otra.')
        setIsProcessing(false)
        return
      }

      if (blob.size > MAX_OUTPUT_SIZE) {
        const finalBlob = await new Promise<Blob | null>((resolve) => {
          outCanvas.toBlob(resolve, selectedFile.type, minQuality)
        })
        if (finalBlob) blob = finalBlob
      }

      // Upload to Supabase Storage
      setIsProcessing(false)
      setIsUploading(true)
      setUploadProgress('Subiendo imagen...')

      if (!supabase) {
        onError('Supabase no está configurado. Agregá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY al .env')
        setIsUploading(false)
        setUploadProgress('')
        return
      }

      const ext = selectedFile.type.split('/')[1] || 'jpg'
      const path = `${orden}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob)

      if (uploadError) {
        console.error('[ImageUpload] Supabase upload error:', uploadError.message, uploadError)
        onError(`Error al subir: ${uploadError.message}`)
        setIsUploading(false)
        setUploadProgress('')
        return
      }

      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(path)

      if (!urlData?.publicUrl) {
        onError('No se pudo obtener la URL de la imagen subida')
        setIsUploading(false)
        setUploadProgress('')
        return
      }

      onUploadComplete(urlData.publicUrl)
    } catch (err) {
      console.error('[ImageUpload] processing error:', err)
      onError('No se pudo procesar la imagen. Intentá con otra.')
    } finally {
      setIsProcessing(false)
      setIsUploading(false)
      setUploadProgress('')
      setShowCropModal(false)
      setSelectedFile(null)
      setSelectedPreview(null)
      imgRef.current = null
    }
  }, [selectedFile, selectedPreview, aspect, zoom, cropX, cropY, getCropBox, orden, onError, onUploadComplete])

  const handleCancelCrop = () => {
    setShowCropModal(false)
    setSelectedFile(null)
    setSelectedPreview(null)
    imgRef.current = null
  }

  // ── Keyboard shortcuts for crop modal ────────────────────────────────
  useEffect(() => {
    if (!showCropModal) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancelCrop()
      if (e.key === 'Enter' && !isProcessing && !isUploading) processAndUpload()
      if (e.key === '+' || e.key === '=') handleZoomIn()
      if (e.key === '-') handleZoomOut()
      if (e.key === '0') handleZoomReset()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [showCropModal, isProcessing, isUploading])

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-label="Seleccionar imagen para subir"
      />

      {/* Upload trigger button */}
      <button
        type="button"
        className="button-primary"
        style={{
          padding: '8px 14px',
          fontSize: '.85rem',
          width: '100%',
        }}
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading || isProcessing}
      >
        {isUploading
          ? uploadProgress || 'Subiendo...'
          : isProcessing
            ? 'Procesando...'
            : 'Subir imagen'}
      </button>

      {/* Crop/resize modal */}
      {showCropModal && selectedPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="crop-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)',
          }}
          onClick={handleCancelCrop}
        >
          <div
            style={{
              background: 'var(--surface, #fff)',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="crop-modal-title" style={{ margin: 0 }}>
              Recortar imagen
            </h4>

            {/* Controls row */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Aspect ratio toggle */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setAspect('4:3')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: aspect === '4:3' ? 'var(--primary, #6750a4)' : 'var(--outline, #79747e)',
                    background: aspect === '4:3' ? 'var(--primary, #6750a4)' : 'transparent',
                    color: aspect === '4:3' ? 'var(--on-primary, #fff)' : 'var(--on-surface, #1c1b1f)',
                    cursor: 'pointer',
                    fontSize: '.85rem',
                    fontWeight: 600,
                  }}
                  disabled={isProcessing || isUploading}
                >
                  4:3
                </button>
                <button
                  type="button"
                  onClick={() => setAspect('1:1')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: aspect === '1:1' ? 'var(--primary, #6750a4)' : 'var(--outline, #79747e)',
                    background: aspect === '1:1' ? 'var(--primary, #6750a4)' : 'transparent',
                    color: aspect === '1:1' ? 'var(--on-primary, #fff)' : 'var(--on-surface, #1c1b1f)',
                    cursor: 'pointer',
                    fontSize: '.85rem',
                    fontWeight: 600,
                  }}
                  disabled={isProcessing || isUploading}
                >
                  1:1
                </button>
              </div>

              {/* Zoom controls */}
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    border: '1px solid var(--outline, #79747e)',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  disabled={isProcessing || isUploading || zoom <= ZOOM_MIN}
                  aria-label="Zoom out"
                >
                  −
                </button>
                <span style={{ fontSize: '.8rem', minWidth: '48px', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    border: '1px solid var(--outline, #79747e)',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  disabled={isProcessing || isUploading || zoom >= ZOOM_MAX}
                  aria-label="Zoom in"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={handleZoomReset}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--outline, #79747e)',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '.75rem',
                  }}
                  disabled={isProcessing || isUploading}
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Canvas with crop overlay */}
            <div
              ref={containerRef}
              style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '8px',
                background: '#1a1a1a',
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
            >
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: '50vh',
                  touchAction: 'none',
                }}
              />
              {isProcessing && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    fontSize: '.9rem',
                  }}
                  role="status"
                >
                  Procesando...
                </div>
              )}
            </div>

            <p style={{ margin: 0, fontSize: '.75rem', color: 'var(--on-surface-variant)' }}>
              Arrastrá para posicionar el recorte · Zoom: +/− o botones · Enter para confirmar
            </p>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleCancelCrop}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--outline, #79747e)',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '.85rem',
                }}
                disabled={isProcessing || isUploading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={processAndUpload}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '.85rem',
                }}
                disabled={isProcessing || isUploading}
              >
                {isUploading ? 'Subiendo...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
