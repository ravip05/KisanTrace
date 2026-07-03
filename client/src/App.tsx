import { useState, useEffect } from 'react'
import { Home, Camera, Clock, Leaf } from 'lucide-react'
import HomeScreen from './components/HomeScreen'
import ScannerScreen from './components/ScannerScreen'
import ReportScreen from './components/ReportScreen'
import HistoryScreen from './components/HistoryScreen'
import { getDatabase } from './db/database'
import { startGlobalSync } from './db/sync-service'
import { loadModel } from './ai/inference'
import type { InferenceResult } from './ai/inference'

type Screen = 'home' | 'scanner' | 'report' | 'history'

// Standard UUIDv4 generator for the mock userId and scan id
function generateUUID() {
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
    (parseInt(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> parseInt(c) / 4).toString(16)
  )
}

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showUpdateToast, setShowUpdateToast] = useState(false)
  const [showOfflineToast, setShowOfflineToast] = useState(false)
  const [swUpdateFn, setSwUpdateFn] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null)
  
  // State to hold the latest diagnosis to pass to the Report Screen
  const [latestDiagnosis, setLatestDiagnosis] = useState<{ result: InferenceResult; crop: string; diseaseData: any } | null>(null)

  // ── Global Boot Initialization ───────────────────────────────────────────
  useEffect(() => {
    // 1. Initialize Database & Sync
    getDatabase().then((db) => {
      console.log('[App] Database initialized')
      startGlobalSync(db)
      console.log('[App] Global RxDB sync started')
    }).catch(err => {
      console.error('[App] Failed to initialize DB:', err)
    })

    // 2. Pre-warm the AI model in the background
    loadModel().then(() => {
      console.log('[App] AI Model pre-loaded successfully')
    }).catch(err => {
      console.warn('[App] AI Model pre-load deferred:', err.message)
    })
  }, [])

  // Track online/offline status
  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Listen for Service Worker lifecycle events (from main.tsx)
  useEffect(() => {
    const handleUpdateReady = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setSwUpdateFn(() => detail.updateSW)
      setShowUpdateToast(true)
    }

    const handleOfflineReady = () => {
      setShowOfflineToast(true)
      setTimeout(() => setShowOfflineToast(false), 4000)
    }

    window.addEventListener('sw:updateReady', handleUpdateReady)
    window.addEventListener('sw:offlineReady', handleOfflineReady)
    return () => {
      window.removeEventListener('sw:updateReady', handleUpdateReady)
      window.removeEventListener('sw:offlineReady', handleOfflineReady)
    }
  }, [])

  // Persist selected crop to localStorage
  useEffect(() => {
    const saved = localStorage.getItem('kt_selectedCrop')
    if (saved) setSelectedCrop(saved)
  }, [])

  const handleSelectCrop = (cropId: string) => {
    setSelectedCrop(cropId)
    localStorage.setItem('kt_selectedCrop', cropId)
  }

  const handleScanTap = () => {
    if (selectedCrop) setScreen('scanner')
  }

  const handleDiagnosisComplete = async (result: InferenceResult, crop: string) => {
    try {
      // 1. Fetch the disease knowledge base for the crop
      const response = await fetch(`/diseases/${crop}.json`)
      if (!response.ok) throw new Error(`Could not load disease data for ${crop}`)
      
      const diseases = await response.json()
      // Find the specific disease by classIndex
      const diseaseData = diseases.find((d: any) => d.classIndex === result.classIndex)
      
      if (!diseaseData) throw new Error(`Disease data not found for class index ${result.classIndex}`)
      
      // 2. Save the scan to the offline-first RxDB database
      const db = await getDatabase()
      
      // In a real app, this user ID would come from an auth context
      const userId = localStorage.getItem('kt_userId') || (() => {
        const id = generateUUID()
        localStorage.setItem('kt_userId', id)
        return id
      })()

      await db.scans.insert({
        id: generateUUID(),
        userId,
        cropType: crop,
        predictedDisease: diseaseData.nameEn,
        confidenceScore: result.confidence,
        severity: diseaseData.severity,
        scannedAt: new Date().toISOString()
      })
      console.log('[App] Scan saved to RxDB locally')

      // 3. Transition to the report screen
      setLatestDiagnosis({ result, crop, diseaseData })
      setScreen('report')
    } catch (err) {
      console.error('[App] Failed to process diagnosis:', err)
      alert('Error processing diagnosis results. Please try again.')
    }
  }

  const renderScreen = () => {
    switch (screen) {
      case 'home':
        return (
          <HomeScreen
            selectedCrop={selectedCrop}
            onSelectCrop={handleSelectCrop}
            onScanTap={handleScanTap}
          />
        )
      case 'scanner':
        return (
          <ScannerScreen
            selectedCrop={selectedCrop}
            onBack={() => setScreen('home')}
            onDiagnosisComplete={handleDiagnosisComplete}
          />
        )
      case 'report':
        return (
          <ReportScreen 
            onBack={() => setScreen('scanner')} 
            diagnosis={latestDiagnosis}
          />
        )
      case 'history':
        return <HistoryScreen />
      default:
        return null
    }
  }

  return (
    <div className="app-shell">
      {/* --- Header --- */}
      <header className="header" id="app-header">
        <div className="header__brand">
          <Leaf className="header__logo" size={36} strokeWidth={1.5} />
          <div>
            <div className="header__title">Kisan-Trace</div>
            <div className="header__subtitle">AI Crop Doctor</div>
          </div>
        </div>
        <div className="header__status">
          <span
            className={`header__status-dot ${isOnline ? 'header__status-dot--online' : 'header__status-dot--offline'}`}
          />
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="main-content" id="main-content">
        {renderScreen()}
      </main>

      {/* --- Bottom Navigation --- */}
      <nav className="bottom-nav" id="bottom-nav">
        <button
          className={`bottom-nav__item ${screen === 'home' ? 'bottom-nav__item--active' : ''}`}
          onClick={() => setScreen('home')}
          aria-label="Home"
        >
          <Home className="bottom-nav__icon" size={24} />
          Home
        </button>

        <button
          className="bottom-nav__item"
          onClick={() => { if (selectedCrop) setScreen('scanner') }}
          aria-label="Scan"
        >
          <div className="bottom-nav__scan-btn">
            <Camera size={28} />
          </div>
          Scan
        </button>

        <button
          className={`bottom-nav__item ${screen === 'history' ? 'bottom-nav__item--active' : ''}`}
          onClick={() => setScreen('history')}
          aria-label="History"
        >
          <Clock className="bottom-nav__icon" size={24} />
          History
        </button>
      </nav>

      {/* --- SW Update Toast --- */}
      {showUpdateToast && (
        <div className="update-toast" id="update-toast">
          <span className="update-toast__text">🔄 A new version is available</span>
          <button
            className="update-toast__btn"
            onClick={() => {
              if (swUpdateFn) swUpdateFn(true)
              setShowUpdateToast(false)
            }}
          >
            Update Now
          </button>
        </div>
      )}

      {/* --- Offline Ready Toast --- */}
      {showOfflineToast && (
        <div className="offline-toast" id="offline-toast">
          ✅ App is ready for offline use!
        </div>
      )}
    </div>
  )
}

export default App
