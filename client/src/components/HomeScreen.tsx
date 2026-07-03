import { Camera, ChevronRight } from 'lucide-react'

interface CropSelectorProps {
  selectedCrop: string | null
  onSelectCrop: (crop: string) => void
  onScanTap: () => void
}

const CROPS = [
  { id: 'paddy', name: 'Paddy', nameHi: 'धान', icon: '/crops/paddy.png' },
  { id: 'tomato', name: 'Tomato', nameHi: 'टमाटर', icon: '/crops/tomato.png' },
  { id: 'groundnut', name: 'Groundnut', nameHi: 'मूँगफली', icon: '/crops/groundnut.png' },
]

export default function HomeScreen({ selectedCrop, onSelectCrop, onScanTap }: CropSelectorProps) {
  return (
    <div>
      {/* Welcome Section */}
      <div className="welcome">
        <h1 className="welcome__greeting">
          🌾 नमस्ते, किसान!
        </h1>
        <p className="welcome__hint">
          Scan a leaf to diagnose disease — works offline
        </p>
      </div>

      {/* Crop Selector */}
      <div className="crop-selector">
        <p className="crop-selector__label">Select your crop</p>
        <div className="crop-selector__grid">
          {CROPS.map((crop) => (
            <button
              key={crop.id}
              id={`crop-${crop.id}`}
              className={`crop-card ${selectedCrop === crop.id ? 'crop-card--selected' : ''}`}
              onClick={() => onSelectCrop(crop.id)}
              aria-pressed={selectedCrop === crop.id}
              aria-label={`Select ${crop.name}`}
            >
              <img
                src={crop.icon}
                alt={crop.name}
                className="crop-card__icon"
                width={64}
                height={64}
                loading="lazy"
              />
              <span className="crop-card__name">
                {crop.name}
                <br />
                <span className="crop-card__name-hi">{crop.nameHi}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Scan CTA Card */}
      <button className="scan-cta" onClick={onScanTap} id="scan-cta-btn">
        <div className="scan-cta__icon">
          <Camera size={28} strokeWidth={2} />
        </div>
        <div className="scan-cta__text">
          <h3>Scan a Leaf</h3>
          <p>{selectedCrop
            ? `Scanning for ${CROPS.find(c => c.id === selectedCrop)?.name} diseases`
            : 'Select a crop first, then tap to scan'
          }</p>
        </div>
        <ChevronRight className="scan-cta__arrow" size={20} />
      </button>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="stat-card">
          <div className="stat-card__value">0</div>
          <div className="stat-card__label">Scans Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">3</div>
          <div className="stat-card__label">Crops Supported</div>
        </div>
      </div>

      {/* Tips Section */}
      <div className="tips-section">
        <h2 className="tips-section__title">📋 Scanning Tips</h2>
        <div className="tip-card">
          <div className="tip-card__icon">☀️</div>
          <p className="tip-card__text">
            <strong>Use natural light.</strong> Take photos in sunlight for best results. Avoid shadows on the leaf.
          </p>
        </div>
        <div className="tip-card">
          <div className="tip-card__icon">🍃</div>
          <p className="tip-card__text">
            <strong>Show the affected area.</strong> Centre the diseased part of the leaf in the camera frame.
          </p>
        </div>
        <div className="tip-card">
          <div className="tip-card__icon">📱</div>
          <p className="tip-card__text">
            <strong>Hold steady.</strong> Keep the phone 15–20 cm from the leaf to avoid blur.
          </p>
        </div>
      </div>
    </div>
  )
}
