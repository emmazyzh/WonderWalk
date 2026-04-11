import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import NavBar from '../NavBar'
import SideMenu from '../SideMenu'
import StatsBar from '../StatsBar'
import useCheckinStore from '../../store/useCheckinStore'
import './AppShell.css'

export default function AppShell({ children, onCheckinRequest, showStats = false, fullscreen = false, contentClassName = '' }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { loadCheckins, flushPendingSync, isMapFullscreen } = useCheckinStore()
  const { getToken } = useAuth()

  useEffect(() => {
    loadCheckins(getToken).catch(console.warn)
  }, [getToken, loadCheckins])

  useEffect(() => {
    const handleOnline = () => {
      flushPendingSync(getToken).catch(console.warn)
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [flushPendingSync, getToken])

  return (
    <>
      <div className="bg-blobs">
        <div className="bg-blob bg-blob-1" />
        <div className="bg-blob bg-blob-2" />
        <div className="bg-blob bg-blob-3" />
      </div>

      <div className={`app-shell ${fullscreen ? 'app-shell--fullscreen' : ''}`}>
        {fullscreen ? (
          <div className="app-shell-fullscreen">{children}</div>
        ) : (
          <main className={`app-shell-content ${contentClassName}`.trim()}>{children}</main>
        )}
      </div>

      <NavBar onMenuOpen={() => setMenuOpen(true)} />
      {showStats && !isMapFullscreen && <StatsBar onCheckinRequest={onCheckinRequest} />}
      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onCheckinRequest={onCheckinRequest}
      />
    </>
  )
}
