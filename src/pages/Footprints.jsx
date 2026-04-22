import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Button, Card, DatePicker, Empty, Input, Popconfirm, message } from 'antd'
import { CalendarOutlined, DeleteOutlined, EditOutlined, EnvironmentOutlined, SearchOutlined } from '@ant-design/icons'
import { useAuth } from '@clerk/clerk-react'
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
  const { checkins, removeCheckin, updateCheckinTime } = useCheckinStore()
  const { getToken } = useAuth()

  const filteredCheckins = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return checkins
    return checkins.filter((item) => getSearchText(item).includes(keyword))
  }, [checkins, query])

  const groupedCheckins = useMemo(() => {
    const groups = filteredCheckins.reduce((accumulator, item) => {
      const key = dayjs(item.created_at).startOf('month').format('YYYY-MM')
      const existing = accumulator.get(key)

      if (existing) {
        existing.items.push(item)
        return accumulator
      }

      accumulator.set(key, {
        key,
        label: dayjs(item.created_at).format('YYYY年M月'),
        year: dayjs(item.created_at).format('YYYY'),
        month: dayjs(item.created_at).format('M月'),
        value: dayjs(item.created_at).startOf('month').valueOf(),
        items: [item],
      })
      return accumulator
    }, new Map())

    return Array.from(groups.values())
      .sort((left, right) => right.value - left.value)
      .map((group) => ({
        ...group,
        items: [...group.items].sort((left, right) => (right.created_at || 0) - (left.created_at || 0)),
      }))
  }, [filteredCheckins])

  const handleUpdateTime = async (id, value) => {
    if (!value) return
    await updateCheckinTime(id, value.startOf('month').valueOf(), getToken)
    setEditingId(null)
    message.success('打卡时间已更新')
  }

  return (
    <AppShell contentClassName="footprints-page">
      <section className="footprints-hero">
        <div className="footprints-hero-copy">
          <p className="footprints-description">拾光而上，行迹千里...</p>
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
        </div>
      </section>

      {filteredCheckins.length === 0 ? (
        <div className="footprints-empty glass-card">
          <Empty description={query ? '没有匹配的打卡记录' : '还没有打卡记录'} />
        </div>
      ) : (
        <section className="footprints-timeline glass-card">
          {groupedCheckins.map((group, index) => (
            <div key={group.key} className="footprints-timeline-group">
              <div className="footprints-timeline-date">
                <span className="footprints-timeline-year">{group.year}</span>
                <span className="footprints-timeline-month">{group.month}</span>
                <span className="footprints-timeline-label">{group.label}</span>
              </div>

              <div className="footprints-timeline-rail" aria-hidden="true">
                <span className="footprints-timeline-dot" />
                {index < groupedCheckins.length - 1 && <span className="footprints-timeline-line" />}
              </div>

              <div className="footprints-timeline-cards">
                {group.items.map((item) => (
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
              </div>
            </div>
          ))}
        </section>
      )}
    </AppShell>
  )
}
