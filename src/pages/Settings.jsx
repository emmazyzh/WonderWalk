import { useEffect, useRef, useState } from 'react'
import { useAuth, useClerk, useUser } from '@clerk/clerk-react'
import { Avatar, Button, Input, message } from 'antd'
import { ArrowLeftOutlined, EditOutlined, LogoutOutlined, MailOutlined, SyncOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import useCheckinStore from '../store/useCheckinStore'
import './Settings.css'

export default function Settings() {
  const { user } = useUser()
  const clerk = useClerk()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const { syncWithServer } = useCheckinStore()
  const fileInputRef = useRef(null)
  const [nickname, setNickname] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setNickname(user?.firstName || '')
  }, [user?.firstName])

  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
  }, [avatarPreview])

  const email = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || ''

  const handleAvatarSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!user) return
    const trimmedNickname = nickname.trim()
    if (!trimmedNickname) {
      message.error('昵称不能为空')
      return
    }

    setSaving(true)
    try {
      if (avatarFile) {
        await user.setProfileImage({ file: avatarFile })
      }

      if (trimmedNickname !== (user.firstName || '')) {
        await user.update({ firstName: trimmedNickname })
      }

      await user.reload()
      setAvatarFile(null)
      setAvatarPreview('')
      message.success('设置已保存')
    } catch (error) {
      console.error(error)
      message.error('保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncWithServer(getToken)
      message.success('本地缓存已与线上数据完全同步')
    } catch (error) {
      console.error(error)
      message.error(error.message || '同步失败，请稍后重试')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <AppShell contentClassName="settings-page">
      <section className="settings-panel glass-card">
        <div className="settings-panel-copy">
          <div className="settings-toolbar">
            <button type="button" className="settings-sync-btn" onClick={handleSync} disabled={syncing} aria-label="同步线上记录">
              <SyncOutlined spin={syncing} />
            </button>
            <span className="settings-sync-hint">同步线上记录</span>
          </div>
          <button type="button" className="page-back-btn" onClick={() => navigate(-1)}>
            <ArrowLeftOutlined />
            <span>返回</span>
          </button>
          <p className="settings-eyebrow">Account</p>
          <h1>设置</h1>
        </div>

        <div className="settings-section-block">
          <div className="settings-avatar-row">
            <button type="button" className="settings-avatar-trigger" onClick={() => fileInputRef.current?.click()} aria-label="修改头像">
              <Avatar
                src={avatarPreview || user?.imageUrl}
                icon={!user?.imageUrl && !avatarPreview && <UserOutlined />}
                size={96}
                className="settings-avatar-preview"
              />
              <span className="settings-avatar-edit-icon">
                <EditOutlined />
              </span>
            </button>
            <div className="settings-profile-fields">
              <div className="settings-section-block settings-section-block--compact">
                <div className="settings-label">邮箱</div>
                <Input value={email} prefix={<MailOutlined />} disabled size="large" />
              </div>

              <div className="settings-section-block settings-section-block--compact">
                <div className="settings-label">昵称</div>
                <Input
                  size="large"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  prefix={<UserOutlined />}
                  placeholder="请输入昵称"
                />
              </div>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarSelect}
            className="settings-file-input"
          />
        </div>

        <div className="settings-actions">
          <Button type="primary" size="large" loading={saving} onClick={handleSave}>
            保存修改
          </Button>
          <Button
            size="large"
            icon={<LogoutOutlined />}
            onClick={() => clerk.signOut({ redirectUrl: '/' })}
          >
            退出登录
          </Button>
        </div>
      </section>
    </AppShell>
  )
}
