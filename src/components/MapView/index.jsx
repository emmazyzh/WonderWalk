import { useState, useEffect, useMemo } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from 'react-simple-maps'
import useCheckinStore from '../../store/useCheckinStore'
import { getWorldCountryByCode } from '../../data/worldCountries'
import './MapView.css'

const WORLD_GEO = '/data/world-110m.json'
const CHINA_GEO = '/data/china-provinces.json'
const MAP_WIDTH = 1000
const MAP_HEIGHT = 620

// Country/province name mapping for world map
const getFeatureName = (geo, language) => {
  const chinaName = geo.properties?.name || geo.properties?.province || geo.properties?.fullName

  if (language === 'en') {
    return geo.properties?.NAME || geo.properties?.NAME_EN || chinaName || geo.id || '未知地区'
  }
  return chinaName || geo.properties?.NAME || geo.id || '未知地区'
}

const getFeatureCode = (geo, mapMode) => {
  if (mapMode === 'world') {
    return geo.properties?.ISO_A3 || geo.properties?.iso_a3 || geo.properties?.ADM0_A3 || geo.id
  }
  // China: use province name as code
  return geo.properties?.adcode?.toString() || geo.properties?.name || geo.id
}

const isRenderableFeature = (geo, mapMode) => {
  if (mapMode !== 'china') return true
  return Boolean(geo.properties?.name?.trim())
}

const getRingOrientation = (ring) => {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[i + 1]
    sum += (x2 - x1) * (y2 + y1)
  }
  return sum > 0 ? 'clockwise' : 'counterclockwise'
}

