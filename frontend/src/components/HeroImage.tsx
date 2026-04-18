type Props = {
  src: string
  alt: string
  /** t.ex. `hero-image--compact` för lägre höjd */
  className?: string
}

export function HeroImage({ src, alt, className = '' }: Props) {
  return (
    <div className={`hero-image ${className}`.trim()}>
      <img src={src} alt={alt} loading="lazy" decoding="async" />
      <div className="hero-image__veil" aria-hidden />
    </div>
  )
}
