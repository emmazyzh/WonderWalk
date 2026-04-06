// src/App.jsx
import { ConfigProvider, theme } from 'antd'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import zhCN from 'antd/locale/zh_CN'
import Home from './pages/Home'

const antdTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#2563EB',
    colorSuccess: '#10B981',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    colorInfo: '#2563EB',
    borderRadius: 12,
    borderRadiusLG: 20,
    borderRadiusSM: 8,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    colorBgContainer: '#FFFFFF',
    colorBorder: '#E2E8F0',
    boxShadow: '0 4px 20px rgba(37, 99, 235, 0.12)',
    motionDurationMid: '0.2s',
    motionEaseInOut: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  components: {
    Button: {
      borderRadius: 9999,
      fontWeight: 800,
      fontFamily: "'Nunito', sans-serif",
    },
    Modal: {
      borderRadiusLG: 32,
    },
    Drawer: {
      borderRadius: 0,
    },
    Input: {
      borderRadius: 12,
    },
    Tabs: {
      inkBarColor: '#2563EB',
      itemActiveColor: '#2563EB',
      itemSelectedColor: '#2563EB',
    },
  },
}

export default function App() {
  return (
    <ConfigProvider theme={antdTheme} locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}
