import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import dayjs from 'dayjs'
import { AimOutlined, FullscreenExitOutlined, FullscreenOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from 'react-simple-maps'
import { geoCentroid } from 'd3-geo'
import { feature } from 'topojson-client'
import useCheckinStore from '../../store/useCheckinStore'
import { getWorldCountryByCode, getWorldCountryCodeByName, getWorldCountryNameZh } from '../../data/worldCountries'
import { getChinaCityCoordinate } from '../../data/chinaCities'
import './MapView.css'

const WORLD_GEO = '/data/world-110m.json'
const CHINA_GEO = '/data/china-provinces.json'
const MAP_WIDTH = 1000
const MAP_HEIGHT = 620
const CHINA_ZOOM_LEVELS = [0.85, 1, 1.2, 1.5, 1.8, 2.1]
const WORLD_DEFAULT_VIEWPORT = { center: [0, 7], zoom: 1 }
const WORLD_MIN_ZOOM = 0.85
const WORLD_MAX_ZOOM = 6
const WORLD_ZOOM_STEP = 0.15
const WORLD_NUMERIC_TO_ALPHA3 = {
  36: 'AUS',
  40: 'AUT',
  56: 'BEL',
  124: 'CAN',
  144: 'LKA',
  158: 'CHN',
  156: 'CHN',
  208: 'DNK',
  250: 'FRA',
  276: 'DEU',
  300: 'GRC',
  344: 'CHN',
  356: 'IND',
  352: 'ISL',
  360: 'IDN',
  380: 'ITA',
  392: 'JPN',
  410: 'KOR',
  446: 'CHN',
  458: 'MYS',
  528: 'NLD',
  554: 'NZL',
  578: 'NOR',
  620: 'PRT',
  643: 'RUS',
  702: 'SGP',
  710: 'ZAF',
  724: 'ESP',
  752: 'SWE',
  756: 'CHE',
  764: 'THA',
  792: 'TUR',
  784: 'ARE',
  818: 'EGY',
  826: 'GBR',
  840: 'USA',
  704: 'VNM',
  608: 'PHL',
  616: 'POL',
}
const WORLD_MARKER_COORDINATE_OVERRIDES = {
  // Nudge dense East Asia markers apart so pins remain individually visible.
  SGP: [104.55, 1.0],
  HKG: [114.85, 22.55],
  MAC: [113.25, 21.82],
}
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
    const alphaCode = geo.properties?.ISO_A3 || geo.properties?.iso_a3 || geo.properties?.ADM0_A3
    if (typeof alphaCode === 'string' && /^[A-Z]{3}$/.test(alphaCode)) return alphaCode

    const numericCode = String(geo.id || '').replace(/^0+/, '')
    if (WORLD_NUMERIC_TO_ALPHA3[numericCode]) return WORLD_NUMERIC_TO_ALPHA3[numericCode]

    const byName = getWorldCountryCodeByName(geo.properties?.name || '')
    if (byName) return byName

    return String(geo.id || '')
  }
  // China: use province name as code
  return geo.properties?.adcode?.toString() || geo.properties?.name || geo.id
}

