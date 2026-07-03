import { useState, useEffect } from 'react'
import { Clock, Leaf, CloudOff, CheckCircle2 } from 'lucide-react'
import { getDatabase } from '../db/database'
import type { ScanDocType } from '../db/schemas'

export default function HistoryScreen() {
  const [scans, setScans] = useState<ScanDocType[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let sub: any = null

    async function loadHistory() {
      try {
        const db = await getDatabase()
        
        // Subscribe to the 'scans' collection, sorted by newest first
        sub = db.scans
          .find({
            sort: [{ scannedAt: 'desc' }]
          })
          .$.subscribe((results) => {
            setScans(results.map(d => d.toJSON() as ScanDocType))
            setIsLoading(false)
          })
      } catch (err) {
        console.error('[History] Failed to load scans:', err)
        setIsLoading(false)
      }
    }

    loadHistory()

    return () => {
      if (sub) sub.unsubscribe()
    }
  }, [])

  if (isLoading) {
    return (
      <div className="history-screen" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <div className="scanner__overlay-spinner" style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    )
  }

  if (scans.length === 0) {
    return (
      <div className="history-screen">
        <h2 className="history-screen__title">📋 Scan History</h2>
        <div className="history-empty">
          <Clock size={48} strokeWidth={1.5} />
          <p>No scans yet.<br />Diagnose your first leaf to see results here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="history-screen">
      <h2 className="history-screen__title">📋 Scan History</h2>
      
      <div className="history-list">
        {scans.map(scan => {
          const date = new Date(scan.scannedAt)
          const isSynced = !!scan.syncedAt
          
          return (
            <div key={scan.id} className="history-card">
              <div className="history-card__header">
                <span className="history-card__crop">
                  <Leaf size={14} style={{ marginRight: 4, display: 'inline' }} />
                  {scan.cropType.charAt(0).toUpperCase() + scan.cropType.slice(1)}
                </span>
                <span className="history-card__date">
                  {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              
              <div className="history-card__body">
                <div className="history-card__disease">
                  {scan.predictedDisease || 'Unknown'}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <div className="history-card__confidence">
                    {scan.confidenceScore ? Math.round(scan.confidenceScore * 100) : 0}% confident
                  </div>
                  
                  {isSynced ? (
                    <div className="history-card__sync-status history-card__sync-status--synced" title="Backed up to server">
                      <CheckCircle2 size={14} /> Synced
                    </div>
                  ) : (
                    <div className="history-card__sync-status history-card__sync-status--pending" title="Waiting for internet connection">
                      <CloudOff size={14} /> Pending
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
