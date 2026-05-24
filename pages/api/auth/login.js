// pages/api/auth/login.js
// POST /api/auth/login  →  { login, pwd }  →  { token, user }

import { getSupabase } from '../../../lib/supabase'
import { signToken } from '../../../lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешён' })
  }

  const { login, pwd } = req.body

  if (!login || !pwd) {
    return res.status(400).json({ error: 'Логин и пароль обязательны' })
  }

  const sb = getSupabase()

  const { data: user, error } = await sb
    .from('users')
    .select('*')
    .eq('login', login.trim())
    .eq('pwd', pwd)
    .single()

  if (error || !user) {
    return res.status(401).json({ error: 'Неверный логин или пароль' })
  }

  // Создаём JWT токен
  const token = signToken({
    id:   user.id,
    name: user.name,
    role: user.role,
    mid:  user.manager_id,
    login: user.login,
  })

  return res.status(200).json({
    token,
    user: {
      id:    user.id,
      name:  user.name,
      role:  user.role,
      mid:   user.manager_id,
      login: user.login,
    },
  })
}