const normalizeChinaFeature = (feature) => {
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

const normalizeGeoData = (data, mapMode) => {
  if (mapMode !== 'china' || !data?.features) return data
  return {
    ...data,
    features: data.features.map(normalizeChinaFeature),
  }
}

const interpolateColor = (start, end, ratio) => {
  const clampRatio = Math.max(0, Math.min(1, ratio))
  const channels = start.map((channel, index) =>
    Math.round(channel + (end[index] - channel) * clampRatio)
  )
  return `rgb(${channels.join(', ')})`
}

const getProvinceFill = (count, maxCount) => {
  if (!count) return '#D1D5DB'
  if (maxCount <= 1) return 'rgb(37, 99, 235)'
  return interpolateColor([191, 219, 254], [236, 72, 153], count / maxCount)
}

const getMarkerCoordinates = (center, index) => {
  const offsets = [
    [0, 0],
    [0.9, 0.3],
    [-0.8, 0.45],
    [0.65, -0.55],
    [-0.55, -0.65],
    [1.1, -0.1],
  ]
  const [lngOffset, latOffset] = offsets[index % offsets.length]
  return [center[0] + lngOffset, center[1] + latOffset]
}

const getChinaProvinceCode = (checkin) => {
  if (checkin.province_code) return checkin.province_code
  if (typeof checkin.code === 'string' && checkin.code.includes('-')) {
    return checkin.code.split('-')[0]
  }
  return checkin.code
}

const getChinaCityName = (checkin) => {
  if (checkin.city_name) return checkin.city_name
  if (checkin.name_zh?.includes(' · ')) {
    const parts = checkin.name_zh.split(' · ')
    return parts[parts.length - 1]
  }
  return checkin.name_zh || ''
}

const getWorldCountryMeta = (geo) => {
  const code = geo.properties?.ISO_A3 || geo.properties?.iso_a3 || geo.properties?.ADM0_A3 || geo.id
  return getWorldCountryByCode(code)
}

export default function MapView({ onCheckinRequest }) {
  const { mapMode, language, checkins, getCheckedCodes, getCheckinsByCode } = useCheckinStore()
  const [tooltipTitle, setTooltipTitle] = useState('')
  const [tooltipSubtitle, setTooltipSubtitle] = useState('')
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipCheckins, setTooltipCheckins] = useState([])
  const [tooltipCities, setTooltipCities] = useState([])
  const [tooltipVariant, setTooltipVariant] = useState('province')
  const [geoData, setGeoData] = useState(null)
  const checkedCodes = getCheckedCodes()
  const chinaProvinceCheckins = useMemo(
    () => checkins.filter((item) => item.type === 'china_city'),
    [checkins]
  )

  const geoUrl = mapMode === 'china' ? CHINA_GEO : WORLD_GEO

  useEffect(() => {
    // 强制每次切换地图时自己 fetch 数据，彻底避开 react-simple-maps 的诡异缓存 BUG
    fetch(geoUrl)
      .then((res) => res.json())
      .then((data) => {
        setGeoData(normalizeGeoData(data, mapMode))
      })
      .catch((err) => console.error('Failed to load map data:', err))
  }, [geoUrl])

  const mapConfig = mapMode === 'china'
    ? { center: [104, 38], zoom: 1.22, minZoom: 1, maxZoom: 6 }
    : { center: [0, 28], zoom: 1, minZoom: 1, maxZoom: 6 }

  const handleMouseEnter = (geo, evt) => {
    const code = getFeatureCode(geo, mapMode)
    const checkins = getCheckinsByCode(code, mapMode)
    const cityTags = [...new Set(checkins.map((item) => getChinaCityName(item)).filter(Boolean))]
    if (mapMode === 'world') {
      const worldMeta = getWorldCountryMeta(geo)
      setTooltipTitle(worldMeta?.nameEn || getFeatureName(geo, 'en'))
      setTooltipSubtitle(worldMeta?.name || '')
    } else {
      setTooltipTitle(getFeatureName(geo, language))
      setTooltipSubtitle('')
    }
    setTooltipCheckins(checkins)
    setTooltipCities(cityTags)
    setTooltipVariant('province')
    setShowTooltip(true)
  }

  const handleMouseMove = (evt) => {
    setTooltipPos({ x: evt.clientX, y: evt.clientY })
  }

  const handleMouseLeave = () => {
    setShowTooltip(false)
    setTooltipCheckins([])
    setTooltipCities([])
    setTooltipSubtitle('')
  }

  const handleClick = (geo) => {
    const code = getFeatureCode(geo, mapMode)
    const worldMeta = mapMode === 'world' ? getWorldCountryMeta(geo) : null
    const name = worldMeta?.name || getFeatureName(geo, 'zh')
    const nameEn = worldMeta?.nameEn || getFeatureName(geo, 'en')
    onCheckinRequest?.({ code, name, nameEn, mapMode })
  }

  const provinceVisitCounts = useMemo(() => {
    if (mapMode !== 'china') return {}

    return chinaProvinceCheckins.reduce((acc, item) => {
      const provinceCode = getChinaProvinceCode(item)
      acc[provinceCode] = (acc[provinceCode] || 0) + 1
      return acc
    }, {})
  }, [chinaProvinceCheckins, mapMode])

  const maxProvinceCount = useMemo(() => {
    const counts = Object.values(provinceVisitCounts)
    return counts.length ? Math.max(...counts) : 0
  }, [provinceVisitCounts])

  const provinceCenters = useMemo(() => {
    if (!geoData?.features || mapMode !== 'china') return {}

    return geoData.features.reduce((acc, feature) => {
      const code = feature.properties?.adcode?.toString()
      const center = feature.properties?.center || feature.properties?.centroid
      if (code && Array.isArray(center)) {
        acc[code] = center
      }
      return acc
    }, {})
  }, [geoData, mapMode])

  const chinaMarkers = useMemo(() => {
    if (mapMode !== 'china') return []

    const groupedByProvince = chinaProvinceCheckins.reduce((acc, item) => {
      const provinceCode = getChinaProvinceCode(item)
      if (!provinceCenters[provinceCode]) return acc
      if (!acc[provinceCode]) acc[provinceCode] = []
      acc[provinceCode].push(item)
      return acc
    }, {})

    return Object.entries(groupedByProvince).flatMap(([provinceCode, items]) => {
      const groupedByCity = items.reduce((acc, item) => {
        const cityKey = item.city_name || item.code
        if (!acc[cityKey]) acc[cityKey] = []
        acc[cityKey].push(item)
        return acc
      }, {})

      return Object.entries(groupedByCity).map(([cityKey, cityItems], index) => ({
        id: `${provinceCode}-${cityKey}`,
        cityName: getChinaCityName(cityItems[0]) || cityKey,
        provinceName: cityItems[0].province_name || (cityItems[0].name_zh?.split(' · ')[0] ?? ''),
        checkins: cityItems,
        coordinates: getMarkerCoordinates(provinceCenters[provinceCode], index),
      }))
    })
  }, [chinaProvinceCheckins, mapMode, provinceCenters])

  return (
    <div className="map-container" onMouseMove={handleMouseMove}>
      <ComposableMap
        key={mapMode}
        className={`composable-map ${mapMode === 'china' ? 'composable-map--china' : ''}`}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        projection={mapMode === 'china' ? 'geoMercator' : 'geoEqualEarth'}
        projectionConfig={
          mapMode === 'china'
            ? { center: [104, 38], scale: 580 }
            : { center: [0, 28], scale: 220 }
        }
      >
        <ZoomableGroup
          center={mapConfig.center}
          zoom={mapConfig.zoom}
          minZoom={mapConfig.minZoom}
          maxZoom={mapConfig.maxZoom}
        >
          {geoData && (
            <Geographies geography={geoData}>
              {({ geographies }) =>
                geographies
                  .filter((geo) => isRenderableFeature(geo, mapMode))
                  .map((geo, index) => {
                    const code = getFeatureCode(geo, mapMode)
                    const isVisited = checkedCodes.has(code)
                    const visitCount = provinceVisitCounts[code] || 0
                    const fillColor = mapMode === 'china'
                      ? getProvinceFill(visitCount, maxProvinceCount)
                      : (isVisited ? 'var(--map-visited)' : '#D1D5DB')

                    return (
                      <Geography
                        key={geo.rsmKey || index}
                        geography={geo}
                        className={`map-geo ${isVisited ? 'map-geo--visited' : ''}`}
                        onMouseEnter={(evt) => handleMouseEnter(geo, evt)}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => handleClick(geo)}
                        style={{
                          default: {
                            fill: fillColor,
                            stroke: '#ffffff',
                            strokeWidth: mapMode === 'china' ? 0.8 : 0.5,
                            outline: 'none',
                          },
                          hover: {
                            fill: mapMode === 'china'
                              ? (visitCount ? getProvinceFill(visitCount, Math.max(maxProvinceCount, 1)) : '#C7D0DB')
                              : (isVisited ? 'var(--map-visited)' : '#C7D0DB'),
                            stroke: '#ffffff',
                            strokeWidth: mapMode === 'china' ? 0.9 : 0.6,
                            outline: 'none',
                            cursor: 'pointer',
                          },
                          pressed: {
                            fill: isVisited ? 'var(--map-visited)' : '#BCC5D2',
                            stroke: '#ffffff',
                            strokeWidth: mapMode === 'china' ? 0.9 : 0.6,
                            outline: 'none',
                          },
                        }}
                      />
                    )
                  })
              }
            </Geographies>
          )}
          {mapMode === 'china' && chinaMarkers.map((marker) => (
            <Marker key={marker.id} coordinates={marker.coordinates}>
              <g
                className="city-marker"
                onMouseEnter={(evt) => {
                  setTooltipTitle(`${marker.provinceName} · ${marker.cityName}`)
                  setTooltipSubtitle('')
                  setTooltipCheckins(marker.checkins)
                  setTooltipCities([])
                  setTooltipVariant('city')
                  setShowTooltip(true)
                  setTooltipPos({ x: evt.clientX, y: evt.clientY })
                }}
                onMouseLeave={handleMouseLeave}
              >
                <path d="M0 -4.5 C2 -4.5 3.6 -3 3.6 -1 C3.6 1.4 1 3.4 0 5.6 C-1 3.4 -3.6 1.4 -3.6 -1 C-3.6 -3 -2 -4.5 0 -4.5 Z" className="city-marker-pin" />
                <circle cx="0" cy="-1.2" r="1.45" className="city-marker-dot" />
              </g>
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {/* Custom tooltip */}
      {showTooltip && tooltipTitle && (
        <div
          className="map-tooltip"
          style={{ left: tooltipPos.x + 14, top: tooltipPos.y - 10 }}
        >
          <div className="map-tooltip-name">{tooltipTitle}</div>
          {tooltipSubtitle && <div className="map-tooltip-subtitle">{tooltipSubtitle}</div>}
          {tooltipVariant === 'province' && tooltipCities.length > 0 && (
            <div className="map-tooltip-tags">
              {tooltipCities.map((city) => (
                <span key={city} className="map-tooltip-tag">{city}</span>
              ))}
            </div>
          )}
          {tooltipVariant === 'city' && tooltipCheckins.length > 0 && (
            <div className="map-tooltip-checkins">
              {tooltipCheckins.map((c, i) => (
                <div key={i} className="map-tooltip-date">
                  {new Date(c.created_at).toLocaleDateString('zh-CN')} 到此一游
                </div>
              ))}
            </div>
          )}
          {tooltipVariant === 'province' && tooltipCities.length === 0 && (
            <div className="map-tooltip-hint">点击打卡</div>
          )}
        </div>
      )}
    </div>
  )
}
