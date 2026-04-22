import { Drawer, Avatar, Button } from 'antd'
import { CompassOutlined, HomeOutlined, PlusOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import useCheckinStore from '../../store/useCheckinStore'
import './SideMenu.css'

export default function SideMenu({ open, onClose }) {
  const { getStatsCount, setMapMode } = useCheckinStore()
  const { isSignedIn, user } = useUser()
  const navigate = useNavigate()
  const location = useLocation()
  const stats = isSignedIn ? getStatsCount() : { chinaCities: 0, world: 0 }

  const menuItems = [
    { key: '/', label: '首页', icon: <HomeOutlined /> },
    { key: '/footprints', label: '足迹', icon: <CompassOutlined /> },
    { key: '/settings', label: '设置', icon: <SettingOutlined /> },
  ]

  const handleNavigate = (path) => {
    navigate(path)
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="left"
      width={360}
      closable={false}
      classNames={{ body: 'side-menu-body' }}
      styles={{ header: { display: 'none' }, body: { padding: 0 } }}
    >
      <div className="side-menu-user-header">
        <div className="side-menu-user-bg" />
        <div className="side-menu-user-row">
          <Avatar
            src={user?.imageUrl}
            icon={!user?.imageUrl && <UserOutlined />}
            size={68}
            className="side-menu-avatar"
          />
          <div className="side-menu-user-info">
            <div className="side-menu-nickname">{isSignedIn ? (user?.firstName || '旅行家') : '旅行家'}</div>
            <div className="side-menu-email">{isSignedIn ? (user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '') : '登录后同步你的足迹'}</div>
          </div>
        </div>
        <div className="side-menu-user-info">
          <div className="side-menu-stats-row">
            <span className="side-stats-chip">🏙️ {stats.chinaCities} 个城市</span>
            <span className="side-stats-chip side-stats-chip--world">🌍 {stats.world} 个国家</span>
          </div>
        </div>
      </div>

      <div className="side-menu-section">
        <div className="side-menu-section-title">导航</div>
        <div className="side-menu-nav">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.key
            return (
              <button
                key={item.key}
                type="button"
                className={`side-menu-nav-item ${isActive ? 'side-menu-nav-item--active' : ''}`}
                onClick={() => handleNavigate(item.key)}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="side-menu-section side-menu-section--footer">
        <div className="side-menu-quick-card">
          <div className="side-menu-quick-title">继续记录你的旅行</div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            className="side-add-btn"
            onClick={() => {
              setMapMode('china')
              handleNavigate('/')
            }}
          >
            去打卡
          </Button>
        </div>
      </div>
    </Drawer>
  )
}
