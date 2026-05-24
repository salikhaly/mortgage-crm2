// pages/api/users/index.js
// GET  /api/users  → все пользователи (только admin)
// POST /api/users  → создать пользователя (только admin)

import { getSupabase } from '../../../lib/supabase'
import { withAuth } from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  const sb = getSupabase()
  const { role } = req.user

  if (role !== 'admin') {
    return res.status(403).json({ error: 'Только для администратора' })
  }

  if (req.method === 'GET') {
    const { data, error } = await sb.from('users').select('*').order('created_at')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ users: data })
  }

  if (req.method === 'POST') {
    const u = req.body
    if (!u.login || !u.pwd) {
      return res.status(400).json({ error: 'login и pwd обязательны' })
    }

    // Проверка уникальности логина
    const { data: exists } = await sb
      .from('users')
      .select('id')
      .eq('login', u.login)
      .single()

    if (exists) return res.status(400).json({ error: 'Логин уже занят' })

    const { data, error } = await sb
      .from('users')
      .insert({
        id:         u.id,
        name:       u.name       || '',
        login:      u.login,
        pwd:        u.pwd,
        role:       u.role       || 'manager',
        manager_id: u.mid        || null,
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ user: data })
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
})
