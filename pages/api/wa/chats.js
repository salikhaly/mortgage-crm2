// pages/api/wa/chats.js
// GET /api/wa/chats          → список всех WA чатов
// GET /api/wa/chats?id=xxx   → сообщения конкретного чата

import { getSupabase } from '../../../lib/supabase'
import { withAuth } from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  const sb = getSupabase()

  if (req.method === 'GET') {
    const { id, mark_read } = req.query

    // Если передан id — возвращаем сообщения чата
    if (id) {
      const { data: messages, error } = await sb
        .from('wa_messages')
        .select('*')
        .eq('chat_id', id)
        .order('sent_at', { ascending: true })

      if (error) return res.status(500).json({ error: error.message })

      // Сбросить счётчик непрочитанных
      if (mark_read === '1') {
        await sb.from('wa_chats').update({ unread_count: 0 }).eq('id', id)
      }

      return res.status(200).json({ messages: messages || [] })
    }

    // Иначе — список чатов
    const { data: chats, error } = await sb
      .from('wa_chats')
      .select('*, clients(fio, phone, stage)')
      .order('last_message_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json({ chats: chats || [] })
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
})
