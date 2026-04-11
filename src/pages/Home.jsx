import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import MapView from '../components/MapView'
import CheckinModal from '../components/CheckinModal'
import useCheckinStore from '../store/useCheckinStore'

export default function Home() {
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [checkinPrefill, setCheckinPrefill] = useState(null)
  const { setMapFullscreen } = useCheckinStore()

  useEffect(() => () => setMapFullscreen(false), [setMapFullscreen])

  const openCheckin = (prefill = null) => {
    setCheckinPrefill(prefill)
    setCheckinOpen(true)
  }

  return (
    <AppShell fullscreen showStats onCheckinRequest={() => openCheckin()}>
      <div style={{ position: 'fixed', inset: 0 }}>
        <MapView onCheckinRequest={openCheckin} />
      </div>
      <CheckinModal
        open={checkinOpen}
        onClose={() => {
          setCheckinOpen(false)
          setCheckinPrefill(null)
        }}
        prefill={checkinPrefill}
      />
    </AppShell>
  )
}
