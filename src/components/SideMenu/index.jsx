import { useState } from 'react'
import dayjs from 'dayjs'
import { Drawer, Tabs, List, Button, Popconfirm, Avatar, message, DatePicker } from 'antd'
import { UserOutlined, DeleteOutlined, EnvironmentFilled, PlusOutlined, EditOutlined } from '@ant-design/icons'
import { useUser, useAuth } from '@clerk/clerk-react'
import useCheckinStore from '../../store/useCheckinStore'
import './SideMenu.css'

export default function SideMenu({ open, onClose, onCheckinRequest }) {
  const {
    checkins,
    removeCheckin,
    updateCheckinTime,
    mapMode,
    setMapMode,
    getStatsCount,
  } = useCheckinStore()
  const { user } = useUser()
  const { getToken } = useAuth()
  const stats = getStatsCount()

  const chinaCheckins = checkins.filter((c) => c.type === 'china_city')
  const worldCheckins = checkins.filter((c) => c.type === 'world_country')

  const formatDate = (ts) => {
    if (!ts) return ''
    return new Date(ts).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'short',
    })
  }

  const handleUpdateTime = async (id, value) => {
    if (!value) return
    const createdAt = value.valueOf()
    await updateCheckinTime(id, createdAt, getToken)
    message.success('打卡时间已更新')
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
            <div className="side-menu-nickname">{user?.username || user?.firstName || '旅行家'}</div>
          </div>
        </div>
        <div className="side-menu-user-info">
          <div className="side-menu-stats-row">
            <span className="side-stats-chip">🏙️ {stats.chinaCities} 个城市</span>
            <span className="side-stats-chip side-stats-chip--world">🌍 {stats.world} 个国家</span>
          </div>
        </div>
      </div>

      <Tabs
        activeKey={mapMode}
        onChange={(key) => setMapMode(key)}
        className="side-menu-tabs"
        items={[
          {
            key: 'china',
            label: '城市打卡',
            children: (
              <CheckinListPane
                items={chinaCheckins}
                emptyText="还没有城市打卡记录"
                formatDate={formatDate}
                onOpenCheckin={onCheckinRequest}
                onClose={onClose}
                onDelete={async (id) => {
                  await removeCheckin(id, getToken)
                  message.success('已删除')
                }}
                onUpdateTime={handleUpdateTime}
              />
            ),
          },
          {
            key: 'world',
            label: '国家打卡',
            children: (
              <CheckinListPane
                items={worldCheckins}
                type="world"
                emptyText="还没有国家打卡记录"
                formatDate={formatDate}
                onOpenCheckin={onCheckinRequest}
                onClose={onClose}
                onDelete={async (id) => {
                  await removeCheckin(id, getToken)
                  message.success('已删除')
                }}
                onUpdateTime={handleUpdateTime}
              />
            ),
          },
        ]}
      />
    </Drawer>
  )
}

function CheckinListPane({ items, type = 'china', emptyText, formatDate, onOpenCheckin, onClose, onDelete, onUpdateTime }) {
  const [editingId, setEditingId] = useState(null)

  return (
    <div className="side-tab-content">
      <div className="side-actions-row">
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => { onClose(); onOpenCheckin?.() }}
          className="side-add-btn"
        >
          打卡
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="side-empty">
          <div className="side-empty-emoji">🗺️</div>
          <p>{emptyText}</p>
        </div>
      ) : (
        <List
          dataSource={items}
          renderItem={(item) => (
            <List.Item className="side-checkin-item">
              <div className="side-checkin-main">
                <div className="side-checkin-info">
                  <EnvironmentFilled className="side-checkin-icon" />
                  <div>
                    <div className="side-checkin-name">{type === 'world' ? (item.name_en || item.name_zh) : (item.name_zh || item.city_name || item.province_name)}</div>
                    {type === 'world' && item.name_zh && item.name_en && item.name_zh !== item.name_en && (
                      <div className="side-checkin-subname">{item.name_zh}</div>
                    )}
                  </div>
                </div>
                <div className="side-checkin-controls">
                  <div className="side-checkin-date">{formatDate(item.created_at)}</div>
                  {editingId === item.id ? (
                    <DatePicker
                      picker="month"
                      value={item.created_at ? dayjs(item.created_at) : null}
                      onChange={(value) => {
                        onUpdateTime(item.id, value)
                        setEditingId(null)
                      }}
                      className="side-date-picker"
                      allowClear={false}
                      open
                    />
                  ) : (
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      className="side-edit-btn"
                      onClick={() => setEditingId(item.id)}
                    />
                  )}
                  <Popconfirm
                    title="删除这条打卡？"
                    onConfirm={() => onDelete(item.id)}
                    okText="删除"
                    cancelText="取消"
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      className="side-delete-btn"
                    />
                  </Popconfirm>
                </div>
              </div>
            </List.Item>
          )}
        />
      )}
    </div>
  )
}
