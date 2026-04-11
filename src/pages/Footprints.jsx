import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Button, Card, DatePicker, Empty, Input, Popconfirm, message } from 'antd'
import { ArrowLeftOutlined, CalendarOutlined, DeleteOutlined, EditOutlined, EnvironmentOutlined, SearchOutlined } from '@ant-design/icons'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import useCheckinStore from '../store/useCheckinStore'
import './Footprints.css'

const getCheckinTitle = (item) => {
  if (item.type === 'china_city') return item.city_name || item.name_zh?.split(' · ').at(-1) || item.name_en || '未知城市'
  return item.name_en || item.name_zh || '未知地点'
}

const getCheckinSubtitle = (item) => {
  if (item.type === 'china_city') {
    return item.province_name || (item.name_zh?.includes(' · ') ? item.name_zh.split(' · ')[0] : '')
  }

  if (item.name_zh && item.name_en && item.name_zh !== item.name_en) {
    return item.name_zh
  }

  return item.code || ''
}

const getSearchText = (item) => [
  item.city_name,
  item.province_name,
  item.name_zh,
  item.name_en,
  item.code,
]
  .filter(Boolean)
  .join(' ')
  .toLowerCase()

export default function Footprints() {
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const { checkins, removeCheckin, updateCheckinTime, setMapMode } = useCheckinStore()
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const filteredCheckins = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return checkins
    return checkins.filter((item) => getSearchText(item).includes(keyword))
  }, [checkins, query])

  const handleUpdateTime = async (id, value) => {
    if (!value) return
    await updateCheckinTime(id, value.startOf('month').valueOf(), getToken)
    setEditingId(null)
    message.success('打卡时间已更新')
  }

  return (
    <AppShell contentClassName="footprints-page">
      <section className="footprints-hero glass-card">
        <div>
          <button type="button" className="page-back-btn" onClick={() => navigate(-1)}>
            <ArrowLeftOutlined />
            <span>返回</span>
          </button>
          <p className="footprints-eyebrow">Footprints</p>
          <h1>足迹</h1>
          <p className="footprints-description">拾光而上，记录每一场关于热爱的奔赴...</p>
        </div>
        <div className="footprints-hero-actions">
          <Input
            allowClear
            size="large"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索城市名、国家名、省份名"
            prefix={<SearchOutlined />}
            className="footprints-search"
          />
          <Button
            type="primary"
            className="footprints-checkin-btn"
            onClick={() => {
              setMapMode('china')
              navigate('/')
            }}
          >
            去打卡
          </Button>
        </div>
      </section>

      {filteredCheckins.length === 0 ? (
        <div className="footprints-empty glass-card">
          <Empty description={query ? '没有匹配的打卡记录' : '还没有打卡记录'} />
        </div>
      ) : (
        <section className="footprints-grid">
          {filteredCheckins.map((item) => (
            <Card key={item.id} className="footprint-card">
              <div className="footprint-card-top">
                <div>
                  <div className={`footprint-type footprint-type--${item.type === 'china_city' ? 'china' : 'world'}`}>
                    {item.type === 'china_city' ? '城市打卡' : '国家打卡'}
                  </div>
                  <h2>{getCheckinTitle(item)}</h2>
                  {getCheckinSubtitle(item) && <p className="footprint-subtitle">{getCheckinSubtitle(item)}</p>}
                </div>
                <EnvironmentOutlined className="footprint-icon" />
              </div>

              <div className="footprint-actions">
                <div className="footprint-time-row">
                  <CalendarOutlined />
                  <span>{dayjs(item.created_at).format('YYYY年M月')}</span>
                  {editingId !== item.id && (
                    <button
                      type="button"
                      className="footprint-inline-icon"
                      onClick={() => setEditingId(item.id)}
                      aria-label="修改打卡时间"
                    >
                      <EditOutlined />
                    </button>
                  )}
                </div>
                {editingId === item.id ? (
                  <DatePicker
                    picker="month"
                    needConfirm
                    open
                    allowClear={false}
                    value={item.created_at ? dayjs(item.created_at) : dayjs()}
                    onChange={(value) => handleUpdateTime(item.id, value)}
                    onOpenChange={(visible) => {
                      if (!visible) setEditingId(null)
                    }}
                    className="footprint-date-picker"
                  />
                ) : null}
                <Popconfirm
                  title="删除这条打卡？"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={async () => {
                    await removeCheckin(item.id, getToken)
                    message.success('已删除')
                  }}
                >
                  <Button danger type="text" icon={<DeleteOutlined />} className="footprint-delete-btn" />
                </Popconfirm>
              </div>
            </Card>
          ))}
        </section>
      )}
    </AppShell>
  )
}
