import { useState, useEffect, useMemo } from 'react'
import { Modal, message, Spin, Empty, Button, Input } from 'antd'
import { AimOutlined, EnvironmentFilled, MinusOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
import { geoCentroid, geoMercator } from 'd3-geo'
import ReactConfetti from 'react-confetti'
import { useAuth } from '@clerk/clerk-react'
import useCheckinStore from '../../store/useCheckinStore'
import { CHINA_PROVINCES } from '../../data/chinaCities'
import { WORLD_COUNTRIES_LIST, getWorldCountryByCode } from '../../data/worldCountries'
import './CheckinModal.css'

const LOCAL_PROVINCE_GEO_BASE = '/data/china-provinces'
const REMOTE_PROVINCE_GEO_BASE = 'https://geo.datav.aliyun.com/areas_v3/bound'
const PROVINCE_MAP_WIDTH = 960
const PROVINCE_MAP_HEIGHT = 640
const PROVINCE_MAP_PADDING_LEFT = 0
const PROVINCE_MAP_PADDING_RIGHT = 0
const PROVINCE_MAP_PADDING_TOP = 0
const PROVINCE_MAP_PADDING_BOTTOM = 220
const PROVINCE_MIN_ZOOM = 0.85
const PROVINCE_MAX_ZOOM = 6
const PROVINCE_DEFAULT_ZOOM = 1

const dataCache = {}
const provinceGeoCache = {}

const CHINA_DIVISION_ALIASES = {
  阿拉善盟: '阿拉善',
  阿坝藏族羌族自治州: '阿坝',
  阿克苏地区: '阿克苏',
  阿勒泰地区: '阿勒泰',
  阿里地区: '阿里',
  巴音郭楞蒙古自治州: '巴音郭楞',
  博尔塔拉蒙古自治州: '博尔塔拉',
  昌吉回族自治州: '昌吉',
  楚雄彝族自治州: '楚雄',
  大理白族自治州: '大理',
  大兴安岭地区: '大兴安岭',
  德宏傣族景颇族自治州: '德宏',
  迪庆藏族自治州: '迪庆',
  恩施土家族苗族自治州: '恩施',
  甘南藏族自治州: '甘南',
  甘孜藏族自治州: '甘孜',
  果洛藏族自治州: '果洛',
  海南藏族自治州: '海南州',
  海北藏族自治州: '海北',
  海东市: '海东',
  海西蒙古族藏族自治州: '海西',
  和田地区: '和田',
  红河哈尼族彝族自治州: '红河',
  黄南藏族自治州: '黄南',
  济源产城融合示范区: '济源',
  克孜勒苏柯尔克孜自治州: '克州',
  凉山彝族自治州: '凉山',
  临夏回族自治州: '临夏',
  临沧市: '临沧',
  黔东南苗族侗族自治州: '黔东南',
  黔南布依族苗族自治州: '黔南',
  黔西南布依族苗族自治州: '黔西南',
  怒江傈僳族自治州: '怒江',
  神农架林区: '神农架',
  塔城地区: '塔城',
  吐鲁番市: '吐鲁番',
  文山壮族苗族自治州: '文山',
  锡林郭勒盟: '锡林郭勒',
  西双版纳傣族自治州: '西双版纳',
  湘西土家族苗族自治州: '湘西',
  兴安盟: '兴安',
  延边朝鲜族自治州: '延边',
  伊犁哈萨克自治州: '伊犁',
  玉树藏族自治州: '玉树',
}

function getSearchData(mapMode) {
  if (dataCache[mapMode]) return dataCache[mapMode]

  if (mapMode === 'china') {
    dataCache[mapMode] = { provinces: CHINA_PROVINCES }
  } else {
    dataCache[mapMode] = { provinces: [], cities: WORLD_COUNTRIES_LIST }
  }
  return dataCache[mapMode]
}

function getProvinceGeoSources(provinceCode) {
  const localUrl = `${LOCAL_PROVINCE_GEO_BASE}/${provinceCode}.json`
  const remoteFullUrl = `${REMOTE_PROVINCE_GEO_BASE}/${provinceCode}_full.json`
  const remoteSimpleUrl = `${REMOTE_PROVINCE_GEO_BASE}/${provinceCode}.json`

  if (provinceCode === '710000') {
    return [localUrl, remoteSimpleUrl]
  }

  return [localUrl, remoteFullUrl, remoteSimpleUrl]
}

function getProvinceDisplayName(item, selectedProvince, prefill) {
  return item?.provinceName || selectedProvince?.name || prefill?.name || ''
}

function getRegionDisplayName(feature) {
  return feature.properties?.name || feature.properties?.fullname || feature.properties?.fullName || ''
}

function getRegionShortName(name) {
  if (!name) return ''
  if (CHINA_DIVISION_ALIASES[name]) return CHINA_DIVISION_ALIASES[name]
  if (name.endsWith('市')) return name.slice(0, -1)
  return name
}

function normalizeRegionName(name) {
  return name
    .replace(/\s+/g, '')
    .replace(/特别行政区$/, '')
    .replace(/省$/, '')
    .replace(/市$/, '')
    .replace(/盟$/, '')
    .replace(/地区$/, '')
    .replace(/林区$/, '')
    .replace(/自治州$/, '')
    .replace(/自治县$/, '')
    .replace(/自治旗$/, '')
}

function getRegionCentroid(feature) {
  const point = feature.properties?.centroid || feature.properties?.center
  if (Array.isArray(point)) return point
  return geoCentroid(feature)
}

function getRingOrientation(ring) {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[i + 1]
    sum += (x2 - x1) * (y2 + y1)
  }
  return sum > 0 ? 'clockwise' : 'counterclockwise'
}

