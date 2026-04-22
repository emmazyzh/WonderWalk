import { useState, useEffect, useMemo, useCallback } from 'react'
import dayjs from 'dayjs'
import { Modal, message, Spin, Empty, Button, Input, DatePicker, Popconfirm, Select, Tooltip } from 'antd'
import {
  AimOutlined,
  BulbOutlined,
  DeleteOutlined,
  EditOutlined,
  GlobalOutlined,
  MinusOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
import { geoCentroid, geoMercator } from 'd3-geo'
import ReactConfetti from 'react-confetti'
import { useAuth } from '@clerk/clerk-react'
import useCheckinStore from '../../store/useCheckinStore'
import { CHINA_PROVINCES } from '../../data/chinaCities'
import { WORLD_COUNTRIES_LIST, getWorldCountryByCode, getWorldCountryCodeByName, getWorldCountryNameZh } from '../../data/worldCountries'
import './CheckinModal.css'

const WORLD_GEO = '/data/world-110m.json'
const LOCAL_PROVINCE_GEO_BASE = '/data/china-provinces'
const REMOTE_PROVINCE_GEO_BASE = 'https://geo.datav.aliyun.com/areas_v3/bound'
const PROVINCE_MAP_WIDTH = 960
const PROVINCE_MAP_HEIGHT = 640
const PROVINCE_MAP_PADDING_LEFT = 0
const PROVINCE_MAP_PADDING_RIGHT = 0
const PROVINCE_MAP_PADDING_TOP = 0
const PROVINCE_MAP_PADDING_BOTTOM = 220
const CHINA_ZOOM_LEVELS = [0.85, 1, 1.2, 1.5, 1.8, 2.1]
const PROVINCE_MIN_ZOOM = CHINA_ZOOM_LEVELS[0]
const PROVINCE_MAX_ZOOM = CHINA_ZOOM_LEVELS[CHINA_ZOOM_LEVELS.length - 1]
const PROVINCE_DEFAULT_ZOOM = CHINA_ZOOM_LEVELS[1]
const WHOLE_PROVINCE_SELECTION_CODES = new Set(['110000', '120000', '310000', '500000', '710000', '810000', '820000'])
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
  352: 'ISL',
  356: 'IND',
  360: 'IDN',
  380: 'ITA',
  392: 'JPN',
  410: 'KOR',
  446: 'CHN',
  458: 'MYS',
  528: 'NLD',
  554: 'NZL',
  578: 'NOR',
  608: 'PHL',
  616: 'POL',
  620: 'PRT',
  643: 'RUS',
  702: 'SGP',
  704: 'VNM',
  710: 'ZAF',
  724: 'ESP',
  752: 'SWE',
  756: 'CHE',
  764: 'THA',
  784: 'ARE',
  792: 'TUR',
  818: 'EGY',
  826: 'GBR',
  840: 'USA',
}

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

function normalizeWorldSelection(item) {
  if (!item) return null
  const rawCode = String(item.code || '').toUpperCase()
  const numericCode = rawCode.replace(/^0+/, '')
  const code = (
    (rawCode === 'TWN' || rawCode === 'HKG' || rawCode === 'MAC' ? 'CHN' : '')
    || (/^[A-Z]{3}$/.test(rawCode) ? rawCode : '')
    || WORLD_NUMERIC_TO_ALPHA3[numericCode]
    || getWorldCountryCodeByName(item.nameEn || item.name_en || item.name || item.name_zh || '')
    || rawCode
  )
  const nameEn = item.nameEn || item.name_en || ''
  return {
    ...item,
    code,
    nameEn,
    name: item.name || item.name_zh || getWorldCountryNameZh(code, nameEn) || nameEn,
  }
}

function getNormalizedWorldCode(item) {
  if (!item) return ''
  return normalizeWorldSelection(item)?.code || ''
}

function mergeWorldCountryOptions(baseCountries, geoCountries) {
  const merged = new Map()

  baseCountries.forEach((item) => {
    const normalized = normalizeWorldSelection(item)
    if (!normalized.code) return
    merged.set(normalized.code, normalized)
  })

  geoCountries.forEach((item) => {
    const normalized = normalizeWorldSelection(item)
    if (!normalized.code) return

    const existing = merged.get(normalized.code)
    merged.set(normalized.code, existing
      ? {
        ...normalized,
        name: existing.name || normalized.name,
        nameEn: existing.nameEn || normalized.nameEn,
      }
      : normalized)
  })

  return [...merged.values()].sort((a, b) => a.nameEn.localeCompare(b.nameEn))
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
  if (name.endsWith('特别行政区')) return name.slice(0, -5)
  if (name.endsWith('自治区')) return name.slice(0, -3)
  if (name.endsWith('自治州')) return name.slice(0, -3)
  if (name.endsWith('自治县')) return name.slice(0, -3)
  if (name.endsWith('自治旗')) return name.slice(0, -3)
  if (name.endsWith('地区')) return name.slice(0, -2)
  if (name.endsWith('盟')) return name.slice(0, -1)
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

function getPolygonArea(ring) {
  let area = 0
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[i + 1]
    area += (x1 * y2) - (x2 * y1)
  }
  return Math.abs(area / 2)
}

function keepLargestPolygon(feature) {
  const geometry = feature.geometry
  if (!geometry || geometry.type !== 'MultiPolygon') return feature

  const [largestPolygon] = [...geometry.coordinates]
    .sort((a, b) => getPolygonArea(b[0]) - getPolygonArea(a[0]))

  return {
    ...feature,
    geometry: {
      ...geometry,
      type: 'Polygon',
      coordinates: largestPolygon,
    },
  }
}

function normalizeProvinceGeoData(data, provinceCode) {
  if (!data?.features) return data

  let features = data.features.map(normalizeChinaFeature)

  if (provinceCode === '460000') {
    features = features
      .filter((feature) => feature.properties?.name !== '三沙市')
      .map(keepLargestPolygon)
  }

  return {
    ...data,
    features,
  }
}

function getChinaProvinceCode(checkin) {
  if (checkin.province_code) return String(checkin.province_code)
  if (typeof checkin.code === 'string' && checkin.code.includes('-')) {
    return checkin.code.split('-')[0]
  }
  return checkin.code ? String(checkin.code) : ''
}

