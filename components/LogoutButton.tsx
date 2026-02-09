import React from 'react'
import { signOut } from '../lib/auth'

export default function LogoutButton() {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const onLogout = async () => {
    setLoading(true)
    setError(null)
    try {
      // ✅ 이것만 하면 됩니다.
      await signOut()
    } catch (e: any) {
      setError(e?.message ?? '로그아웃 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button onClick={onLogout} disabled={loading}>
        {loading ? '로그아웃 중...' : '로그아웃'}
      </button>
      {error && <p style={{ marginTop: 8 }}>{error}</p>}
    </div>
  )
}
