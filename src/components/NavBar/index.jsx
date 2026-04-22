// src/components/NavBar/index.jsx
import { Avatar, Tooltip, message } from 'antd'
import { MenuOutlined, GlobalOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons'
import { useUser } from '@clerk/clerk-react'
import { useLocation, useNavigate } from 'react-router-dom'
import useCheckinStore from '../../store/useCheckinStore'
import chinaMapToggleIcon from '../../assets/china-map-toggle.png'
import './NavBar.css'

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
          <img src="/image.png" alt="" aria-hidden="true" className="logo-icon" />
          <span className="logo-text">WonderWalk</span>
        </button>
      </div>
      <div className="navbar-right">
        {location.pathname === '/' && !isMapFullscreen && (
          <Tooltip title={mapMode === 'china' ? '切换世界地图' : '切换中国地图'}>
            <button className="nav-icon-btn nav-map-toggle" onClick={toggleMap}>
              {mapMode === 'china' ? (
                <GlobalOutlined />
              ) : (
                <img
                  src={chinaMapToggleIcon}
                  alt=""
                  aria-hidden="true"
                  className="nav-map-toggle-icon"
                />
              )}
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