function getNearestZoomLevel(zoom) {
  return CHINA_ZOOM_LEVELS.reduce((best, value, index) => {
    const bestDistance = Math.abs(CHINA_ZOOM_LEVELS[best - 1] - zoom)
    const nextDistance = Math.abs(value - zoom)
    return nextDistance < bestDistance ? index + 1 : best
  }, 1)
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

function createWorldDraftEntry({ id = null, createdAt, status = 'new' }) {
  return {
    draftId: crypto.randomUUID(),
    sourceId: id,
    createdAt,
    originalCreatedAt: id ? createdAt : null,
    status,
  }
}

function createChinaDraftEntry({ id = null, createdAt, region, status = null }) {
  return {
    draftId: crypto.randomUUID(),
    sourceId: id,
    createdAt,
    originalCreatedAt: id ? createdAt : null,
    status: status || (id ? 'existing' : 'new'),
    code: String(region.code),
    cityName: region.shortName || region.displayName,
    displayName: region.displayName,
  }
}

function createWholeProvinceRegion(provinceCode, provinceName, geoData) {
  const displayName = provinceName || provinceCode
  const shortName = getRegionShortName(displayName)
  return {
    feature: geoData,
    code: String(provinceCode),
    displayName,
    shortName,
    centroid: geoData ? geoCentroid(geoData) : [104, 35],
  }
}

export default function CheckinModal({ open, onClose, prefill }) {
  const { addCheckin, removeCheckin, updateCheckinTime, mapMode, checkins } = useCheckinStore()
  const { getToken } = useAuth()
  const [showConfetti, setShowConfetti] = useState(false)
  const [isChinaSubmitting, setIsChinaSubmitting] = useState(false)
  const [selectedProvinceCode, setSelectedProvinceCode] = useState('')
  const [activeChinaCityCode, setActiveChinaCityCode] = useState('')
  const [hoveredChinaCityCode, setHoveredChinaCityCode] = useState('')
  const [chinaDraftsByProvince, setChinaDraftsByProvince] = useState({})
  const [activeChinaPicker, setActiveChinaPicker] = useState(null)
  const [worldQuery, setWorldQuery] = useState('')
  const [showWorldResults, setShowWorldResults] = useState(false)
  const [selectedWorld, setSelectedWorld] = useState(null)
  const [worldCountries, setWorldCountries] = useState(WORLD_COUNTRIES_LIST)
  const [worldDraftsByCode, setWorldDraftsByCode] = useState({})
  const [activeWorldPicker, setActiveWorldPicker] = useState(null)
  const [provinceGeoData, setProvinceGeoData] = useState(null)
  const [provinceGeoLoading, setProvinceGeoLoading] = useState(false)
  const [provinceGeoError, setProvinceGeoError] = useState('')
  const [provinceViewport, setProvinceViewport] = useState({ center: [104, 35], zoom: 1 })
  const searchData = useMemo(() => getSearchData(mapMode), [mapMode])
  const provinces = useMemo(() => searchData.provinces ?? [], [searchData])
  const allData = useMemo(
    () => (mapMode === 'world' ? worldCountries : (searchData.cities ?? [])),
    [mapMode, searchData, worldCountries]
  )
  const activeProvinceGeoData = provinceGeoData || provinceGeoCache[selectedProvinceCode] || null
  const worldCheckinsByCode = useMemo(() => (
    checkins.reduce((acc, item) => {
      if (item.type !== 'world_country') return acc
      const normalizedCode = getNormalizedWorldCode(item)
      if (!normalizedCode) return acc
      if (!acc[normalizedCode]) acc[normalizedCode] = []
      acc[normalizedCode].push(item)
      return acc
    }, {})
  ), [checkins])
  const checkedWorldCodes = useMemo(
    () => new Set(Object.keys(worldCheckinsByCode)),
    [worldCheckinsByCode]
  )

  const selectedProvince = useMemo(
    () => provinces.find((province) => province.code === selectedProvinceCode) || null,
    [provinces, selectedProvinceCode]
  )

  const selectedWorldCheckins = useMemo(
    () => (
      selectedWorld
        ? (worldCheckinsByCode[selectedWorld.code] || [])
          .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0))
        : []
    ),
    [selectedWorld, worldCheckinsByCode]
  )

  const currentWorldDrafts = useMemo(
    () => (selectedWorld ? (worldDraftsByCode[selectedWorld.code] || []) : []),
    [selectedWorld, worldDraftsByCode]
  )

  const currentChinaDrafts = useMemo(
    () => (selectedProvinceCode ? (chinaDraftsByProvince[selectedProvinceCode] || []) : []),
    [chinaDraftsByProvince, selectedProvinceCode]
  )

  useEffect(() => {
    if (!open || mapMode !== 'world') return

    fetch(WORLD_GEO)
      .then((res) => res.json())
      .then((data) => {
        const geometries = data.objects?.countries?.geometries || []
        const geoWorldCountries = geometries.map((item) => {
          const code = normalizeWorldSelection({
            code: String(item.id || ''),
            nameEn: item.properties?.name || '',
          })?.code || ''
          const nameEn = item.properties?.name || ''
          const preset = getWorldCountryByCode(code)
          return normalizeWorldSelection({
            code,
            nameEn: preset?.nameEn || nameEn,
            name: preset?.name || getWorldCountryNameZh(code, nameEn) || nameEn,
          })
        })
        setWorldCountries(mergeWorldCountryOptions(WORLD_COUNTRIES_LIST, geoWorldCountries))
      })
      .catch((error) => {
        console.warn('Failed to load world country options', error)
      })
  }, [open, mapMode])

  useEffect(() => {
    if (!open || mapMode !== 'china' || !selectedProvinceCode) return

    if (provinceGeoCache[selectedProvinceCode]) {
      return
    }

    const controller = new AbortController()

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
          return normalizeProvinceGeoData(data, selectedProvinceCode)
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

    const rawRegions = activeProvinceGeoData.features
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

    if (WHOLE_PROVINCE_SELECTION_CODES.has(String(selectedProvinceCode))) {
      return [createWholeProvinceRegion(selectedProvinceCode, selectedProvince?.name, activeProvinceGeoData)]
    }

    return rawRegions
  }, [activeProvinceGeoData, mapMode, selectedProvince?.name, selectedProvinceCode])

  const provinceSubdivisionRegions = useMemo(() => {
    if (
      mapMode !== 'china'
      || !activeProvinceGeoData?.features
      || !WHOLE_PROVINCE_SELECTION_CODES.has(String(selectedProvinceCode))
    ) {
      return []
    }

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

  const provinceLabelCoordinates = useMemo(() => {
    if (!provinceProjection?.invert) {
      return provinceRegions.reduce((acc, region) => {
        acc[region.code] = region.centroid
        return acc
      }, {})
    }

    const placed = []
    const coordinates = {}
    const sortedRegions = [...provinceRegions].sort((a, b) => {
      const aPoint = Array.isArray(a.centroid) ? provinceProjection(a.centroid) : null
      const bPoint = Array.isArray(b.centroid) ? provinceProjection(b.centroid) : null
      if (!aPoint || !bPoint) return 0
      return aPoint[1] - bPoint[1]
    })

    sortedRegions.forEach((region) => {
      if (!Array.isArray(region.centroid) || region.centroid.length !== 2) {
        coordinates[region.code] = region.centroid
        return
      }

      const projected = provinceProjection(region.centroid)
      if (!Array.isArray(projected) || projected.length !== 2) {
        coordinates[region.code] = region.centroid
        return
      }

      const labelWidth = Math.max(24, region.shortName.length * 13)
      const labelHeight = region.shortName.length >= 4 ? 14 : 16
      const candidateOffsets = [
        [0, 0],
        [0, -16],
        [0, 16],
        [-18, 0],
        [18, 0],
        [-22, -12],
        [22, -12],
        [-22, 12],
        [22, 12],
        [0, -28],
        [0, 28],
      ]

      let chosen = projected

      for (const [dx, dy] of candidateOffsets) {
        const candidate = [projected[0] + dx, projected[1] + dy]
        const overlaps = placed.some((entry) => (
          Math.abs(entry.x - candidate[0]) < ((entry.width + labelWidth) / 2) &&
          Math.abs(entry.y - candidate[1]) < ((entry.height + labelHeight) / 2)
        ))

        if (!overlaps) {
          chosen = candidate
          break
        }
      }

      coordinates[region.code] = provinceProjection.invert(chosen) || region.centroid
      placed.push({ x: chosen[0], y: chosen[1], width: labelWidth, height: labelHeight })
    })

    return coordinates
  }, [provinceProjection, provinceRegions])

  const initializeChinaDrafts = useCallback((provinceCode, regions = []) => {
    if (!provinceCode) return

    setChinaDraftsByProvince((current) => {
      if (current[provinceCode]) return current

      const isWholeProvinceSelection = WHOLE_PROVINCE_SELECTION_CODES.has(String(provinceCode))
      const wholeRegion = isWholeProvinceSelection
        ? createWholeProvinceRegion(provinceCode, provinces.find((province) => province.code === provinceCode)?.name, activeProvinceGeoData || provinceGeoCache[provinceCode] || null)
        : null
      const regionMap = new Map(regions.map((region) => [String(region.code), region]))
      const drafts = checkins
        .filter((item) => item.type === 'china_city' && getChinaProvinceCode(item) === provinceCode)
        .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0))
        .map((item) => {
          const region = wholeRegion
            || regionMap.get(String(item.code))
            || regions.find((entry) => normalizeRegionName(entry.shortName) === normalizeRegionName(item.city_name || ''))
            || {
            code: wholeRegion?.code || item.code,
            shortName: wholeRegion?.shortName || item.city_name || item.name_en,
            displayName: wholeRegion?.displayName || item.city_name || item.name_zh?.split(' · ').at(-1) || item.name_en || String(item.code),
          }
          return createChinaDraftEntry({
            id: item.id,
            createdAt: Number(item.created_at),
            region,
          })
        })

      return {
        ...current,
        [provinceCode]: drafts,
      }
    })
  }, [activeProvinceGeoData, checkins, provinces])

  useEffect(() => {
    if (mapMode !== 'china' || !open) return
    if (selectedProvinceCode) return
    const initialProvinceCode = String(prefill?.code || provinces[0]?.code || '')
    if (initialProvinceCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedProvinceCode(initialProvinceCode)
    }
  }, [mapMode, open, prefill, provinces, selectedProvinceCode])

  useEffect(() => {
    if (mapMode !== 'china' || !selectedProvinceCode) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    initializeChinaDrafts(selectedProvinceCode, provinceRegions)
  }, [initializeChinaDrafts, mapMode, provinceRegions, selectedProvinceCode])

  const checkedChinaRegionLookup = useMemo(() => {
    const anyByCode = new Set()
    const anyByName = new Set()

    checkins
      .filter((item) => item.type === 'china_city' && getChinaProvinceCode(item) === selectedProvinceCode)
      .forEach((item) => {
        const itemCode = String(item.code || '')

        if (itemCode) anyByCode.add(itemCode)

        const names = [
          item.city_name,
          item.name_zh?.includes(' · ') ? item.name_zh.split(' · ').at(-1) : item.name_zh,
          item.name_en,
        ].filter(Boolean)

        names.forEach((name) => {
          const normalizedName = normalizeRegionName(name)
          const normalizedShortName = normalizeRegionName(getRegionShortName(name))
          anyByName.add(normalizedName)
          anyByName.add(normalizedShortName)
        })
      })

    return { anyByCode, anyByName }
  }, [checkins, selectedProvinceCode])

  const deletedChinaRegionLookup = useMemo(() => {
    const anyByCode = new Set()
    const anyByName = new Set()

    currentChinaDrafts
      .filter((draft) => draft.status === 'deleted')
      .forEach((draft) => {
        if (draft.code) anyByCode.add(String(draft.code))

        const names = [
          draft.cityName,
          draft.displayName,
        ].filter(Boolean)

        names.forEach((name) => {
          const normalizedName = normalizeRegionName(name)
          const normalizedShortName = normalizeRegionName(getRegionShortName(name))
          anyByName.add(normalizedName)
          anyByName.add(normalizedShortName)
        })
      })

    return { anyByCode, anyByName }
  }, [currentChinaDrafts])

  const isChinaRegionHovered = (regionCode) => (
    hoveredChinaCityCode === String(regionCode)
  )

  const getChinaRegionDraftState = (region) => {
    const regionCode = String(region.code)
    const regionDrafts = currentChinaDrafts.filter((draft) => draft.code === regionCode && draft.status !== 'deleted')
    const isDeletedRegion = deletedChinaRegionLookup.anyByCode.has(regionCode)
      || deletedChinaRegionLookup.anyByName.has(normalizeRegionName(region.displayName))
      || deletedChinaRegionLookup.anyByName.has(normalizeRegionName(region.shortName))
    if (regionDrafts.some((draft) => draft.status === 'new')) return 'new'
    if (regionDrafts.length > 0) return 'existing'
    if (isDeletedRegion) return 'empty'
    if (checkedChinaRegionLookup.anyByCode.has(regionCode)) return 'existing'
    if (
      checkedChinaRegionLookup.anyByName.has(normalizeRegionName(region.displayName)) ||
      checkedChinaRegionLookup.anyByName.has(normalizeRegionName(region.shortName))
    ) {
      return 'existing'
    }
    return 'empty'
  }

  const isChinaRegionSelected = (region) => (
    activeChinaCityCode === String(region.code) && getChinaRegionDraftState(region) !== 'empty'
  )

  const updateCurrentChinaDrafts = (updater) => {
    if (!selectedProvinceCode) return
    setChinaDraftsByProvince((current) => ({
      ...current,
      [selectedProvinceCode]: updater(current[selectedProvinceCode] || []),
    }))
  }

  const trackChinaVisibleDraft = (draftEntry) => {
    if (!draftEntry) return draftEntry

    updateCurrentChinaDrafts((drafts) => {
      if (drafts.some((draft) => draft.draftId === draftEntry.draftId || (draftEntry.sourceId && draft.sourceId === draftEntry.sourceId))) {
        return drafts
      }
      return [...drafts, draftEntry]
    })

    return draftEntry
  }

  const handleChinaDraftAdd = (region = null) => {
    const targetRegion = region
      || provinceRegions.find((entry) => String(entry.code) === activeChinaCityCode)
      || provinceRegions[0]

    if (!targetRegion) return

    const isWholeProvinceSelection = WHOLE_PROVINCE_SELECTION_CODES.has(String(selectedProvinceCode))
    setActiveChinaCityCode(String(targetRegion.code))
    updateCurrentChinaDrafts((drafts) => {
      if (isWholeProvinceSelection && drafts.some((draft) => draft.status !== 'deleted')) {
        return drafts
      }

      return [
        ...drafts,
        createChinaDraftEntry({
          createdAt: dayjs().startOf('month').valueOf(),
          region: targetRegion,
        }),
      ]
    })
  }

  const handleChinaDraftDelete = (draftId) => {
    const targetDraft = currentChinaDrafts.find((draft) => draft.draftId === draftId) || null
    const hasRemainingActiveDraftsForRegion = targetDraft
      ? currentChinaDrafts.some(
        (draft) => draft.draftId !== draftId && draft.code === targetDraft.code && draft.status !== 'deleted'
      )
      : false

    updateCurrentChinaDrafts((drafts) => drafts.flatMap((draft) => {
      if (draft.draftId !== draftId) return [draft]
      if (!draft.sourceId) return []
      return [{
        ...draft,
        status: 'deleted',
      }]
    }))
    setActiveChinaPicker((current) => (current?.draftId === draftId ? null : current))
    if (targetDraft && !hasRemainingActiveDraftsForRegion) {
      setActiveChinaCityCode((current) => (current === targetDraft.code ? '' : current))
      setHoveredChinaCityCode((current) => (current === targetDraft.code ? '' : current))
    }
  }

  const handleChinaDraftMonthChange = (draftId, value) => {
    if (!value) return
    const nextCreatedAt = value.startOf('month').valueOf()
    updateCurrentChinaDrafts((drafts) => drafts.map((draft) => {
      if (draft.draftId !== draftId) return draft
      return {
        ...draft,
        createdAt: nextCreatedAt,
        status: draft.sourceId
          ? (draft.originalCreatedAt === nextCreatedAt ? 'existing' : 'modified')
          : 'new',
      }
    }))
    setActiveChinaPicker(null)
  }

  const hasChinaDraftChanges = useMemo(() => {
    if (!selectedProvinceCode) return false

    const provinceCheckins = checkins.filter(
      (item) => item.type === 'china_city' && getChinaProvinceCode(item) === selectedProvinceCode
    )
    const activeChinaDrafts = currentChinaDrafts.filter((draft) => draft.status !== 'deleted')
    const draftSourceIds = new Set(activeChinaDrafts.filter((draft) => draft.sourceId).map((draft) => draft.sourceId))

    if (currentChinaDrafts.some((draft) => !draft.sourceId || draft.status === 'modified' || draft.status === 'deleted')) {
      return true
    }

    return provinceCheckins.some((item) => !draftSourceIds.has(item.id))
  }, [checkins, currentChinaDrafts, selectedProvinceCode])

  const currentChinaVisibleDrafts = useMemo(() => {
    if (!selectedProvinceCode) return []

    const isWholeProvinceSelection = WHOLE_PROVINCE_SELECTION_CODES.has(String(selectedProvinceCode))
    const wholeRegion = isWholeProvinceSelection
      ? createWholeProvinceRegion(selectedProvinceCode, selectedProvince?.name, activeProvinceGeoData || provinceGeoCache[selectedProvinceCode] || null)
      : null
    const deletedSourceIds = new Set(
      currentChinaDrafts
        .filter((draft) => draft.sourceId && draft.status === 'deleted')
        .map((draft) => draft.sourceId)
    )
    const existingById = new Set(
      currentChinaDrafts
        .filter((draft) => draft.sourceId && draft.status !== 'deleted')
        .map((draft) => draft.sourceId)
    )
    const regionMap = new Map(provinceRegions.map((region) => [String(region.code), region]))
    const fallbackDrafts = checkins
      .filter((item) => item.type === 'china_city' && getChinaProvinceCode(item) === selectedProvinceCode)
      .filter((item) => !deletedSourceIds.has(item.id))
      .filter((item) => !existingById.has(item.id))
      .map((item) => {
        const region = wholeRegion
          || regionMap.get(String(item.code))
          || provinceRegions.find((entry) => normalizeRegionName(entry.shortName) === normalizeRegionName(item.city_name || ''))
          || {
          code: wholeRegion?.code || item.code,
          shortName: wholeRegion?.shortName || item.city_name || item.name_en,
          displayName: wholeRegion?.displayName || item.city_name || item.name_zh?.split(' · ').at(-1) || item.name_en || String(item.code),
        }

        return createChinaDraftEntry({
          id: item.id,
          createdAt: Number(item.created_at),
          region,
        })
      })
    const allDrafts = [...currentChinaDrafts.filter((draft) => draft.status !== 'deleted'), ...fallbackDrafts]
    const priority = {
      new: 0,
      modified: 1,
      existing: 2,
    }

    const sortedDrafts = allDrafts.sort((a, b) => {
      const priorityDiff = (priority[a.status] ?? 99) - (priority[b.status] ?? 99)
      if (priorityDiff !== 0) return priorityDiff
      return Number(b.createdAt || 0) - Number(a.createdAt || 0)
    })

    if (isChinaSubmitting) {
      const localDrafts = [...currentChinaDrafts]
        .filter((draft) => draft.status !== 'deleted')
        .sort((a, b) => {
          const priorityDiff = (priority[a.status] ?? 99) - (priority[b.status] ?? 99)
          if (priorityDiff !== 0) return priorityDiff
          return Number(b.createdAt || 0) - Number(a.createdAt || 0)
        })
      return localDrafts
    }

    return sortedDrafts
  }, [activeProvinceGeoData, checkins, currentChinaDrafts, isChinaSubmitting, provinceRegions, selectedProvince?.name, selectedProvinceCode])

  const worldResults = useMemo(() => {
    if (mapMode !== 'world') return []
    const q = worldQuery.trim().toLowerCase()
    if (!q) return []
    return allData.filter((item) =>
      item.name.toLowerCase().includes(q) ||
      item.nameEn.toLowerCase().includes(q)
    ).slice(0, 80)
  }, [allData, mapMode, worldQuery])

  const hasWorldDraftChanges = useMemo(() => {
    if (!selectedWorld) return false

    const drafts = currentWorldDrafts
    const draftSourceIds = new Set(drafts.filter((draft) => draft.sourceId).map((draft) => draft.sourceId))

    if (drafts.some((draft) => !draft.sourceId || draft.status === 'modified')) {
      return true
    }

    return selectedWorldCheckins.some((item) => !draftSourceIds.has(item.id))
  }, [currentWorldDrafts, selectedWorld, selectedWorldCheckins])

  const selectWorldCountry = useCallback((item) => {
    const normalizedItem = normalizeWorldSelection(item)
    const nextDrafts = (worldCheckinsByCode[normalizedItem.code] || [])
      .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0))
      .map((entry) => createWorldDraftEntry({
        id: entry.id,
        createdAt: Number(entry.created_at),
        status: 'existing',
      }))

    setSelectedWorld(normalizedItem)
    setActiveWorldPicker(null)
    setWorldDraftsByCode((current) => {
      if (current[normalizedItem.code]) return current
      return {
        ...current,
        [normalizedItem.code]: nextDrafts.length > 0
          ? nextDrafts
          : [createWorldDraftEntry({ createdAt: dayjs().startOf('month').valueOf(), status: 'new' })],
      }
    })
  }, [worldCheckinsByCode])

  const updateSelectedWorldDrafts = (updater) => {
    if (!selectedWorld) return
    setWorldDraftsByCode((current) => ({
      ...current,
      [selectedWorld.code]: updater(current[selectedWorld.code] || []),
    }))
  }

  const handleWorldDraftMonthChange = (draftId, value) => {
    if (!value) return
    const nextCreatedAt = value.startOf('month').valueOf()
    updateSelectedWorldDrafts((drafts) => drafts.map((draft) => {
      if (draft.draftId !== draftId) return draft
      return {
        ...draft,
        createdAt: nextCreatedAt,
        status: draft.sourceId
          ? (draft.originalCreatedAt === nextCreatedAt ? 'existing' : 'modified')
          : 'new',
      }
    }))
    setActiveWorldPicker(null)
  }

  const handleWorldDraftAdd = () => {
    updateSelectedWorldDrafts((drafts) => [
      ...drafts,
      createWorldDraftEntry({ createdAt: dayjs().startOf('month').valueOf(), status: 'new' }),
    ])
  }

  const handleWorldDraftDelete = (draftId) => {
    updateSelectedWorldDrafts((drafts) => drafts.filter((draft) => draft.draftId !== draftId))
    setActiveWorldPicker((current) => (current?.draftId === draftId ? null : current))
  }

  useEffect(() => {
    if (!open || mapMode !== 'world') return
    if (worldResults.length === 1) {
      if (selectedWorld?.code === worldResults[0].code) {
        return
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      selectWorldCountry(worldResults[0])
      return
    }

    if (selectedWorld && worldResults.some((item) => item.code === selectedWorld.code)) {
      return
    }

    if (prefill?.code) {
      const matchedPrefill = worldResults.find((item) => item.code === prefill.code)
      if (matchedPrefill) {
        selectWorldCountry(matchedPrefill)
      }
    }
  }, [mapMode, open, prefill, selectedWorld, selectWorldCountry, worldResults])

  const handleChinaRegionToggle = (region) => {
    const regionCode = String(region.code)
    const regionState = getChinaRegionDraftState(region)
    const visibleRegionDrafts = currentChinaDrafts.filter(
      (draft) => draft.code === regionCode && draft.status !== 'deleted'
    )

    if (activeChinaCityCode === regionCode) {
      const hasOnlyNewDrafts = visibleRegionDrafts.length > 0 && visibleRegionDrafts.every((draft) => !draft.sourceId)
      if (hasOnlyNewDrafts) {
        updateCurrentChinaDrafts((drafts) => drafts.filter((draft) => !(draft.code === regionCode && !draft.sourceId)))
      }
      setActiveChinaCityCode('')
      return
    }

    setActiveChinaCityCode(String(region.code))
    if (regionState === 'existing') {
      updateCurrentChinaDrafts((drafts) => {
        if (drafts.some((draft) => draft.code === regionCode && !draft.sourceId && draft.status !== 'deleted')) {
          return drafts
        }

        return [
          ...drafts,
          createChinaDraftEntry({
            createdAt: dayjs().startOf('month').valueOf(),
            region,
            status: 'new',
          }),
        ]
      })
      setActiveChinaPicker(null)
      return
    }

    if (regionState === 'empty') {
      handleChinaDraftAdd(region)
    }
  }

  const handleProvinceZoom = (direction) => {
    setProvinceViewport((viewport) => {
      const currentLevel = getNearestZoomLevel(viewport.zoom)
      const nextLevel = Math.max(1, Math.min(CHINA_ZOOM_LEVELS.length, currentLevel + direction))
      return {
        ...viewport,
        zoom: CHINA_ZOOM_LEVELS[nextLevel - 1],
      }
    })
  }

  const handleProvinceRecenter = () => {
    if (!activeProvinceGeoData) return
    setProvinceViewport(getDefaultProvinceViewport(activeProvinceGeoData, selectedProvince))
  }

  const handleChinaBatchCheckin = async () => {
    if (!selectedProvinceCode || !hasChinaDraftChanges) {
      message.info('没有需要提交的变更')
      return
    }

    const activeVisibleDrafts = currentChinaVisibleDrafts.filter((draft) => draft.status !== 'deleted')
    setIsChinaSubmitting(true)

    try {
      const provinceName = getProvinceDisplayName(null, selectedProvince, prefill)
      const provinceCheckins = checkins.filter(
        (item) => item.type === 'china_city' && getChinaProvinceCode(item) === selectedProvinceCode
      )
      const existingDraftIds = new Set(
        activeVisibleDrafts.filter((draft) => draft.sourceId).map((draft) => draft.sourceId)
      )

      for (const checkin of provinceCheckins) {
        if (!existingDraftIds.has(checkin.id)) {
          await removeCheckin(checkin.id, getToken)
        }
      }

      for (const draft of activeVisibleDrafts.filter((entry) => entry.sourceId)) {
        if (draft.originalCreatedAt !== draft.createdAt) {
          await updateCheckinTime(draft.sourceId, draft.createdAt, getToken)
        }
      }

      for (const draft of activeVisibleDrafts.filter((entry) => !entry.sourceId)) {
        await addCheckin(
          {
            type: 'china_city',
            code: String(draft.code),
            province_code: selectedProvinceCode,
            province_name: provinceName,
            city_name: draft.cityName,
            name_zh: `${provinceName} · ${draft.displayName}`,
            name_en: draft.cityName,
            created_at: draft.createdAt,
          },
          getToken
        )
      }

      setShowConfetti(true)
      message.success({
        content: `🎉 已提交 ${provinceName}`,
        icon: '🚩',
      })
      setTimeout(() => {
        setShowConfetti(false)
        onClose()
      }, 1600)
    } catch (error) {
      console.error('Failed to submit china checkins', error)
      setIsChinaSubmitting(false)
      message.error('提交失败，请稍后重试')
    }
  }

  const handleWorldConfirm = async () => {
    if (!selectedWorld) return
    if (!hasWorldDraftChanges) {
      message.info('没有需要提交的变更')
      return
    }

    const existingDraftIds = new Set(
      currentWorldDrafts.filter((draft) => draft.sourceId).map((draft) => draft.sourceId)
    )

    for (const checkin of selectedWorldCheckins) {
      if (!existingDraftIds.has(checkin.id)) {
        await removeCheckin(checkin.id, getToken)
      }
    }

    for (const draft of currentWorldDrafts.filter((entry) => entry.sourceId)) {
      if (draft.originalCreatedAt !== draft.createdAt) {
        await updateCheckinTime(draft.sourceId, draft.createdAt, getToken)
      }
    }

    for (const draft of currentWorldDrafts.filter((entry) => !entry.sourceId)) {
      await addCheckin(
        {
          type: 'world_country',
          code: selectedWorld.code,
          name_zh: selectedWorld.name,
          name_en: selectedWorld.nameEn || selectedWorld.name,
          created_at: draft.createdAt,
        },
        getToken
      )
    }

    setShowConfetti(true)
    message.success({
      content: `🚩 已提交 ${selectedWorld.name}`,
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
      width={mapMode === 'china' ? 1140 : 720}
      classNames={{ content: `checkin-modal-content ${mapMode === 'world' ? 'checkin-modal-content--world' : ''}`.trim() }}
      styles={{
        mask: { background: 'rgba(15, 23, 42, 0.45)' },
        content: { padding: 0, overflow: 'hidden' },
        body: { padding: 0 },
      }}
      closable={!showConfetti}
      transitionName="ant-fade"
      maskTransitionName="ant-fade"
      afterOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setIsChinaSubmitting(false)
          setSelectedProvinceCode('')
          setActiveChinaCityCode('')
          setHoveredChinaCityCode('')
          setChinaDraftsByProvince({})
          setActiveChinaPicker(null)
          setWorldQuery('')
          setShowWorldResults(false)
          setSelectedWorld(null)
          setWorldDraftsByCode({})
          setActiveWorldPicker(null)
          setProvinceGeoData(null)
          setProvinceGeoLoading(false)
          setProvinceGeoError('')
          return
        }

        setIsChinaSubmitting(false)
        setSelectedProvinceCode(String(prefill?.code || provinces[0]?.code || ''))
        setActiveChinaCityCode('')
        setHoveredChinaCityCode('')
        setChinaDraftsByProvince({})
        setActiveChinaPicker(null)
        setWorldQuery('')
        setShowWorldResults(false)
        setWorldDraftsByCode({})
        setActiveWorldPicker(null)
        setProvinceGeoData(provinceGeoCache[selectedProvinceCode] || null)
        setProvinceGeoLoading(false)
        setProvinceGeoError('')
        if (provinceGeoCache[selectedProvinceCode]) {
          setProvinceViewport(getDefaultProvinceViewport(provinceGeoCache[selectedProvinceCode], selectedProvince))
        }
        if (mapMode === 'world') {
          const initialWorld = normalizeWorldSelection(getWorldCountryByCode(prefill?.code) || prefill || null)
          if (initialWorld) {
            selectWorldCountry(initialWorld)
          } else {
            setSelectedWorld(null)
          }
        }
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
        <div className="checkin-modal-header checkin-modal-header--world">
          <div className="checkin-modal-icon checkin-modal-icon--world">
            <GlobalOutlined />
          </div>
          <div className="checkin-modal-copy">
            <h2 className="checkin-modal-title">点亮去过的国家</h2>
          </div>
        </div>
      )}

      <div className={`checkin-results ${mapMode === 'china' ? 'checkin-results--china' : 'checkin-results--world'}`}>
        {mapMode === 'china' && (
          <>
            <div className="china-mode-shell">
              <div className="china-mode-toolbar">
                <Select
                  value={selectedProvinceCode || undefined}
                  showSearch
                  optionFilterProp="label"
                  filterOption={(input, option) => (
                    String(option?.label || '').toLowerCase().includes(input.trim().toLowerCase())
                  )}
                  onChange={(value) => {
                    setSelectedProvinceCode(value)
                    setActiveChinaCityCode('')
                    setHoveredChinaCityCode('')
                    setActiveChinaPicker(null)
                  }}
                  options={provinces.map((province) => ({ value: province.code, label: province.name }))}
                  className="province-inline-select"
                />
              </div>

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
                        setProvinceViewport({ center: coordinates, zoom: CHINA_ZOOM_LEVELS[getNearestZoomLevel(zoom) - 1] })
                      }}
                    >
                      <Geographies geography={activeProvinceGeoData}>
                        {({ geographies }) => geographies.map((geo) => {
                          const region = WHOLE_PROVINCE_SELECTION_CODES.has(String(selectedProvinceCode))
                            ? provinceRegions[0]
                            : (
                              provinceRegions.find((item) => item.code === (geo.properties?.adcode?.toString() || ''))
                              || provinceRegions.find((item) => item.displayName === getRegionDisplayName(geo))
                            )

                          if (!region) return null

                          const regionState = getChinaRegionDraftState(region)
                          const selected = isChinaRegionSelected(region)
                          const hovered = isChinaRegionHovered(region.code)
                          const fill = regionState === 'new' ? '#FBCFE8' : (regionState === 'existing' ? '#BFDBFE' : '#FFFFFF')
                          const hoverFill = regionState === 'new' ? '#F9A8D4' : (regionState === 'existing' ? '#93C5FD' : '#EFF6FF')
                          const stroke = selected
                            ? '#EC4899'
                            : (hovered ? '#2563EB' : (regionState === 'empty' ? '#CBD5E1' : '#60A5FA'))
                          const hoverStroke = selected ? '#DB2777' : (regionState === 'empty' ? '#93C5FD' : '#3B82F6')

                          return (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              onClick={() => handleChinaRegionToggle(region)}
                              onMouseEnter={() => setHoveredChinaCityCode(region.code)}
                              onMouseLeave={() => setHoveredChinaCityCode((current) => (current === region.code ? '' : current))}
                              className={`province-detail-geo ${regionState !== 'empty' ? 'province-detail-geo--checked' : ''} ${selected ? 'province-detail-geo--selected' : ''} ${hovered ? 'province-detail-geo--hovered' : ''}`}
                              style={{
                                default: {
                                  fill: hovered ? hoverFill : fill,
                                  stroke: hovered ? hoverStroke : stroke,
                                  strokeWidth: selected ? 1.8 : (hovered ? 1.5 : 1.2),
                                  outline: 'none',
                                  cursor: 'pointer',
                                },
                                hover: {
                                  fill: hoverFill,
                                  stroke: hoverStroke,
                                  strokeWidth: selected ? 2.1 : 1.5,
                                  outline: 'none',
                                  cursor: 'pointer',
                                },
                                pressed: {
                                  fill: regionState === 'new' ? '#F9A8D4' : (regionState === 'existing' ? '#93C5FD' : '#F9A8D4'),
                                  stroke: selected ? '#DB2777' : (regionState === 'empty' ? '#DB2777' : '#3B82F6'),
                                  strokeWidth: 2.1,
                                  outline: 'none',
                                },
                              }}
                            />
                          )
                        })}
                      </Geographies>

                      {WHOLE_PROVINCE_SELECTION_CODES.has(String(selectedProvinceCode)) && provinceSubdivisionRegions.map((region) => (
                        <Marker key={`sub-label-${region.code}`} coordinates={provinceLabelCoordinates[region.code] || region.centroid}>
                          <g
                            className="province-detail-label-group province-detail-label-group--subtle"
                            transform={`scale(${1 / provinceViewport.zoom})`}
                          >
                            <text
                              textAnchor="middle"
                              className={`province-detail-label province-detail-label--subtle ${region.shortName.length >= 4 ? 'province-detail-label--compact' : ''}`}
                            >
                              {region.shortName}
                            </text>
                          </g>
                        </Marker>
                      ))}

                      {provinceRegions.map((region) => {
                        const regionState = getChinaRegionDraftState(region)
                        const selected = isChinaRegionSelected(region)
                        const hovered = isChinaRegionHovered(region.code)
                        return (
                          <Marker key={`label-${region.code}`} coordinates={provinceLabelCoordinates[region.code] || region.centroid}>
                            <g
                              className="province-detail-label-group"
                              onClick={() => handleChinaRegionToggle(region)}
                              onMouseEnter={() => setHoveredChinaCityCode(region.code)}
                              onMouseLeave={() => setHoveredChinaCityCode((current) => (current === region.code ? '' : current))}
                              transform={`scale(${1 / provinceViewport.zoom})`}
                            >
                              <text
                                textAnchor="middle"
                                className={`province-detail-label ${region.shortName.length >= 4 ? 'province-detail-label--compact' : ''} ${regionState !== 'empty' ? 'province-detail-label--checked' : ''} ${selected ? 'province-detail-label--selected' : ''} ${hovered ? 'province-detail-label--hovered' : ''}`}
                              >
                                {region.shortName}
                              </text>
                            </g>
                          </Marker>
                        )
                      })}
                    </ZoomableGroup>
                  </ComposableMap>
                )}
                <div className="china-map-legend">
                  <span className="china-map-legend-item">
                    <i className="china-map-legend-dot china-map-legend-dot--blue" />
                    <span>蓝色：已打卡</span>
                  </span>
                  <span className="china-map-legend-item">
                    <i className="china-map-legend-dot china-map-legend-dot--pink" />
                    <span>粉色：新打卡</span>
                  </span>
                </div>
                <div className="china-map-overlay">
                  <div className="china-history-list china-history-list--overlay">
                    {currentChinaVisibleDrafts.length === 0 ? (
                      <div className="china-city-tag-hint china-city-tag-hint--overlay">
                        <BulbOutlined />
                        <span>选择一个城市点亮它吧</span>
                      </div>
                    ) : (
                      currentChinaVisibleDrafts.map((draft) => (
                        <div
                          key={draft.draftId}
                          className={`world-history-item china-history-item ${activeChinaCityCode === draft.code && (draft.status === 'new' || draft.status === 'modified') ? 'china-history-item--active' : ''}`}
                          onClick={() => setActiveChinaCityCode(draft.code)}
                        >
                          <div className="world-history-main china-history-main">
                            <div className="china-history-row">
                              <div className="china-history-city">{draft.displayName}</div>
                              {activeChinaPicker?.draftId === draft.draftId ? (
                                <DatePicker
                                  picker="month"
                                  needConfirm
                                  open
                                  allowClear={false}
                                  value={dayjs(activeChinaPicker.value ?? draft.createdAt)}
                                  onPanelChange={(value) => {
                                    setActiveChinaPicker((current) => (
                                      current?.draftId === draft.draftId
                                        ? { ...current, value: value?.valueOf() ?? null }
                                        : current
                                    ))
                                  }}
                                  onChange={(value) => {
                                    setActiveChinaPicker((current) => (
                                      current?.draftId === draft.draftId
                                        ? { ...current, value: value?.valueOf() ?? null }
                                        : current
                                    ))
                                  }}
                                  onOk={(value) => {
                                    const nextValue = value?.valueOf?.() ?? activeChinaPicker?.value ?? null
                                    if (nextValue == null) return
                                    handleChinaDraftMonthChange(draft.draftId, dayjs(nextValue))
                                  }}
                                  onOpenChange={(visible) => {
                                    if (!visible) setActiveChinaPicker(null)
                                  }}
                                  className="world-history-picker"
                                />
                              ) : (
                                <div className="world-history-date">{dayjs(draft.createdAt).format('YYYY年M月')}</div>
                              )}
                            </div>
                            <div className="china-history-meta">
                              <span className={`world-history-badge world-history-badge--${draft.status} china-history-badge china-history-badge--${draft.status}`}>
                                {draft.status === 'existing' ? '已打卡' : draft.status === 'modified' ? '修改' : '新打卡'}
                              </span>
                            </div>
                          </div>
                          <div className="world-history-actions">
                            <button
                              type="button"
                              className="world-history-icon-btn"
                              onClick={(event) => {
                                event.stopPropagation()
                                const trackedDraft = trackChinaVisibleDraft(draft)
                                setActiveChinaPicker({ draftId: trackedDraft.draftId, value: trackedDraft.createdAt })
                              }}
                              aria-label="修改打卡记录"
                            >
                              <EditOutlined />
                            </button>
                            <Popconfirm
                              title="删除这条打卡记录？"
                              okText="删除"
                              cancelText="取消"
                              onConfirm={() => {
                                const trackedDraft = trackChinaVisibleDraft(draft)
                                handleChinaDraftDelete(trackedDraft.draftId)
                              }}
                            >
                              <button
                                type="button"
                                className="world-history-icon-btn world-history-icon-btn--danger"
                                aria-label="删除打卡记录"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <DeleteOutlined />
                              </button>
                            </Popconfirm>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="china-overlay-copy checkin-footer-copy checkin-footer-copy--china">
                    点击城市新增打卡
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {mapMode === 'china' && (
          <div className="checkin-modal-footer checkin-modal-footer--china-root">
            <Button
              type="primary"
              size="large"
              className="checkin-confirm-btn checkin-confirm-btn--china-floating"
              onClick={handleChinaBatchCheckin}
              disabled={!hasChinaDraftChanges || isChinaSubmitting}
              loading={isChinaSubmitting}
            >
              提交打卡
            </Button>
          </div>
        )}

        {mapMode === 'world' && (
          <>
            <div className="world-search-wrap">
              <Input
                value={worldQuery}
                onChange={(e) => {
                  setWorldQuery(e.target.value)
                  setSelectedWorld(null)
                  setActiveWorldPicker(null)
                  setShowWorldResults(true)
                }}
                onFocus={() => setShowWorldResults(true)}
                onClick={() => setShowWorldResults(true)}
                prefix={<SearchOutlined />}
                placeholder="搜索国家名称"
                className="world-search-input"
                allowClear
              />
            </div>

            {selectedWorld && (
              <div className="selected-world-panel">
                <div className="selected-world-label">点亮</div>
                <div className="selected-world-title">{selectedWorld.nameEn}</div>
                <div className="selected-world-subtitle">{selectedWorld.name}</div>
                <div className="selected-world-history-title">打卡记录</div>

                {currentWorldDrafts.length > 0 && (
                  <div className="world-history-list">
                    {currentWorldDrafts.map((draft) => (
                      <div key={draft.draftId} className="world-history-item">
                        <div className="world-history-main">
                          {activeWorldPicker?.draftId === draft.draftId ? (
                            <DatePicker
                              picker="month"
                              needConfirm
                              open
                              allowClear={false}
                              value={dayjs(activeWorldPicker.value ?? draft.createdAt)}
                              onPanelChange={(value) => {
                                setActiveWorldPicker((current) => (
                                  current?.draftId === draft.draftId
                                    ? { ...current, value: value?.valueOf() ?? null }
                                    : current
                                ))
                              }}
                              onChange={(value) => {
                                setActiveWorldPicker((current) => (
                                  current?.draftId === draft.draftId
                                    ? { ...current, value: value?.valueOf() ?? null }
                                    : current
                                ))
                              }}
                              onOk={(value) => {
                                const nextValue = value?.valueOf?.() ?? activeWorldPicker?.value ?? null
                                if (nextValue == null) return
                                handleWorldDraftMonthChange(draft.draftId, dayjs(nextValue))
                              }}
                              onOpenChange={(visible) => {
                                if (!visible) setActiveWorldPicker(null)
                              }}
                              className="world-history-picker"
                            />
                          ) : (
                            <span className="world-history-date">{dayjs(draft.createdAt).format('YYYY年M月')}</span>
                          )}
                          <span className={`world-history-badge world-history-badge--${draft.status}`}>
                            {draft.status === 'existing' ? '已打卡' : draft.status === 'modified' ? '修改' : '新打卡'}
                          </span>
                        </div>
                        <div className="world-history-actions">
                          <button
                            type="button"
                            className="world-history-icon-btn"
                            onClick={() => setActiveWorldPicker({ draftId: draft.draftId, value: draft.createdAt })}
                            aria-label="修改打卡记录"
                          >
                            <EditOutlined />
                          </button>
                          <Popconfirm
                            title="删除这条打卡记录？"
                            okText="删除"
                            cancelText="取消"
                            onConfirm={() => handleWorldDraftDelete(draft.draftId)}
                          >
                            <button
                              type="button"
                              className="world-history-icon-btn world-history-icon-btn--danger"
                              aria-label="删除打卡记录"
                            >
                              <DeleteOutlined />
                            </button>
                          </Popconfirm>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="world-history-add-row">
                  <button
                    type="button"
                    className="world-history-add-btn"
                    onClick={handleWorldDraftAdd}
                  >
                    <PlusOutlined />
                    <span>再加一条打卡记录</span>
                  </button>
                </div>
              </div>
            )}

            {showWorldResults && (
              worldResults.length > 0 && (
                <div className="world-card-list">
                  {worldResults.map((item) => {
                    const checked = checkedWorldCodes.has(item.code)
                    return (
                      <button
                        key={item.code}
                        type="button"
                        className={`checkin-result-item ${checked ? 'checkin-result-item--checked' : ''} ${selectedWorld?.code === item.code ? 'checkin-result-item--selected' : ''}`}
                        onClick={() => selectWorldCountry(item)}
                      >
                        <div className="result-names">
                          <span className="result-name-zh">{item.name}</span>
                          <span className="result-name-en">{item.nameEn}</span>
                        </div>
                        {checked && <span className="result-checkin-btn">已点亮</span>}
                      </button>
                    )
                  })}
                </div>
              )
            )}
          </>
        )}
      </div>

      {mapMode === 'world' && (
        <div className="checkin-modal-footer checkin-modal-footer--world">
          <div className="checkin-footer-actions">
            <Button
              type="primary"
              size="large"
              className="checkin-confirm-btn"
              onClick={handleWorldConfirm}
              disabled={!selectedWorld || !hasWorldDraftChanges}
            >
              提交
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
