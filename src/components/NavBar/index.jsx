// src/components/NavBar/index.jsx
import { Avatar, Tooltip, message } from 'antd'
import { MenuOutlined, GlobalOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons'
import { useUser } from '@clerk/clerk-react'
import { useLocation, useNavigate } from 'react-router-dom'
import useCheckinStore from '../../store/useCheckinStore'
import './NavBar.css'

function ChinaMapToggleIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      className="nav-map-toggle-icon"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="32"
        cy="32"
        r="27.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
      />
      <path
        d="M15.8 26.8
          l1.4-0.8 1.1 0.2 1.2-0.5 1.3 0.1 1.1-0.8 1.4-0.3 0.8-1
          1.3-0.1 1-1 1.1-0.2 0.5-1.2 1-0.8 1.1 0.2 0.7-1.1 1.2-0.1
          0.8 1.1 1.1 0.6 0.8 1.3 0 1.6 0.7 0.7 1.2 0.4 1 0.7 0.5 1.3
          1.1 0.4 1.4 0.1 1.2 0.2 1.4 0 1 0.5 1.2-0.5 1.4-0.2 1.4 0.1
          1.2-0.5 0.5-1.2 1.1-0.6 1.4 0 1-0.7 0.3-1.4 1.2-0.4 0.7-1
          0.1-1.5 0.7-0.8 0.1-1.4 0.9-0.8 1.3-0.2 1.2 0.3 1 1 0.4 1
          0.9 1.5 1 0 1.1 0.4 0.6 1.3 1 0.3 1-0.6 0.9-0.3 -0.1 1.2 0 1.2
          -0.6 0.9 0 1.1 -1 0.7 -0.1 1 -1 0.5 -0.4 1 -1.2 0.2 -0.6 0.8
          -1 0.7 -0.8 0.9 -1.3 0.5 -0.5 1.1 -1.2 0.6 -0.6 0.9 -1 0.5
          0.5 0.8 1.4 0.1 -0.6 0.8 -0.9 0.8 0.6 1 0.5 1.2 0.1 1.5 -0.3 1.1
          -0.8 0.8 -0.9 0.9 -1.2 0 -1.1 0.5 -0.9 0.7 -1.2 0.1 -1.2 0.6
          -1.4 0.2 -1.3 0.2 -1.2-0.1 -1 0.5 -1.3 0.3 -1.1-0.6 -1.3 0.2
          -0.8-0.9 -1.2 0 -1.1-0.4 -1-0.8 -1.2-0.1 -1-0.5 -1.2 0.1
          -1-0.8 -0.8-0.7 -0.1-1.3 -0.8-0.7 -1-0.5 -0.4-1.3 -0.2-1.4
          -0.7-0.8 0-1.2 -0.6-0.8 -0.2-1.3 0.4-1.2 0.6-0.9 0-1.4
          -0.7-0.7 -0.9-0.4 -0.8-1 -0.1-1.3 -0.7-0.6 z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M36.2 50.8c0.5 0.4 0.8 0.8 0.7 1.3-0.1 0.5-0.5 0.8-1 0.8-0.6 0-0.9-0.4-0.9-0.8 0-0.5 0.4-0.9 1.2-1.3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M45.2 45c0.8 0.5 1.2 1.1 1 1.8-0.1 0.7-0.6 1.1-1.2 1.1-0.7 0-1.1-0.5-1-1.2 0.1-0.7 0.5-1.2 1.2-1.7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function NavBar({ onMenuOpen }) {
  const { user } = useUser()
  const navigate = useNavigate()
  const location = useLocation()
  const { mapMode, isMapFullscreen, setMapMode } = useCheckinStore()

  const toggleMap = () => setMapMode(mapMode === 'china' ? 'world' : 'china')

  return (
    <nav className={`navbar ${isMapFullscreen ? 'navbar--map-fullscreen' : ''}`}>
      <div className={`navbar-left ${isMapFullscreen ? 'navbar-group--hidden' : ''}`}>
        <button className="nav-icon-btn" onClick={onMenuOpen} aria-label="菜单">
          <MenuOutlined />
        </button>
        <button type="button" className="navbar-logo" onClick={() => navigate('/')} aria-label="返回首页">
          <span className="logo-emoji">🌍</span>
          <span className="logo-text">WonderWalk</span>
        </button>
      </div>
      <div className="navbar-right">
        {location.pathname === '/' && !isMapFullscreen && (
          <Tooltip title={mapMode === 'china' ? '切换世界地图' : '切换中国地图'}>
            <button className="nav-icon-btn nav-map-toggle" onClick={toggleMap}>
              {mapMode === 'china' ? <GlobalOutlined /> : <ChinaMapToggleIcon />}
            </button>
          </Tooltip>
        )}

        {!isMapFullscreen && (
          <Tooltip title="旅行广场">
            <button
              className="nav-icon-btn"
              onClick={() => message.info('广场功能即将上线')}
              aria-label="广场"
            >
              <TeamOutlined />
            </button>
          </Tooltip>
        )}

        <button type="button" className="nav-avatar-btn" onClick={() => navigate('/settings')} aria-label="打开设置">
          <Avatar
            src={user?.imageUrl}
            icon={!user?.imageUrl && <UserOutlined />}
            className="nav-avatar"
            size={38}
          />
        </button>
      </div>
    </nav>
  )
}