function normalizeChinaFeature(feature) {
  const geometry = feature.geometry
  if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) {
    return feature
  }

  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const normalizedPolygons = polygons.map((polygon) =>
    polygon.map((ring, ringIndex) => {
      const shouldBeClockwise = ringIndex === 0
      const isClockwise = getRingOrientation(ring) === 'clockwise'
      return isClockwise === shouldBeClockwise ? ring : [...ring].reverse()
    })
  )

  return {
    ...feature,
    geometry: {
      ...geometry,
      coordinates: geometry.type === 'Polygon' ? normalizedPolygons[0] : normalizedPolygons,
    },
  }
}

function normalizeProvinceGeoData(data) {
  if (!data?.features) return data
  return {
    ...data,
    features: data.features.map(normalizeChinaFeature),
  }
}

function getChinaCheckinLabel(names) {
  if (!names.length) return '点击地图选择要打卡的行政区'
  return `打卡${names.join('，')}`
}

function getChinaProvinceCode(checkin) {
  if (checkin.province_code) return String(checkin.province_code)
  if (typeof checkin.code === 'string' && checkin.code.includes('-')) {
    return checkin.code.split('-')[0]
  }
  return checkin.code ? String(checkin.code) : ''
}

function getDefaultProvinceViewport(geoData, selectedProvince) {
  const fallbackCenter = selectedProvince?.center || selectedProvince?.centroid || [104, 35]

  try {
    const centroid = geoCentroid(geoData)
    if (
      Array.isArray(centroid) &&
      centroid.length === 2 &&
      Number.isFinite(centroid[0]) &&
      Number.isFinite(centroid[1])
    ) {
      return { center: centroid, zoom: PROVINCE_DEFAULT_ZOOM }
    }
  } catch {
    // fall back to province metadata center
  }

  return { center: fallbackCenter, zoom: PROVINCE_DEFAULT_ZOOM }
}

