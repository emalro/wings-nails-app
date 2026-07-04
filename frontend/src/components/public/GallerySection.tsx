import { useRef, useState } from 'react'
import { useGallery } from '../../hooks'
import { type GalleryItemRead } from '../../api'
import { Lightbox } from './Lightbox'

export function GallerySection() {
  const { data: gallery = [], isLoading, isError } = useGallery()
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxItem, setLightboxItem] = useState<GalleryItemRead | null>(null)
  const [triggerRef, setTriggerRef] = useState<HTMLButtonElement | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const activeItems = gallery.filter((item) => item.activo)

  const handleThumbnailClick = (item: GalleryItemRead, buttonRef: HTMLButtonElement | null) => {
    if (item.link_url) return // link handled by <a> wrapper
    if (!buttonRef) return
    setLightboxItem(item)
    setTriggerRef(buttonRef)
    setLightboxOpen(true)
  }

  const handleLightboxClose = () => {
    setLightboxOpen(false)
    setLightboxItem(null)
    setTriggerRef(null)
  }

  if (isLoading) {
    return (
      <section className="section" aria-labelledby="galeria-title" aria-busy="true" aria-label="Cargando galería">
        <div className="content">
          <div className="section-header">
            <span className="overline">Galería</span>
            <h2 id="galeria-title">Trabajos Realizados</h2>
            <p>Una muestra de nuestros diseños y trabajos más recientes.</p>
          </div>
          <div className="gallery-grid" ref={gridRef} role="list" aria-busy="true" aria-label="Cargando galería">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="gallery-item" role="listitem">
                <div className="gallery-item-fallback" aria-hidden="true">Cargando…</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (isError) {
    return (
      <section className="section" aria-labelledby="galeria-title">
        <div className="content">
          <div className="section-header">
            <span className="overline">Galería</span>
            <h2 id="galeria-title">Trabajos Realizados</h2>
            <p>Una muestra de nuestros diseños y trabajos más recientes.</p>
          </div>
          <div className="gallery-empty" role="alert">
            <p>No pudimos cargar la galería. Intentá recargar la página.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="section" aria-labelledby="galeria-title">
        <div className="content">
          <div className="section-header">
            <span className="overline">Galería</span>
            <h2 id="galeria-title">Trabajos Realizados</h2>
            <p>Una muestra de nuestros diseños y trabajos más recientes.</p>
          </div>
          {activeItems.length === 0 ? (
            <div className="gallery-empty" role="status">
              <p>Galería sin imágenes activas por el momento</p>
            </div>
          ) : (
            <div className="gallery-grid" ref={gridRef} role="list" aria-label="Galería de trabajos realizados">
              {activeItems.map((item) => (
                <figure key={item.id} className="gallery-item" role="listitem">
                  {item.link_url ? (
                    <a
                      href={item.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Ver en una pestaña nueva: ${item.alt_text}`}
                    >
                      <img
                        src={item.image_url}
                        alt={item.alt_text}
                        width={384}
                        height={288}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          const fallback = e.currentTarget.parentElement?.querySelector('.gallery-item-fallback')
                          if (fallback) (fallback as HTMLElement).style.display = 'flex'
                        }}
                      />
                      <div className="gallery-item-fallback" style={{ display: 'none' }} aria-hidden="true">
                        Imagen no disponible
                      </div>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => handleThumbnailClick(item, e.currentTarget)}
                      aria-label={`Abrir lightbox: ${item.alt_text}`}
                    >
                      <img
                        src={item.image_url}
                        alt={item.alt_text}
                        width={384}
                        height={288}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          const fallback = e.currentTarget.parentElement?.querySelector('.gallery-item-fallback')
                          if (fallback) (fallback as HTMLElement).style.display = 'flex'
                        }}
                      />
                      <div className="gallery-item-fallback" style={{ display: 'none' }} aria-hidden="true">
                        Imagen no disponible
                      </div>
                    </button>
                  )}
                </figure>
              ))}
            </div>
          )}
        </div>
      </section>

      {lightboxOpen && lightboxItem && (
        <Lightbox
          open={lightboxOpen}
          onClose={handleLightboxClose}
          src={lightboxItem.image_url}
          alt={lightboxItem.alt_text}
          triggerRef={triggerRef}
        />
      )}
    </>
  )
}