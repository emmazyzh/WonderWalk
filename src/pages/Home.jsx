// src/pages/Home.jsx
import { useState, useEffect } from 'react'
import { SignedIn, SignedOut, RedirectToSignIn, useAuth } from '@clerk/clerk-react'
import NavBar from '../components/NavBar'
import MapView from '../components/MapView'
import StatsBar from '../components/StatsBar'
import SideMenu from '../components/SideMenu'
import CheckinModal from '../components/CheckinModal'
import useCheckinStore from '../store/useCheckinStore'

function HomeContent() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [checkinPrefill, setCheckinPrefill] = useState(null)
  const { loadCheckins } = useCheckinStore()
  const { getToken } = useAuth()

  // Load checkins on mount
  useEffect(() => {
    loadCheckins(getToken).catch(console.warn)
  }, [])

  const openCheckin = (prefill = null) => {
    setCheckinPrefill(prefill)
    setCheckinOpen(true)
  }

  return (
    <>
      {/* Background blobs */}
      <div className="bg-blobs">
        <div className="bg-blob bg-blob-1" />
        <div className="bg-blob bg-blob-2" />
        <div className="bg-blob bg-blob-3" />
      </div>

      {/* Fullscreen map */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 20 }}>
        <MapView onCheckinRequest={openCheckin} />
      </div>

      {/* Floating navbar */}
      <NavBar onMenuOpen={() => setMenuOpen(true)} />

      {/* Bottom stats */}
      <StatsBar />

      {/* Left drawer menu */}
      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onCheckinRequest={() => openCheckin()}
      />

      {/* Checkin modal */}
      <CheckinModal
        open={checkinOpen}
        onClose={() => {
          setCheckinOpen(false)
          setCheckinPrefill(null)
        }}
        prefill={checkinPrefill}
      />
    </>
  )
}

export default function Home() {
  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <HomeContent />
      </SignedIn>
    </>
  )
}
