import { Leaf, FlaskConical, AlertTriangle, ArrowLeft } from 'lucide-react'
import type { InferenceResult } from '../ai/inference'

interface ReportScreenProps {
  onBack: () => void
  diagnosis: { result: InferenceResult; crop: string; diseaseData: any } | null
}

const SEVERITY_MAP: Record<string, { label: string; labelHi: string; className: string }> = {
  low: { label: 'Low', labelHi: 'कम', className: 'severity-badge--low' },
  moderate: { label: 'Moderate', labelHi: 'मध्यम', className: 'severity-badge--moderate' },
  high: { label: 'High', labelHi: 'गंभीर', className: 'severity-badge--high' },
}

export default function ReportScreen({ onBack, diagnosis }: ReportScreenProps) {
  if (!diagnosis || !diagnosis.diseaseData) {
    return (
      <div className="report-screen" style={{ padding: '2rem', textAlign: 'center' }}>
        <p>No diagnosis data available.</p>
        <button onClick={onBack} className="scanner__btn scanner__btn--primary" style={{ marginTop: '1rem' }}>
          Go Back
        </button>
      </div>
    )
  }

  const { result, diseaseData } = diagnosis
  const sev = SEVERITY_MAP[diseaseData.severity] || SEVERITY_MAP['moderate']

  return (
    <div className="report-screen">
      {/* Back button */}
      <button onClick={onBack} className="scanner__selected-crop">
        <ArrowLeft size={16} />
        Scan Again
      </button>

      {/* Disease Header Card */}
      <div className="report__disease-header">
        <div className="report__disease-name">{diseaseData.nameEn}</div>
        <div className="report__disease-name-hi">{diseaseData.nameHi}</div>

        {/* Confidence Bar */}
        <div className="report__confidence-bar">
          <div className="report__confidence-track">
            <div
              className="report__confidence-fill"
              style={{ width: `${Math.round(result.confidence * 100)}%` }}
            />
          </div>
          <span className="report__confidence-label">
            {Math.round(result.confidence * 100)}% confident
          </span>
        </div>

        {/* Severity Badge */}
        <span className={`severity-badge ${sev.className}`}>
          ● {sev.label} ({sev.labelHi})
        </span>
      </div>

      {/* Description */}
      <div className="treatment-card">
        <div className="treatment-card__body">
          <p style={{ fontSize: '0.9rem', color: '#4b5563', lineHeight: 1.5 }}>
            {diseaseData.description}
          </p>
        </div>
      </div>

      {/* Symptoms */}
      {diseaseData.symptoms && diseaseData.symptoms.length > 0 && (
        <div className="treatment-card">
          <div className="treatment-card__header">
            <span className="treatment-card__title">🔍 Symptoms</span>
          </div>
          <div className="treatment-card__body">
            <ul style={{ paddingLeft: '1.2rem', color: '#374151' }}>
              {diseaseData.symptoms.map((symptom: string, i: number) => (
                <li key={i} style={{ marginBottom: '4px' }}>{symptom}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Treatment (English) */}
      <div className="treatment-card">
        <div className="treatment-card__header">
          <div className="treatment-card__icon treatment-card__icon--chemical">
            <FlaskConical size={18} />
          </div>
          <span className="treatment-card__title">🧪 Treatment (English)</span>
        </div>
        <div className="treatment-card__body">
          <ul>
            {diseaseData.treatment.map((tip: string, i: number) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Treatment (Hindi) */}
      {diseaseData.treatmentHi && diseaseData.treatmentHi.length > 0 && (
        <div className="treatment-card">
          <div className="treatment-card__header">
            <div className="treatment-card__icon treatment-card__icon--organic">
              <Leaf size={18} />
            </div>
            <span className="treatment-card__title">🌿 उपचार (Hindi)</span>
          </div>
          <div className="treatment-card__body">
            <ul>
              {diseaseData.treatmentHi.map((tip: string, i: number) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Prevention Tip */}
      {diseaseData.preventionTip && (
        <div className="expert-advisory">
          <AlertTriangle className="expert-advisory__icon" size={20} />
          <p className="expert-advisory__text">
            <strong>Prevention Tip:</strong> {diseaseData.preventionTip}
          </p>
        </div>
      )}
    </div>
  )
}