export default function CheckinModal({ open, onClose, prefill }) {
  const { addCheckin, mapMode, checkins } = useCheckinStore()
  const { getToken } = useAuth()
  const [showConfetti, setShowConfetti] = useState(false)
  const [selectedRegions, setSelectedRegions] = useState([])
  const [worldQuery, setWorldQuery] = useState('')
  const [selectedWorld, setSelectedWorld] = useState(null)
  const [provinceGeoData, setProvinceGeoData] = useState(null)
  const [provinceGeoLoading, setProvinceGeoLoading] = useState(false)
  const [provinceGeoError, setProvinceGeoError] = useState('')
  const [provinceViewport, setProvinceViewport] = useState({ center: [104, 35], zoom: 1 })
  const isWorldQuickCheckin = mapMode === 'world' && Boolean(prefill?.code)
  const searchData = useMemo(() => getSearchData(mapMode), [mapMode])
  const provinces = useMemo(() => searchData.provinces ?? [], [searchData])
  const allData = useMemo(() => searchData.cities ?? [], [searchData])
  const selectedProvinceCode = mapMode === 'china' ? (prefill?.code || provinces[0]?.code || '') : ''
  const activeProvinceGeoData = provinceGeoData || provinceGeoCache[selectedProvinceCode] || null
  const checkedWorldCodes = useMemo(
    () => new Set(checkins.filter((c) => c.type === 'world_country').map((c) => c.code)),
    [checkins]
  )

  const selectedProvince = useMemo(
    () => provinces.find((province) => province.code === selectedProvinceCode) || null,
    [provinces, selectedProvinceCode]
  )

  useEffect(() => {
    if (!open || mapMode !== 'china' || !selectedProvinceCode) return

    if (provinceGeoCache[selectedProvinceCode]) {
      return
    }

    const controller = new AbortController()

    // Fetching province GeoJSON is the side effect; the loading flag mirrors that request lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProvinceGeoLoading(true)
    setProvinceGeoError('')

    const loadProvinceGeo = async () => {
      const sources = getProvinceGeoSources(selectedProvinceCode)

      for (const url of sources) {
        try {
          const response = await fetch(url, {
            signal: controller.signal,
            referrerPolicy: url.startsWith('http') ? 'no-referrer' : undefined,
          })
          if (!response.ok) continue
          const data = await response.json()
          return normalizeProvinceGeoData(data)
        } catch (error) {
          if (error.name === 'AbortError') throw error
        }
      }

      throw new Error(`province-geo-missing-${selectedProvinceCode}`)
    }

    loadProvinceGeo()
      .then((data) => {
        provinceGeoCache[selectedProvinceCode] = data
        setProvinceGeoData(data)
        setProvinceViewport(getDefaultProvinceViewport(data, selectedProvince))
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setProvinceGeoError('省份地图加载失败，请稍后重试')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setProvinceGeoLoading(false)
        }
      })

    return () => controller.abort()
  }, [open, mapMode, selectedProvince, selectedProvinceCode])

  const provinceRegions = useMemo(() => {
    if (mapMode !== 'china' || !activeProvinceGeoData?.features) return []

    return activeProvinceGeoData.features
      .filter((feature) => Boolean(getRegionDisplayName(feature)))
      .map((feature, index) => {
        const displayName = getRegionDisplayName(feature)
        const shortName = getRegionShortName(displayName)
        return {
          feature,
          code: feature.properties?.adcode?.toString() || `${selectedProvinceCode}-${index + 1}`,
          displayName,
          shortName,
          centroid: getRegionCentroid(feature),
        }
      })
  }, [activeProvinceGeoData, mapMode, selectedProvinceCode])

  const provinceProjection = useMemo(() => {
    if (!activeProvinceGeoData) return null
    return geoMercator().fitExtent(
      [
        [PROVINCE_MAP_PADDING_LEFT, PROVINCE_MAP_PADDING_TOP],
        [
          PROVINCE_MAP_WIDTH - PROVINCE_MAP_PADDING_RIGHT,
          PROVINCE_MAP_HEIGHT - PROVINCE_MAP_PADDING_BOTTOM,
        ],
      ],
      activeProvinceGeoData
    )
  }, [activeProvinceGeoData])

  const checkedChinaRegionLookup = useMemo(() => {
    const byCode = new Set()
    const byName = new Set()

    checkins
      .filter((item) => item.type === 'china_city' && getChinaProvinceCode(item) === selectedProvinceCode)
      .forEach((item) => {
        if (item.code) byCode.add(String(item.code))

        const names = [
          item.city_name,
          item.name_zh?.includes(' · ') ? item.name_zh.split(' · ').at(-1) : item.name_zh,
          item.name_en,
        ].filter(Boolean)

        names.forEach((name) => {
          byName.add(normalizeRegionName(name))
          byName.add(normalizeRegionName(getRegionShortName(name)))
        })
      })

    return { byCode, byName }
  }, [checkins, selectedProvinceCode])

  const isChinaRegionChecked = (region) => (
    checkedChinaRegionLookup.byCode.has(String(region.code)) ||
    checkedChinaRegionLookup.byName.has(normalizeRegionName(region.displayName)) ||
    checkedChinaRegionLookup.byName.has(normalizeRegionName(region.shortName))
  )

  const isChinaRegionSelected = (regionCode) => (
    selectedRegions.some((item) => item.code === regionCode)
  )

  const worldResults = useMemo(() => {
    if (mapMode !== 'world') return []
    const q = worldQuery.trim().toLowerCase()
    if (!q) return allData.slice(0, 40)
    return allData.filter((item) =>
      item.name.toLowerCase().includes(q) ||
      item.nameEn.toLowerCase().includes(q)
    ).slice(0, 40)
  }, [allData, mapMode, worldQuery])

  const selectedChinaNames = useMemo(
    () => selectedRegions.map((region) => region.displayName),
    [selectedRegions]
  )

  const handleChinaRegionToggle = (region) => {
    if (isChinaRegionChecked(region)) return

    setSelectedRegions((current) => {
      const exists = current.some((item) => item.code === region.code)
      if (exists) {
        return current.filter((item) => item.code !== region.code)
      }
      return [...current, region]
    })
  }

  const handleProvinceZoom = (direction) => {
    setProvinceViewport((current) => ({
      ...current,
      zoom: Math.max(
        PROVINCE_MIN_ZOOM,
        Math.min(PROVINCE_MAX_ZOOM, current.zoom + direction * 0.35)
      ),
    }))
  }

  const handleProvinceRecenter = () => {
    if (!activeProvinceGeoData) return
    setProvinceViewport(getDefaultProvinceViewport(activeProvinceGeoData, selectedProvince))
  }

  const handleChinaBatchCheckin = async () => {
    if (selectedRegions.length === 0) return

    const provinceName = getProvinceDisplayName(null, selectedProvince, prefill)

    for (const region of selectedRegions) {
      await addCheckin(
        {
          type: 'china_city',
          code: String(region.code),
          province_code: selectedProvinceCode,
          province_name: provinceName,
          city_name: region.shortName,
          name_zh: `${provinceName} · ${region.displayName}`,
          name_en: region.shortName,
        },
        getToken
      )
    }

    setShowConfetti(true)
    message.success({
      content: `🎉 已打卡 ${selectedRegions.length} 个行政区`,
      icon: '🚩',
    })
    setTimeout(() => {
      setShowConfetti(false)
      onClose()
    }, 1600)
  }

  const handleWorldConfirm = async () => {
    if (!selectedWorld) return
    if (checkedWorldCodes.has(selectedWorld.code)) {
      message.info(`${selectedWorld.name} 已经打卡过了`)
      return
    }

    await addCheckin(
      {
        type: 'world_country',
        code: selectedWorld.code,
        name_zh: selectedWorld.name,
        name_en: selectedWorld.nameEn || selectedWorld.name,
      },
      getToken
    )

    setShowConfetti(true)
    message.success({
      content: `🚩 已打卡 ${selectedWorld.name}`,
      icon: '🎉',
    })
    setTimeout(() => {
      setShowConfetti(false)
      onClose()
    }, 1600)
  }

  const emptyState = mapMode === 'world' ? '没有找到匹配的国家' : '暂无可展示的行政区数据'

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={mapMode === 'china' ? 1040 : 520}
      classNames={{ content: 'checkin-modal-content' }}
      styles={{ mask: { background: 'rgba(15, 23, 42, 0.45)' } }}
      closable={!showConfetti}
      transitionName="ant-fade"
      maskTransitionName="ant-fade"
      afterOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setSelectedRegions([])
          setWorldQuery('')
          setSelectedWorld(null)
          setProvinceGeoData(null)
          setProvinceGeoLoading(false)
          setProvinceGeoError('')
          return
        }

        setSelectedRegions([])
        setWorldQuery('')
        setProvinceGeoData(provinceGeoCache[selectedProvinceCode] || null)
        setProvinceGeoLoading(false)
        setProvinceGeoError('')
        if (provinceGeoCache[selectedProvinceCode]) {
          setProvinceViewport(getDefaultProvinceViewport(provinceGeoCache[selectedProvinceCode], selectedProvince))
        }
        setSelectedWorld(mapMode === 'world' ? (getWorldCountryByCode(prefill?.code) || prefill || null) : null)
      }}
    >
      {showConfetti && (
        <ReactConfetti
          numberOfPieces={180}
          recycle={false}
          colors={['#2563EB', '#F59E0B', '#EC4899', '#10B981', '#BFDBFE']}
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999, pointerEvents: 'none' }}
        />
      )}

      {mapMode === 'world' && (
        <div className="checkin-modal-header">
          <div className="checkin-modal-icon">🌍</div>
          <div className="checkin-modal-copy">
            <h2 className="checkin-modal-title">点亮去过的国家</h2>
            <p className="checkin-modal-subtitle">{selectedWorld?.name || ''}</p>
          </div>
        </div>
      )}

      <div className={`checkin-results ${mapMode === 'china' ? 'checkin-results--china' : ''}`}>
        {mapMode === 'china' && (
          <div className="province-map-shell">
            <div className="province-map-controls">
              <button
                type="button"
                className="province-map-control-btn"
                onClick={handleProvinceRecenter}
                aria-label="地图居中"
              >
                <AimOutlined />
              </button>
              <button
                type="button"
                className="province-map-control-btn"
                onClick={() => handleProvinceZoom(1)}
                aria-label="放大地图"
              >
                <PlusOutlined />
              </button>
              <button
                type="button"
                className="province-map-control-btn"
                onClick={() => handleProvinceZoom(-1)}
                aria-label="缩小地图"
              >
                <MinusOutlined />
              </button>
            </div>

            {provinceGeoLoading && (
              <div className="province-map-state">
                <Spin size="large" />
              </div>
            )}

            {!provinceGeoLoading && provinceGeoError && (
              <div className="province-map-state">
                <Empty description={provinceGeoError} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            )}

            {!provinceGeoLoading && !provinceGeoError && provinceRegions.length === 0 && (
              <div className="province-map-state">
                <Empty description={emptyState} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            )}

            {!provinceGeoLoading && !provinceGeoError && provinceRegions.length > 0 && provinceProjection && (
              <ComposableMap
                width={PROVINCE_MAP_WIDTH}
                height={PROVINCE_MAP_HEIGHT}
                projection={provinceProjection}
                className="province-detail-map"
              >
                <ZoomableGroup
                  center={provinceViewport.center}
                  zoom={provinceViewport.zoom}
                  minZoom={PROVINCE_MIN_ZOOM}
                  maxZoom={PROVINCE_MAX_ZOOM}
                  onMoveEnd={({ coordinates, zoom }) => {
                    setProvinceViewport({ center: coordinates, zoom })
                  }}
                >
                  <Geographies geography={activeProvinceGeoData}>
                    {({ geographies }) => geographies.map((geo) => {
                      const region = provinceRegions.find((item) => item.code === (geo.properties?.adcode?.toString() || ''))
                        || provinceRegions.find((item) => item.displayName === getRegionDisplayName(geo))

                      if (!region) return null

                      const checked = isChinaRegionChecked(region)
                      const selected = isChinaRegionSelected(region.code)
                      const fill = checked
                        ? '#BFDBFE'
                        : (selected ? '#FBCFE8' : '#FFFFFF')
                      const stroke = checked
                        ? '#60A5FA'
                        : (selected ? '#EC4899' : '#CBD5E1')

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          onClick={() => handleChinaRegionToggle(region)}
                          className={`province-detail-geo ${checked ? 'province-detail-geo--checked' : ''} ${selected ? 'province-detail-geo--selected' : ''}`}
                          style={{
                            default: {
                              fill,
                              stroke,
                              strokeWidth: selected ? 1.8 : 1.2,
                              outline: 'none',
                              cursor: checked ? 'not-allowed' : 'pointer',
                            },
                            hover: {
                              fill: checked ? '#93C5FD' : (selected ? '#F9A8D4' : '#EFF6FF'),
                              stroke: checked ? '#3B82F6' : (selected ? '#DB2777' : '#93C5FD'),
                              strokeWidth: selected ? 2.1 : 1.5,
                              outline: 'none',
                              cursor: checked ? 'not-allowed' : 'pointer',
                            },
                            pressed: {
                              fill: checked ? '#93C5FD' : '#F9A8D4',
                              stroke: checked ? '#3B82F6' : '#DB2777',
                              strokeWidth: 2.1,
                              outline: 'none',
                            },
                          }}
                        />
                      )
                    })}
                  </Geographies>

                  {provinceRegions.map((region) => {
                    const checked = isChinaRegionChecked(region)
                    const selected = isChinaRegionSelected(region.code)
                    const iconOffset = Math.max(24, region.displayName.length * 14)
                    return (
                      <Marker key={`label-${region.code}`} coordinates={region.centroid}>
                        <g
                          className="province-detail-label-group"
                          onClick={() => handleChinaRegionToggle(region)}
                        >
                          <text
                            textAnchor="middle"
                            className={`province-detail-label ${checked ? 'province-detail-label--checked' : ''} ${selected ? 'province-detail-label--selected' : ''}`}
                          >
                            {region.displayName}
                          </text>
                          {checked && (
                            <g
                              className="province-detail-check-icon"
                              transform={`translate(${iconOffset}, -8)`}
                            >
                              <circle r="8" />
                              <path d="M-3 0.5 L-0.5 3.2 L4 -3" />
                            </g>
                          )}
                        </g>
                      </Marker>
                    )
                  })}
                </ZoomableGroup>
              </ComposableMap>
            )}
          </div>
        )}

        {mapMode === 'world' && worldResults.length === 0 && (
          <Empty description={emptyState} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}

        {mapMode === 'world' && !isWorldQuickCheckin && (
          <>
            <div className="world-search-wrap">
              <Input
                value={worldQuery}
                onChange={(e) => setWorldQuery(e.target.value)}
                prefix={<SearchOutlined />}
                placeholder="搜索国家名称"
                className="world-search-input"
                allowClear
              />
            </div>
            {selectedWorld && (
              <div className="selected-world-panel">
                <div className="selected-world-title">{selectedWorld.nameEn}</div>
                <div className="selected-world-subtitle">{selectedWorld.name}</div>
              </div>
            )}
          </>
        )}

        {mapMode === 'world' && isWorldQuickCheckin && selectedWorld && (
          <div className="world-card-list">
            <button
              type="button"
              className={`checkin-result-item checkin-result-item--selected ${checkedWorldCodes.has(selectedWorld.code) ? 'checkin-result-item--checked' : ''}`}
              onClick={() => setSelectedWorld(selectedWorld)}
            >
              <EnvironmentFilled className="result-icon" />
              <div className="result-names">
                <span className="result-name-zh">{selectedWorld.nameEn}</span>
                <span className="result-name-en">{selectedWorld.name}</span>
              </div>
              <span className="result-checkin-btn">{checkedWorldCodes.has(selectedWorld.code) ? '已点亮' : '待点亮'}</span>
            </button>
          </div>
        )}

        {mapMode === 'world' && !isWorldQuickCheckin && worldResults.length > 0 && (
          <div className="world-card-list">
            {worldResults.map((item) => {
              const checked = checkedWorldCodes.has(item.code)
              return (
                <button
                  key={item.code}
                  type="button"
                  className={`checkin-result-item ${checked ? 'checkin-result-item--checked' : ''} ${selectedWorld?.code === item.code ? 'checkin-result-item--selected' : ''}`}
                  onClick={() => setSelectedWorld(item)}
                >
                  <EnvironmentFilled className="result-icon" />
                  <div className="result-names">
                    <span className="result-name-zh">{item.nameEn}</span>
                    <span className="result-name-en">{item.name}</span>
                  </div>
                  <span className="result-checkin-btn">{checked ? '已点亮' : '选择'}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {mapMode === 'china' && (
        <div className="checkin-modal-footer checkin-modal-footer--china">
          <div className="checkin-footer-copy checkin-footer-copy--china">
            {getChinaCheckinLabel(selectedChinaNames)}
          </div>
          <Button
            type="primary"
            size="large"
            className="checkin-confirm-btn"
            onClick={handleChinaBatchCheckin}
            disabled={selectedRegions.length === 0}
          >
            提交打卡
          </Button>
        </div>
      )}

      {mapMode === 'world' && (
        <div className="checkin-modal-footer">
          <div className="checkin-footer-copy">
            {selectedWorld ? `准备点亮 ${selectedWorld.nameEn}` : '先从列表里选择一个国家'}
          </div>
          <Button
            type="primary"
            size="large"
            className="checkin-confirm-btn"
            onClick={handleWorldConfirm}
            disabled={!selectedWorld}
          >
            点亮
          </Button>
        </div>
      )}
    </Modal>
  )
}
