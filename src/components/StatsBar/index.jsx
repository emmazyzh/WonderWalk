// src/components/StatsBar/index.jsx
import useCheckinStore from '../../store/useCheckinStore'
import './StatsBar.css'

export default function StatsBar() {
  const { mapMode, getStatsCount } = useCheckinStore()
  const stats = getStatsCount()
  const provinceCount = stats.china
  const cityCount = stats.chinaCities

  return (
    <div className={`stats-bar ${mapMode === 'world' ? 'stats-bar--left' : 'stats-bar--right'}`}>
      <div className="stats-card">
        <div className="stats-card-head">
          <span className="stats-kicker">{mapMode === 'china' ? '中国足迹' : '世界足迹'}</span>
          <span className="stats-badge">{mapMode === 'china' ? '已点亮旅程' : '国家收藏'}</span>
        </div>
        {mapMode === 'china' ? (
          <>
            <div className="stats-grid">
              <div className="stats-metric">
                <div className="stats-label">省份</div>
                <div className="stats-count">{provinceCount}</div>
              </div>
              <div className="stats-metric stats-metric--accent">
                <div className="stats-label">城市</div>
                <div className="stats-count">{cityCount}</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="stats-grid">
              <div className="stats-metric">
                <div className="stats-label">点亮</div>
                <div className="stats-count">{stats.world}</div>
              </div>
              <div className="stats-metric stats-metric--wish">
                <div className="stats-label">心愿</div>
                <div className="stats-count">0</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