const normalizeWorldCode = (value = '') => {
  const code = String(value || '').toUpperCase()
  if (code === 'TWN' || code === 'HKG' || code === 'MAC') return 'CHN'
  if (/^[A-Z]{3}$/.test(code)) return code

  const numericCode = code.replace(/^0+/, '')
  if (WORLD_NUMERIC_TO_ALPHA3[numericCode]) return WORLD_NUMERIC_TO_ALPHA3[numericCode]

  return getWorldCountryCodeByName(String(value || '')) || ''
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
    features: data.features
      .map(normalizeChinaFeature)
      .map((feature) => {
        if (feature.properties?.adcode !== 460000) return feature
        const geometry = feature.geometry
        if (!geometry || geometry.type !== 'MultiPolygon') return feature
        const [largestPolygon] = [...geometry.coordinates]
          .sort((a, b) => {
            const area = (ringSet) => Math.abs(ringSet[0].reduce((sum, point, index) => {
              if (index === ringSet[0].length - 1) return sum
              const [x1, y1] = point
              const [x2, y2] = ringSet[0][index + 1]
              return sum + ((x1 * y2) - (x2 * y1))
            }, 0) / 2)
            return area(b) - area(a)
          })

        return {
          ...feature,
          geometry: {
            ...geometry,
            type: 'Polygon',
            coordinates: largestPolygon,
          },
        }
      }),
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

const CONTINENT_COLORS = {
  north_america: interpolateColor([191, 219, 254], [236, 72, 153], 0),
  south_america: interpolateColor([191, 219, 254], [236, 72, 153], 0.2),
  europe: interpolateColor([191, 219, 254], [236, 72, 153], 0.4),
  africa: interpolateColor([191, 219, 254], [236, 72, 153], 0.58),
  asia: interpolateColor([191, 219, 254], [236, 72, 153], 0.76),
  oceania: interpolateColor([191, 219, 254], [236, 72, 153], 0.92),
  antarctica: interpolateColor([191, 219, 254], [236, 72, 153], 0.12),
  default: interpolateColor([191, 219, 254], [236, 72, 153], 0.3),
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
  const code = getFeatureCode(geo, 'world')
  return getWorldCountryByCode(code)
}

const formatWorldTooltipLine = (checkins, nameEn, nameZh) => {
  if (!checkins.length) return ''

  const months = [...new Set(
    checkins
      .map((item) => dayjs(Number(item.created_at)).format('YYYY年M月'))
      .filter(Boolean)
  )]

  return `我在${months.join('，')}到过${nameEn}（${nameZh}）`
}

const getWorldContinentByCenter = ([lng, lat]) => {
  if (lat <= -60) return 'antarctica'
  if (lng >= 110 && lat <= 25) return 'oceania'
  if (lng >= -20 && lng <= 55 && lat >= -35 && lat <= 38) return 'africa'
  if (lng >= -170 && lng <= -20 && lat >= 7) return 'north_america'
  if (lng >= -92 && lng <= -30 && lat < 15) return 'south_america'
  if (lng >= -25 && lng <= 60 && lat >= 35) return 'europe'
  if (lng >= 25 && lng <= 180) return 'asia'
  if (lng >= -20 && lng <= 55) return 'africa'
  return 'default'
}

export default function MapView({ onCheckinRequest }) {
  const {
    mapMode,
    language,
    checkins,
    isMapFullscreen,
    setMapFullscreen,
    getCheckedCodes,
    getCheckinsByCode,
  } = useCheckinStore()
  const [tooltipTitle, setTooltipTitle] = useState('')
  const [tooltipSubtitle, setTooltipSubtitle] = useState('')
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipCheckins, setTooltipCheckins] = useState([])
  const [tooltipCities, setTooltipCities] = useState([])
  const [tooltipVariant, setTooltipVariant] = useState('province')
  const [hoveredWorldCode, setHoveredWorldCode] = useState('')
  const tooltipRef = useRef(null)
  const [geoData, setGeoData] = useState(null)
  const [chinaZoomLevel, setChinaZoomLevel] = useState(3)
  const [worldViewport, setWorldViewport] = useState(WORLD_DEFAULT_VIEWPORT)
  const chinaProvinceCheckins = useMemo(
    () => checkins.filter((item) => item.type === 'china_city'),
    [checkins]
  )
  const worldCountryCheckins = useMemo(
    () => checkins.filter((item) => item.type === 'world_country'),
    [checkins]
  )
  const worldCheckinsByCode = useMemo(() => (
    worldCountryCheckins.reduce((acc, item) => {
      const normalizedCode = normalizeWorldCode(item.code)
        || normalizeWorldCode(item.name_en)
        || normalizeWorldCode(item.name_zh)
      if (!normalizedCode) return acc
      if (!acc[normalizedCode]) acc[normalizedCode] = []
      acc[normalizedCode].push(item)
      return acc
    }, {})
  ), [worldCountryCheckins])
  const checkedCodes = useMemo(() => {
    if (mapMode === 'china') return getCheckedCodes()
    return new Set(Object.keys(worldCheckinsByCode))
  }, [getCheckedCodes, mapMode, worldCheckinsByCode])

  const geoUrl = mapMode === 'china' ? CHINA_GEO : WORLD_GEO

  useEffect(() => {
    // 强制每次切换地图时自己 fetch 数据，彻底避开 react-simple-maps 的诡异缓存 BUG
    fetch(geoUrl)
      .then((res) => res.json())
      .then((data) => {
        setGeoData(normalizeGeoData(data, mapMode))
      })
      .catch((err) => console.error('Failed to load map data:', err))
  }, [geoUrl, mapMode])

  const mapConfig = mapMode === 'china'
    ? { center: [104, 38], zoom: CHINA_ZOOM_LEVELS[chinaZoomLevel - 1], minZoom: CHINA_ZOOM_LEVELS[0], maxZoom: CHINA_ZOOM_LEVELS[CHINA_ZOOM_LEVELS.length - 1] }
    : { center: worldViewport.center, zoom: worldViewport.zoom, minZoom: WORLD_MIN_ZOOM, maxZoom: WORLD_MAX_ZOOM }

  const handleChinaZoom = (direction) => {
    setChinaZoomLevel((current) => Math.max(1, Math.min(CHINA_ZOOM_LEVELS.length, current + direction)))
  }

  const handleChinaRecenter = () => {
    setChinaZoomLevel(3)
  }

  const handleWorldZoom = (direction) => {
    setWorldViewport((current) => ({
      ...current,
      zoom: Math.max(WORLD_MIN_ZOOM, Math.min(WORLD_MAX_ZOOM, current.zoom + (direction * WORLD_ZOOM_STEP))),
    }))
  }

  const handleWorldRecenter = () => {
    setWorldViewport(WORLD_DEFAULT_VIEWPORT)
  }

  const handleMouseEnter = (geo) => {
    const code = getFeatureCode(geo, mapMode)
    if (mapMode === 'world') {
      setHoveredWorldCode(code)
    }
    const checkins = mapMode === 'world'
      ? (worldCheckinsByCode[code] || [])
      : getCheckinsByCode(code, mapMode)
    const cityTags = [...new Set(checkins.map((item) => getChinaCityName(item)).filter(Boolean))]
    if (mapMode === 'world') {
      const worldMeta = getWorldCountryMeta(geo)
      const englishName = worldMeta?.nameEn || getFeatureName(geo, 'en')
      setTooltipTitle(worldMeta?.nameEn || getFeatureName(geo, 'en'))
      setTooltipSubtitle(getWorldCountryNameZh(code, englishName) || worldMeta?.name || '')
      setTooltipVariant('world-country')
    } else {
      setTooltipTitle(getFeatureName(geo, language))
      setTooltipSubtitle('')
      setTooltipVariant('province')
    }
    setTooltipCheckins(checkins)
    setTooltipCities(cityTags)
    setShowTooltip(true)
  }

  const handleMouseMove = useCallback((evt) => {
    if (tooltipRef.current) {
      tooltipRef.current.style.left = `${evt.clientX + 14}px`
      tooltipRef.current.style.top = `${evt.clientY - 10}px`
    }
  }, [])

  const handleMouseLeave = () => {
    setHoveredWorldCode('')
    setShowTooltip(false)
    setTooltipCheckins([])
    setTooltipCities([])
    setTooltipSubtitle('')
  }

  const handleClick = (geo) => {
    const code = getFeatureCode(geo, mapMode)
    const worldMeta = mapMode === 'world' ? getWorldCountryMeta(geo) : null
    const nameEn = worldMeta?.nameEn || getFeatureName(geo, 'en')
    const name = worldMeta?.name || getWorldCountryNameZh(code, nameEn) || getFeatureName(geo, 'zh')
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

  const worldFeatureMeta = useMemo(() => {
    if (mapMode !== 'world' || !geoData?.objects?.countries) return {}

    const worldFeatures = feature(geoData, geoData.objects.countries)?.features || []
    return worldFeatures.reduce((acc, worldFeature) => {
      const code = getFeatureCode(worldFeature, 'world')
      const center = geoCentroid(worldFeature)
      acc[code] = {
        center,
        continent: Array.isArray(center) ? getWorldContinentByCenter(center) : 'default',
      }
      return acc
    }, {})
  }, [geoData, mapMode])

  const worldMarkers = useMemo(() => {
    if (mapMode !== 'world') return []

    const grouped = worldCountryCheckins.reduce((acc, item) => {
      const normalizedCode = normalizeWorldCode(item.code)
        || normalizeWorldCode(item.name_en)
        || normalizeWorldCode(item.name_zh)
      if (!normalizedCode) return acc
      if (!acc[normalizedCode]) acc[normalizedCode] = []
      acc[normalizedCode].push(item)
      return acc
    }, {})

    return Object.entries(grouped)
      .map(([code, items]) => {
        const meta = worldFeatureMeta[code]
        const coordinates = meta?.center || WORLD_MARKER_COORDINATE_OVERRIDES[code]
        if (!coordinates) return null
        return {
          code,
          coordinates,
          checkins: items,
          title: items[0]?.name_en || items[0]?.name_zh || code,
          subtitle: items[0]?.name_zh || '',
        }
      })
      .filter(Boolean)
  }, [mapMode, worldCountryCheckins, worldFeatureMeta])

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

      return Object.entries(groupedByCity).map(([cityKey, cityItems], index) => {
        const cityName = getChinaCityName(cityItems[0]) || cityKey
        const provinceName = cityItems[0].province_name || (cityItems[0].name_zh?.split(' · ')[0] ?? '')
        const markerProvinceCode = getChinaProvinceCode(cityItems[0])
        const coordinates = getChinaCityCoordinate(markerProvinceCode, cityName)
          || getMarkerCoordinates(provinceCenters[provinceCode], index)

        return {
          id: `${provinceCode}-${cityKey}`,
          cityName,
          provinceName,
          checkins: cityItems,
          coordinates,
        }
      })
    })
  }, [chinaProvinceCheckins, mapMode, provinceCenters])

  return (
    <div className="map-container" onMouseMove={handleMouseMove}>
      <div className="map-controls">
        <button
          type="button"
          className="map-control-btn"
          onClick={mapMode === 'china' ? handleChinaRecenter : handleWorldRecenter}
          aria-label="地图居中"
        >
          <AimOutlined />
        </button>
        {!isMapFullscreen && (
          <>
            <button
              type="button"
              className="map-control-btn"
              onClick={() => (mapMode === 'china' ? handleChinaZoom(1) : handleWorldZoom(1))}
              aria-label="放大地图"
            >
              <PlusOutlined />
            </button>
            <button
              type="button"
              className="map-control-btn"
              onClick={() => (mapMode === 'china' ? handleChinaZoom(-1) : handleWorldZoom(-1))}
              aria-label="缩小地图"
            >
              <MinusOutlined />
            </button>
          </>
        )}
        <button
          type="button"
          className="map-control-btn"
          onClick={() => setMapFullscreen(!isMapFullscreen)}
          aria-label={isMapFullscreen ? '退出全屏' : '进入全屏'}
        >
          {isMapFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
        </button>
      </div>
      <ComposableMap
        key={mapMode}
        className={`composable-map ${mapMode === 'china' ? 'composable-map--china' : ''}`}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        projection={mapMode === 'china' ? 'geoMercator' : 'geoEqualEarth'}
        projectionConfig={
          mapMode === 'china'
            ? { center: [104, 38], scale: 580 }
            : { center: [0, 7], scale: 220 }
        }
      >
        <ZoomableGroup
          center={mapConfig.center}
          zoom={mapConfig.zoom}
          minZoom={mapConfig.minZoom}
          maxZoom={mapConfig.maxZoom}
          onMoveEnd={({ coordinates, zoom }) => {
            if (mapMode === 'china') {
              const nearestLevel = CHINA_ZOOM_LEVELS.reduce((best, value, index) => {
                const bestDistance = Math.abs(CHINA_ZOOM_LEVELS[best - 1] - zoom)
                const nextDistance = Math.abs(value - zoom)
                return nextDistance < bestDistance ? index + 1 : best
              }, 1)
              setChinaZoomLevel(nearestLevel)
              return
            }

            setWorldViewport({
              center: coordinates,
              zoom: Math.max(WORLD_MIN_ZOOM, Math.min(WORLD_MAX_ZOOM, zoom)),
            })
          }}
        >
          {geoData && (
            <Geographies geography={geoData}>
              {({ geographies }) =>
                geographies
                  .filter((geo) => isRenderableFeature(geo, mapMode))
                  .map((geo, index) => {
                    const code = getFeatureCode(geo, mapMode)
                    const isVisited = checkedCodes.has(code)
                    const isGroupedHovered = mapMode === 'world' && hoveredWorldCode === code
                    const visitCount = provinceVisitCounts[code] || 0
                    const fillColor = mapMode === 'china'
                      ? getProvinceFill(visitCount, maxProvinceCount)
                      : (isVisited ? CONTINENT_COLORS[worldFeatureMeta[code]?.continent || 'default'] : '#D1D5DB')
                    const hoverFillColor = mapMode === 'china'
                      ? (visitCount ? getProvinceFill(visitCount, Math.max(maxProvinceCount, 1)) : '#C7D0DB')
                      : (isVisited ? CONTINENT_COLORS[worldFeatureMeta[code]?.continent || 'default'] : '#C7D0DB')

                    return (
                      <Geography
                        key={geo.rsmKey || index}
                        geography={geo}
                        className={`map-geo ${isVisited ? 'map-geo--visited' : ''} ${isGroupedHovered ? 'map-geo--hovered' : ''}`}
                        onMouseEnter={() => handleMouseEnter(geo)}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => handleClick(geo)}
                        style={{
                          default: {
                            fill: isGroupedHovered ? hoverFillColor : fillColor,
                            stroke: '#ffffff',
                            strokeWidth: mapMode === 'china' ? 0.8 : (isGroupedHovered ? 0.6 : 0.5),
                            outline: 'none',
                          },
                          hover: {
                            fill: hoverFillColor,
                            stroke: '#ffffff',
                            strokeWidth: mapMode === 'china' ? 0.9 : 0.6,
                            outline: 'none',
                            cursor: 'pointer',
                          },
                          pressed: {
                            fill: mapMode === 'world' && isVisited
                              ? CONTINENT_COLORS[worldFeatureMeta[code]?.continent || 'default']
                              : (isVisited ? 'var(--map-visited)' : '#BCC5D2'),
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
                  if (tooltipRef.current) {
                    tooltipRef.current.style.left = `${evt.clientX + 14}px`
                    tooltipRef.current.style.top = `${evt.clientY - 10}px`
                  }
                }}
                onMouseLeave={handleMouseLeave}
                onClick={() => {
                  onCheckinRequest?.({
                    code: String(getChinaProvinceCode(marker.checkins[0]) || ''),
                    name: marker.provinceName,
                    nameEn: marker.provinceName,
                    mapMode: 'china',
                  })
                }}
              >
                <path d="M0 -4.5 C2 -4.5 3.6 -3 3.6 -1 C3.6 1.4 1 3.4 0 5.6 C-1 3.4 -3.6 1.4 -3.6 -1 C-3.6 -3 -2 -4.5 0 -4.5 Z" className="city-marker-pin" />
                <circle cx="0" cy="-1.2" r="1.45" className="city-marker-dot" />
              </g>
            </Marker>
          ))}
          {mapMode === 'world' && worldMarkers.map((marker) => (
            <Marker key={marker.code} coordinates={marker.coordinates}>
              <g
                className="city-marker world-country-marker"
                onMouseEnter={(evt) => {
                  setTooltipTitle(marker.title)
                  setTooltipSubtitle(marker.subtitle)
                  setTooltipCheckins(marker.checkins)
                  setTooltipCities([])
                  setTooltipVariant('world-country')
                  setShowTooltip(true)
                  if (tooltipRef.current) {
                    tooltipRef.current.style.left = `${evt.clientX + 14}px`
                    tooltipRef.current.style.top = `${evt.clientY - 10}px`
                  }
                }}
                onMouseLeave={handleMouseLeave}
                onClick={() => {
                  onCheckinRequest?.({
                    code: marker.code,
                    name: getWorldCountryNameZh(marker.code, marker.title) || marker.subtitle || marker.title,
                    nameEn: marker.title,
                    mapMode: 'world',
                  })
                }}
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
          ref={tooltipRef}
          className="map-tooltip"
        >
          {tooltipVariant === 'world-country' ? (
            tooltipCheckins.length > 0 ? (
              <div className="map-tooltip-sentence">
                {formatWorldTooltipLine(tooltipCheckins, tooltipTitle, tooltipSubtitle)}
              </div>
            ) : (
              <>
                <div className="map-tooltip-name">{tooltipTitle}</div>
                {tooltipSubtitle && <div className="map-tooltip-subtitle">{tooltipSubtitle}</div>}
                <div className="map-tooltip-hint">点击打卡</div>
              </>
            )
          ) : (
            <>
              <div className="map-tooltip-name">{tooltipTitle}</div>
              {tooltipSubtitle && <div className="map-tooltip-subtitle">{tooltipSubtitle}</div>}
            </>
          )}
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
