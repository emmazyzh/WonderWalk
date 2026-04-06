import { useState, useEffect, useMemo } from 'react'
import { Modal, message, Spin, Empty, Button, Select, Input } from 'antd'
import { EnvironmentFilled, CheckCircleFilled, SearchOutlined } from '@ant-design/icons'
import ReactConfetti from 'react-confetti'
import { useAuth } from '@clerk/clerk-react'
import useCheckinStore from '../../store/useCheckinStore'
import { CHINA_PROVINCES, getAllChinaCities, getProvinceCities } from '../../data/chinaCities'
import { WORLD_COUNTRIES_LIST, getWorldCountryByCode } from '../../data/worldCountries'
import './CheckinModal.css'

let worldCountries = null

async function loadSearchData(mapMode) {
  if (mapMode === 'world' && !worldCountries) {
    worldCountries = WORLD_COUNTRIES_LIST
  }

  if (mapMode === 'china') {
    return {
      provinces: CHINA_PROVINCES,
      cities: getAllChinaCities(),
    }
  }

  return {
    provinces: [],
    cities: worldCountries || [],
  }
}

export default function CheckinModal({ open, onClose, prefill }) {
  const { addCheckin, mapMode, checkins } = useCheckinStore()
  const { getToken } = useAuth()
  const [showConfetti, setShowConfetti] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [provinces, setProvinces] = useState([])
  const [allData, setAllData] = useState([])
  const [selectedProvinceCode, setSelectedProvinceCode] = useState('')
  const [selectedCities, setSelectedCities] = useState([])
  const [worldQuery, setWorldQuery] = useState('')
  const [selectedWorld, setSelectedWorld] = useState(null)
  const isWorldQuickCheckin = mapMode === 'world' && Boolean(prefill?.code)

  const checkedCityCodes = useMemo(
    () => new Set(checkins.filter((c) => c.type === 'china_city').map((c) => c.code)),
    [checkins]
  )
  const checkedWorldCodes = useMemo(
    () => new Set(checkins.filter((c) => c.type === 'world_country').map((c) => c.code)),
    [checkins]
  )

  const isChinaCityChecked = (item) =>
    checkedCityCodes.has(item.code) ||
    (checkedCityCodes.has(item.provinceCode) && getProvinceCities(item.provinceCode).length === 1)

  const getProvinceDisplayName = (item) => item?.provinceName || selectedProvince?.name || prefill?.name || ''

  useEffect(() => {
    if (!open) return

    setDataLoaded(false)
    setSelectedProvinceCode(mapMode === 'china' ? prefill?.code || '' : '')
    setSelectedCities([])
    setWorldQuery('')
    setSelectedWorld(mapMode === 'world' ? prefill || null : null)

    loadSearchData(mapMode).then((data) => {
      setProvinces(data.provinces || [])
      setAllData(data.cities || [])
      if (mapMode === 'china') {
        setSelectedProvinceCode(prefill?.code || data.provinces?.[0]?.code || '')
      } else if (mapMode === 'world') {
        const matchedWorld = getWorldCountryByCode(prefill?.code) || prefill || null
        setSelectedWorld(matchedWorld)
      }
      setDataLoaded(true)
    })
  }, [open, mapMode, prefill])

  const selectedProvince = useMemo(
    () => provinces.find((province) => province.code === selectedProvinceCode) || null,
    [provinces, selectedProvinceCode]
  )

  const cityResults = useMemo(() => {
    if (mapMode !== 'china') return []

    const baseCities = selectedProvinceCode
      ? getProvinceCities(selectedProvinceCode)
      : allData

    return baseCities
  }, [allData, mapMode, selectedProvinceCode])

  const worldResults = useMemo(() => {
    if (mapMode !== 'world') return []
    const q = worldQuery.trim().toLowerCase()
    if (!q) return allData.slice(0, 40)
    return allData.filter((item) =>
      item.name.toLowerCase().includes(q) ||
      item.nameEn.toLowerCase().includes(q)
    ).slice(0, 40)
  }, [allData, mapMode, worldQuery])

  const handleCheckin = async (item) => {
    const chinaChecked = isChinaCityChecked(item)

    if (mapMode === 'china' && chinaChecked) {
      message.info(`${getProvinceDisplayName(item)} · ${item.name} 已经打卡过了`)
      return
    }

    if (mapMode === 'world' && checkedWorldCodes.has(item.code)) {
      message.info(`${item.name} 已经打卡过了`)
      return
    }

    await addCheckin(
      mapMode === 'china'
        ? {
            type: 'china_city',
            code: item.code,
            province_code: item.provinceCode,
            province_name: getProvinceDisplayName(item),
            city_name: item.name,
            name_zh: `${getProvinceDisplayName(item)} · ${item.name}`,
            name_en: item.nameEn || item.name,
          }
        : {
            type: 'world_country',
            code: item.code,
            name_zh: item.name,
            name_en: item.nameEn || item.name,
          },
      getToken
    )

    setShowConfetti(true)
    message.success({
      content: mapMode === 'china' ? `🚩 已打卡 ${getProvinceDisplayName(item)} · ${item.name}` : `🚩 已打卡 ${item.name}`,
      icon: '🎉',
    })
    setTimeout(() => {
      setShowConfetti(false)
      onClose()
    }, 1600)
  }

  const toggleCity = (item) => {
    if (isChinaCityChecked(item)) return

    setSelectedCities((current) => {
      const exists = current.some((selected) => selected.code === item.code)
      if (exists) {
        return current.filter((selected) => selected.code !== item.code)
      }
      return [...current, item]
    })
  }

  const handleBatchCheckin = async () => {
    if (selectedCities.length === 0) return

    for (const item of selectedCities) {
      await addCheckin(
        {
          type: 'china_city',
          code: item.code,
          province_code: item.provinceCode,
          province_name: getProvinceDisplayName(item),
          city_name: item.name,
          name_zh: `${getProvinceDisplayName(item)} · ${item.name}`,
          name_en: item.nameEn || item.name,
        },
        getToken
      )
    }

    setShowConfetti(true)
    message.success({
      content: `🎉 已打卡 ${selectedCities.length} 个城市`,
      icon: '🚩',
    })
    setTimeout(() => {
      setShowConfetti(false)
      onClose()
    }, 1600)
  }

  const handleWorldConfirm = async () => {
    if (!selectedWorld) return
    await handleCheckin(selectedWorld)
  }

  const emptyState = mapMode === 'china'
    ? (selectedProvince ? `没有找到 ${selectedProvince.name} 的匹配城市` : '先选省份，再搜索城市')
    : '没有找到匹配的国家'

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={mapMode === 'china' ? 720 : 520}
      classNames={{ content: 'checkin-modal-content' }}
      styles={{ mask: { backdropFilter: 'blur(10px)', background: 'rgba(15, 23, 42, 0.34)' } }}
      closable={!showConfetti}
    >
      {showConfetti && (
        <ReactConfetti
          numberOfPieces={180}
          recycle={false}
          colors={['#2563EB', '#F59E0B', '#EC4899', '#10B981', '#BFDBFE']}
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999, pointerEvents: 'none' }}
        />
      )}

      <div className="checkin-modal-header">
        <div className="checkin-modal-icon">{mapMode === 'china' ? '🏙️' : '🌍'}</div>
        <div className="checkin-modal-copy">
          <h2 className="checkin-modal-title">
            {mapMode === 'china' ? '选择你去过的城市' : '点亮去过的国家'}
          </h2>
          <p className="checkin-modal-subtitle">
            {mapMode === 'china'
              ? (selectedProvince ? `当前省份：${selectedProvince.name}` : '先选省份，再用搜索框筛选城市')
              : (selectedWorld?.name || '')}
          </p>
        </div>
      </div>

      {mapMode === 'china' && (
        null
      )}

      <div className="checkin-results">
        {!dataLoaded && <Spin size="large" style={{ display: 'block', margin: '56px auto' }} />}

        {dataLoaded && mapMode === 'china' && selectedProvince && (
          <div className="selected-province-panel">
            <div>
              <div className="selected-province-label">目的地省份</div>
              <Select
                value={selectedProvinceCode || undefined}
                onChange={setSelectedProvinceCode}
                className="province-inline-select"
                popupMatchSelectWidth={false}
                options={provinces.map((province) => ({ value: province.code, label: province.name }))}
              />
            </div>
            <div className="selected-province-meta">{cityResults.length} 个城市可选</div>
          </div>
        )}

        {dataLoaded && mapMode === 'china' && cityResults.length === 0 && (
          <Empty description={emptyState} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}

        {dataLoaded && mapMode === 'china' && cityResults.length > 0 && (
          <div className="city-tag-grid">
            {cityResults.map((item) => {
              const checked = isChinaCityChecked(item)
              const pending = selectedCities.some((selected) => selected.code === item.code)
              return (
                <button
                  key={item.code}
                  type="button"
                  className={`city-tag ${checked ? 'city-tag--checked' : ''} ${pending ? 'city-tag--pending' : ''}`}
                  onClick={() => toggleCity(item)}
                >
                  <span className="city-tag-name">{item.name}</span>
                  <span className="city-tag-meta">{getProvinceDisplayName(item)}</span>
                  {checked && <CheckCircleFilled className="city-tag-check" />}
                  {pending && !checked && <span className="city-tag-pending-mark">待确认</span>}
                </button>
              )
            })}
          </div>
        )}

        {dataLoaded && mapMode === 'world' && worldResults.length === 0 && (
          <Empty description={emptyState} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}

        {dataLoaded && mapMode === 'world' && !isWorldQuickCheckin && (
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

        {dataLoaded && mapMode === 'world' && isWorldQuickCheckin && selectedWorld && (
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

        {dataLoaded && mapMode === 'world' && !isWorldQuickCheckin && worldResults.length > 0 && (
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
        <div className="checkin-modal-footer">
          <div className="checkin-footer-copy">
            已选 <span className="checkin-footer-count">{selectedCities.length}</span> 个城市
          </div>
          <Button
            type="primary"
            size="large"
            className="checkin-confirm-btn"
            onClick={handleBatchCheckin}
            disabled={selectedCities.length === 0}
          >
            确认打卡
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
