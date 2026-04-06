// src/components/NavBar/index.jsx
import { Avatar, Tooltip, message } from 'antd'
import { MenuOutlined, GlobalOutlined, EnvironmentOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons'
import { useUser } from '@clerk/clerk-react'
import useCheckinStore from '../../store/useCheckinStore'
import './NavBar.css'

export default function NavBar({ onMenuOpen }) {
  const { user } = useUser()
  const { mapMode, setMapMode, language, setLanguage } = useCheckinStore()

  const toggleMap = () => setMapMode(mapMode === 'china' ? 'world' : 'china')
  const toggleLang = () => setLanguage(language === 'zh' ? 'en' : 'zh')

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <button className="nav-icon-btn" onClick={onMenuOpen} aria-label="菜单">
          <MenuOutlined />
        </button>
        <div className="navbar-logo">
          <span className="logo-emoji">🌍</span>
          <span className="logo-text">WonderWalk</span>
        </div>
      </div>
      <div className="navbar-right">
        {mapMode === 'world' && (
          <Tooltip title={language === 'zh' ? 'Switch to English' : '切换中文'}>
            <button className="nav-icon-btn nav-lang-btn" onClick={toggleLang}>
              {language === 'zh' ? 'EN' : '中'}
            </button>
          </Tooltip>
        )}

        <Tooltip title={mapMode === 'china' ? '切换世界地图' : '切换中国地图'}>
          <button className="nav-icon-btn nav-map-toggle" onClick={toggleMap}>
            {mapMode === 'china' ? <GlobalOutlined /> : <EnvironmentOutlined />}
          </button>
        </Tooltip>

        <Tooltip title="旅行广场">
          <button
            className="nav-icon-btn"
            onClick={() => message.info('广场功能即将上线')}
            aria-label="广场"
          >
            <TeamOutlined />
          </button>
        </Tooltip>

        <Avatar
          src={user?.imageUrl}
          icon={!user?.imageUrl && <UserOutlined />}
          className="nav-avatar"
          size={38}
        />
      </div>
    </nav>
  )
}
