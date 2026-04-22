import { useMemo, useState } from 'react'
import { SignedIn, SignedOut, useSignIn, useSignUp } from '@clerk/clerk-react'
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import { message } from 'antd'
import AppShell from '../components/AppShell'
import './AuthPage.css'

const AUTH_MODE = {
  signIn: 'signIn',
  signUp: 'signUp',
}

function getClerkError(error, fallback) {
  return error?.errors?.[0]?.longMessage || error?.errors?.[0]?.message || error?.message || fallback
}

export default function AuthPage() {
  const [mode, setMode] = useState(AUTH_MODE.signIn)

  return (
    <>
      <SignedOut>
        <AppShell contentClassName="auth-page">
          <section className={`auth-panel glass-card ${mode === AUTH_MODE.signUp ? 'auth-panel--signup' : ''}`}>
            <div className="auth-panel-copy">
              <p className="auth-eyebrow">Account</p>
              <h1>{mode === AUTH_MODE.signIn ? '欢迎回来' : '创建账号'}</h1>
              <p>{mode === AUTH_MODE.signIn ? '使用Wonder账号登录' : '创建一个Wonder账号'}</p>
            </div>

            <div className="auth-tabs" role="tablist" aria-label="认证方式">
              <button
                type="button"
                className={`auth-tab ${mode === AUTH_MODE.signIn ? 'auth-tab--active' : ''}`}
                onClick={() => setMode(AUTH_MODE.signIn)}
                role="tab"
                aria-selected={mode === AUTH_MODE.signIn}
              >
                登录
              </button>
              <button
                type="button"
                className={`auth-tab ${mode === AUTH_MODE.signUp ? 'auth-tab--active' : ''}`}
                onClick={() => setMode(AUTH_MODE.signUp)}
                role="tab"
                aria-selected={mode === AUTH_MODE.signUp}
              >
                注册
              </button>
            </div>

            {mode === AUTH_MODE.signIn ? (
              <SignInForm />
            ) : (
              <SignUpForm onSignedUp={() => setMode(AUTH_MODE.signIn)} />
            )}
          </section>
        </AppShell>
      </SignedOut>
      <SignedIn />
    </>
  )
}

function SignInForm() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = useMemo(() => email.trim() && password && isLoaded && !isSubmitting, [email, isLoaded, isSubmitting, password])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canSubmit) return

    setIsSubmitting(true)
    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
        strategy: 'password',
      })

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId, redirectUrl: '/' })
        return
      }

      message.error('登录需要额外验证，请检查 Clerk 登录设置')
    } catch (error) {
      message.error(getClerkError(error, '登录失败，请检查邮箱和密码'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <AuthField label="邮箱" value={email} onChange={setEmail} placeholder="输入邮箱" type="email" autoComplete="email" />
      <AuthField
        label="密码"
        value={password}
        onChange={setPassword}
        placeholder="输入密码"
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
        suffix={(
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? '隐藏密码' : '显示密码'}
          >
            {showPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          </button>
        )}
      />
      <button type="submit" className="auth-submit" disabled={!canSubmit}>
        {isSubmitting ? '登录中...' : '登录'}
      </button>
    </form>
  )
}

function SignUpForm({ onSignedUp }) {
  const { isLoaded, signUp, setActive } = useSignUp()
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pendingVerification, setPendingVerification] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = useMemo(() => {
    if (!isLoaded || isSubmitting) return false
    if (pendingVerification) return code.trim().length > 0
    return nickname.trim() && email.trim() && password
  }, [code, email, isLoaded, isSubmitting, nickname, password, pendingVerification])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canSubmit) return

    setIsSubmitting(true)
    try {
      if (pendingVerification) {
        const result = await signUp.attemptEmailAddressVerification({ code: code.trim() })
        if (result.status === 'complete') {
          await setActive({ session: result.createdSessionId, redirectUrl: '/' })
          return
        }
        message.error('验证码未通过，请重新确认')
        return
      }

      const result = await signUp.create({
        firstName: nickname.trim(),
        emailAddress: email.trim(),
        password,
      })

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId, redirectUrl: '/' })
        return
      }

      if (result.unverifiedFields?.includes('email_address')) {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
        setPendingVerification(true)
        message.success('验证码已发送到邮箱')
        return
      }

      message.error('注册需要额外配置，请检查 Clerk 注册设置')
      onSignedUp?.()
    } catch (error) {
      message.error(getClerkError(error, '注册失败，请稍后重试'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {pendingVerification ? (
        <AuthField label="验证码" value={code} onChange={setCode} placeholder="输入邮箱验证码" inputMode="numeric" autoComplete="one-time-code" />
      ) : (
        <>
          <AuthField label="昵称" value={nickname} onChange={setNickname} placeholder="输入昵称" autoComplete="name" hint="昵称可使用中文、空格、大小写" />
          <AuthField label="邮箱" value={email} onChange={setEmail} placeholder="输入邮箱" type="email" autoComplete="email" />
          <AuthField
            label="密码"
            value={password}
            onChange={setPassword}
            placeholder="输入密码"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            suffix={(
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              </button>
            )}
          />
        </>
      )}
      <button type="submit" className="auth-submit" disabled={!canSubmit}>
        {isSubmitting ? '处理中...' : pendingVerification ? '验证并登录' : '继续'}
      </button>
    </form>
  )
}

function AuthField({ label, value, onChange, hint, suffix, ...inputProps }) {
  return (
    <label className="auth-field">
      <span className="auth-label">{label}</span>
      <span className="auth-input-shell">
        <input
          className="auth-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          {...inputProps}
        />
        {suffix}
      </span>
      {hint && <span className="auth-hint">{hint}</span>}
    </label>
  )
}
