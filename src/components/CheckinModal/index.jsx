import { useState, useEffect, useMemo, useCallback } from 'react'
import dayjs from 'dayjs'
import { Modal, message, Spin, Empty, Button, Input, DatePicker, Popconfirm, Select, Tooltip } from 'antd'
import {
  AimOutlined,
  AppstoreOutlined,
  BulbOutlined,
  DeleteOutlined,
  EditOutlined,
  GlobalOutlined,
  MinusOutlined,
  PlusOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
import { geoCentroid, geoMercator } from 'd3-geo'
import ReactConfetti from 'react-confetti'
import { useAuth } from '@clerk/clerk-react'
import useCheckinStore from '../../store/useCheckinStore'
import { CHINA_PROVINCES } from '../../data/chinaCities'
import { WORLD_COUNTRIES_LIST, getWorldCountryByCode, getWorldCountryNameZh } from '../../data/worldCountries'
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
  const code = item.code || ''
  const nameEn = item.nameEn || item.name_en || ''
  return {
    ...item,
    code,
    nameEn,
    name: item.name || item.name_zh || getWorldCountryNameZh(code, nameEn) || nameEn,
  }
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

export default function CheckinModal({ open, onClose, prefill }) {
  const { addCheckin, removeCheckin, updateCheckinTime, mapMode, checkins } = useCheckinStore()
  const { getToken } = useAuth()
  const [showConfetti, setShowConfetti] = useState(false)
  const [selectedProvinceCode, setSelectedProvinceCode] = useState('')
  const [chinaViewMode, setChinaViewMode] = useState('map')
  const [activeChinaCityCode, setActiveChinaCityCode] = useState('')
  const [chinaDraftsByProvince, setChinaDraftsByProvince] = useState({})
  const [activeChinaPicker, setActiveChinaPicker] = useState(null)
  const [worldQuery, setWorldQuery] = useState('')
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
  const checkedWorldCodes = useMemo(
    () => new Set(checkins.filter((c) => c.type === 'world_country').map((c) => c.code)),
    [checkins]
  )

  const selectedProvince = useMemo(
    () => provinces.find((province) => province.code === selectedProvinceCode) || null,
    [provinces, selectedProvinceCode]
  )

  const selectedWorldCheckins = useMemo(
    () => (
      selectedWorld
        ? checkins
          .filter((item) => item.type === 'world_country' && item.code === selectedWorld.code)
          .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0))
        : []
    ),
    [checkins, selectedWorld]
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
          const code = String(item.id || '')
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

  const initializeChinaDrafts = useCallback((provinceCode, regions = []) => {
    if (!provinceCode) return

    setChinaDraftsByProvince((current) => {
      if (current[provinceCode]) return current

      const regionMap = new Map(regions.map((region) => [String(region.code), region]))
      const drafts = checkins
        .filter((item) => item.type === 'china_city' && getChinaProvinceCode(item) === provinceCode)
        .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0))
        .map((item) => {
          const region = regionMap.get(String(item.code))
            || regions.find((entry) => normalizeRegionName(entry.shortName) === normalizeRegionName(item.city_name || ''))
            || {
              code: item.code,
              shortName: item.city_name || item.name_en,
              displayName: item.city_name || item.name_zh?.split(' · ').at(-1) || item.name_en || String(item.code),
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
  }, [checkins])

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

  const isChinaRegionSelected = (regionCode) => (
    activeChinaCityCode === String(regionCode)
  )

  const hasChinaDraftForRegion = (regionCode) => (
    currentChinaDrafts.some((draft) => draft.code === String(regionCode) && draft.status !== 'deleted')
  )

  const getChinaRegionDraftState = (region) => {
    const regionCode = String(region.code)
    const regionDrafts = currentChinaDrafts.filter((draft) => draft.code === regionCode && draft.status !== 'deleted')
    if (regionDrafts.some((draft) => draft.status === 'new')) return 'new'
    if (regionDrafts.length > 0) return 'existing'
    if (checkedChinaRegionLookup.anyByCode.has(regionCode)) return 'existing'
    if (
      checkedChinaRegionLookup.anyByName.has(normalizeRegionName(region.displayName)) ||
      checkedChinaRegionLookup.anyByName.has(normalizeRegionName(region.shortName))
    ) {
      return 'existing'
    }
    return 'empty'
  }

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

    setActiveChinaCityCode(String(targetRegion.code))
    updateCurrentChinaDrafts((drafts) => [
      ...drafts,
      createChinaDraftEntry({
        createdAt: dayjs().startOf('month').valueOf(),
        region: targetRegion,
      }),
    ])
  }

  const handleChinaDraftDelete = (draftId) => {
    updateCurrentChinaDrafts((drafts) => drafts.flatMap((draft) => {
      if (draft.draftId !== draftId) return [draft]
      if (!draft.sourceId) return []
      return [{
        ...draft,
        status: 'deleted',
      }]
    }))
    setActiveChinaPicker((current) => (current?.draftId === draftId ? null : current))
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
        const region = regionMap.get(String(item.code))
          || provinceRegions.find((entry) => normalizeRegionName(entry.shortName) === normalizeRegionName(item.city_name || ''))
          || {
            code: item.code,
            shortName: item.city_name || item.name_en,
            displayName: item.city_name || item.name_zh?.split(' · ').at(-1) || item.name_en || String(item.code),
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

    return allDrafts.sort((a, b) => {
      const priorityDiff = (priority[a.status] ?? 99) - (priority[b.status] ?? 99)
      if (priorityDiff !== 0) return priorityDiff
      return Number(b.createdAt || 0) - Number(a.createdAt || 0)
    })
  }, [checkins, currentChinaDrafts, provinceRegions, selectedProvinceCode])

  const worldResults = useMemo(() => {
    if (mapMode !== 'world') return []
    const q = worldQuery.trim().toLowerCase()
    if (!q) return allData.slice(0, 80)
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
    const nextDrafts = checkins
      .filter((entry) => entry.type === 'world_country' && entry.code === normalizedItem.code)
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
  }, [checkins])

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
    setActiveChinaCityCode(String(region.code))
    if (!hasChinaDraftForRegion(region.code)) {
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

    const provinceName = getProvinceDisplayName(null, selectedProvince, prefill)
    const provinceCheckins = checkins.filter(
      (item) => item.type === 'china_city' && getChinaProvinceCode(item) === selectedProvinceCode
    )
    const existingDraftIds = new Set(
      currentChinaDrafts.filter((draft) => draft.sourceId && draft.status !== 'deleted').map((draft) => draft.sourceId)
    )

    for (const checkin of provinceCheckins) {
      if (!existingDraftIds.has(checkin.id)) {
        await removeCheckin(checkin.id, getToken)
      }
    }

    for (const draft of currentChinaDrafts.filter((entry) => entry.sourceId && entry.status !== 'deleted')) {
      if (draft.originalCreatedAt !== draft.createdAt) {
        await updateCheckinTime(draft.sourceId, draft.createdAt, getToken)
      }
    }

    for (const draft of currentChinaDrafts.filter((entry) => !entry.sourceId && entry.status !== 'deleted')) {
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
      width={mapMode === 'china' ? 1040 : 720}
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
          setSelectedProvinceCode('')
          setChinaViewMode('map')
          setActiveChinaCityCode('')
          setChinaDraftsByProvince({})
          setActiveChinaPicker(null)
          setWorldQuery('')
          setSelectedWorld(null)
          setWorldDraftsByCode({})
          setActiveWorldPicker(null)
          setProvinceGeoData(null)
          setProvinceGeoLoading(false)
          setProvinceGeoError('')
          return
        }

        setSelectedProvinceCode(String(prefill?.code || provinces[0]?.code || ''))
        setChinaViewMode('map')
        setActiveChinaCityCode('')
        setChinaDraftsByProvince({})
        setActiveChinaPicker(null)
        setWorldQuery('')
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
                  onChange={(value) => {
                    setSelectedProvinceCode(value)
                    setActiveChinaCityCode('')
                    setActiveChinaPicker(null)
                  }}
                  options={provinces.map((province) => ({ value: province.code, label: province.name }))}
                  className="province-inline-select"
                />
                <button
                  type="button"
                  className="china-view-toggle-btn"
                  onClick={() => setChinaViewMode((current) => (current === 'map' ? 'list' : 'map'))}
                >
                  {chinaViewMode === 'map' ? <UnorderedListOutlined /> : <AppstoreOutlined />}
                  <span>{chinaViewMode === 'map' ? '查看列表' : '查看地图'}</span>
                </button>
              </div>

              {chinaViewMode === 'map' ? (
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
                          const region = provinceRegions.find((item) => item.code === (geo.properties?.adcode?.toString() || ''))
                            || provinceRegions.find((item) => item.displayName === getRegionDisplayName(geo))

                          if (!region) return null

                          const regionState = getChinaRegionDraftState(region)
                          const selected = isChinaRegionSelected(region.code)
                          const fill = regionState === 'new' ? '#FBCFE8' : (regionState === 'existing' ? '#BFDBFE' : '#FFFFFF')
                          const stroke = selected ? '#EC4899' : (regionState === 'empty' ? '#CBD5E1' : '#60A5FA')

                          return (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              onClick={() => handleChinaRegionToggle(region)}
                              className={`province-detail-geo ${regionState !== 'empty' ? 'province-detail-geo--checked' : ''} ${selected ? 'province-detail-geo--selected' : ''}`}
                              style={{
                                default: { fill, stroke, strokeWidth: selected ? 1.8 : 1.2, outline: 'none', cursor: 'pointer' },
                                hover: {
                                  fill: regionState === 'new' ? '#F9A8D4' : (regionState === 'existing' ? '#93C5FD' : '#EFF6FF'),
                                  stroke: selected ? '#DB2777' : (regionState === 'empty' ? '#93C5FD' : '#3B82F6'),
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

                      {provinceRegions.map((region) => {
                        const regionState = getChinaRegionDraftState(region)
                        const selected = isChinaRegionSelected(region.code)
                        return (
                          <Marker key={`label-${region.code}`} coordinates={region.centroid}>
                            <g
                              className="province-detail-label-group"
                              onClick={() => handleChinaRegionToggle(region)}
                              transform={`scale(${1 / provinceViewport.zoom})`}
                            >
                              <text
                                textAnchor="middle"
                                className={`province-detail-label ${regionState !== 'empty' ? 'province-detail-label--checked' : ''} ${selected ? 'province-detail-label--selected' : ''}`}
                              >
                                {region.displayName}
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
              </div>
            ) : (
              <div className="china-history-list">
                {currentChinaVisibleDrafts.length === 0 && (
                  <div className="china-city-tag-hint">
                    <BulbOutlined />
                    <span>选择一个城市点亮它吧</span>
                  </div>
                )}
                <div className="city-tag-grid china-city-tag-grid">
                  {provinceRegions.map((region) => {
                    const regionState = getChinaRegionDraftState(region)
                    return (
                      <button
                        key={`city-tag-${region.code}`}
                        type="button"
                        className={`city-tag ${regionState === 'new' ? 'city-tag--pending' : ''} ${regionState === 'existing' ? 'city-tag--checked' : ''}`}
                        onClick={() => handleChinaDraftAdd(region)}
                      >
                        <span className="city-tag-name">{region.displayName}</span>
                        {regionState === 'existing' && <span className="city-tag-meta">已打卡</span>}
                      </button>
                    )
                  })}
                </div>
                {currentChinaVisibleDrafts.map((draft) => (
                  <div
                    key={draft.draftId}
                    className={`world-history-item china-history-item ${activeChinaCityCode === draft.code ? 'china-history-item--active' : ''}`}
                    onClick={() => setActiveChinaCityCode(draft.code)}
                  >
                    <div className="world-history-main">
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
                      <span className={`world-history-badge world-history-badge--${draft.status}`}>
                        {draft.status === 'existing' ? '已打卡' : draft.status === 'modified' ? '修改' : '新打卡'}
                      </span>
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
                ))}
              </div>
            )}
            </div>
          </>
        )}

        {mapMode === 'world' && (
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
                    <span>新增一条打卡</span>
                  </button>
                </div>
              </div>
            )}

            {worldResults.length === 0 ? (
              <Empty description={emptyState} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
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
            )}
          </>
        )}
      </div>

      {mapMode === 'china' && (
        <div className="checkin-modal-footer checkin-modal-footer--china">
          <div className="checkin-footer-copy checkin-footer-copy--china">
            点击城市新增打卡
          </div>
          <Button
            type="primary"
            size="large"
            className="checkin-confirm-btn"
            onClick={handleChinaBatchCheckin}
            disabled={!hasChinaDraftChanges}
          >
            提交
          </Button>
        </div>
      )}

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
