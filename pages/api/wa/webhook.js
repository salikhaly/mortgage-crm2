// pages/api/wa/webhook.js
// POST /api/wa/webhook
// Green API отправляет сюда все входящие сообщения
// Настройте в Green API: Settings → Webhook URL → https://ваш-сайт.vercel.app/api/wa/webhook

import { getSupabase } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Только POST' })
  }

  try {
    const body = req.body
    const { typeWebhook, senderData, messageData } = body

    // Принимаем только входящие и исходящие сообщения
    const allowed = ['incomingMessageReceived', 'outgoingMessageReceived']
    if (!allowed.includes(typeWebhook)) {
      return res.status(200).json({ ok: true, skipped: typeWebhook })
    }

    const sb = getSupabase()

    const chatId    = senderData?.chatId ?? ''
    const rawPhone  = chatId.replace('@c.us', '').replace('@g.us', '')
    const phone     = '+' + rawPhone
    const name      = senderData?.senderName ?? senderData?.pushname ?? ''
    const direction = typeWebhook === 'incomingMessageReceived' ? 'in' : 'out'
    const msgId     = messageData?.idMessage ?? ''
    const ts        = messageData?.timestamp ?? Math.floor(Date.now() / 1000)
    const sentAt    = new Date(ts * 1000).toISOString()

    // Пропускаем группы
    if (chatId.includes('@g.us') || chatId.includes('@broadcast')) {
      return res.status(200).json({ ok: true, skipped: 'group' })
    }

    // ── Тип и контент сообщения ────────────────────────────
    const msgType = messageData?.typeMessage ?? 'textMessage'
    let type = 'text', text = '', mediaUrl = '', mediaName = '', mediaMime = '', mediaSize = 0

    switch (msgType) {
      case 'textMessage':
        type = 'text'
        text = messageData?.textMessageData?.textMessage ?? ''
        break
      case 'extendedTextMessage':
        type = 'text'
        text = messageData?.extendedTextMessageData?.text ?? ''
        break
      case 'imageMessage':
        type = 'image'
        text = messageData?.imageMessageData?.caption ?? ''
        mediaUrl = messageData?.imageMessageData?.downloadUrl ?? ''
        mediaMime = 'image/jpeg'
        break
      case 'videoMessage':
        type = 'video'
        text = messageData?.videoMessageData?.caption ?? ''
        mediaUrl = messageData?.videoMessageData?.downloadUrl ?? ''
        mediaMime = 'video/mp4'
        break
      case 'audioMessage':
        type = 'audio'
        mediaUrl = messageData?.audioMessageData?.downloadUrl ?? ''
        mediaMime = 'audio/ogg'
        break
      case 'pttMessage':
        type = 'voice'
        mediaUrl = messageData?.pttMessageData?.downloadUrl ?? ''
        mediaMime = 'audio/ogg'
        break
      case 'documentMessage':
        type = 'document'
        mediaUrl  = messageData?.documentMessageData?.downloadUrl ?? ''
        mediaName = messageData?.documentMessageData?.fileName ?? 'document'
        mediaMime = messageData?.documentMessageData?.mimeType ?? ''
        mediaSize = messageData?.documentMessageData?.fileSize ?? 0
        break
      default:
        type = 'text'
        text = `[${msgType}]`
    }

    // ── 1. Найти или создать чат ───────────────────────────
    const { data: existingChat } = await sb
      .from('wa_chats')
      .select('*')
      .eq('id', chatId)
      .single()

    if (!existingChat) {
      // Автоматически создать клиента
      const { randomUUID } = await import('crypto')
      const clientId = randomUUID()

      await sb.from('clients').insert({
        id:              clientId,
        fio:             name,
        phone:           phone,
        source:          'whatsapp',
        stage:           'new_lead',
        is_whatsapp:     true,
        wa_msg_preview:  (text || `[${type}]`).substring(0, 200),
        date_in:         new Date().toISOString().split('T')[0],
        created_at:      new Date().toISOString(),
        comments:        [],
        tasks:           [],
        payments:        [],
        accomp_stages:   {},
      })

      await sb.from('wa_chats').insert({
        id:              chatId,
        phone:           phone,
        name:            name || phone,
        last_message:    text || `[${type}]`,
        last_message_at: sentAt,
        unread_count:    direction === 'in' ? 1 : 0,
        client_id:       clientId,
        status:          'new',
      })

      console.log('New WA client created:', phone, clientId)
    } else {
      // Обновить чат
      await sb
        .from('wa_chats')
        .update({
          name:            name || existingChat.name,
          last_message:    text || `[${type}]`,
          last_message_at: sentAt,
          unread_count:    direction === 'in'
            ? (existingChat.unread_count || 0) + 1
            : existingChat.unread_count,
        })
        .eq('id', chatId)
    }

    // ── 2. Сохранить сообщение (защита от дублей) ─────────
    if (msgId) {
      const { data: dup } = await sb
        .from('wa_messages')
        .select('id')
        .eq('id', msgId)
        .single()

      if (!dup) {
        await sb.from('wa_messages').insert({
          id:         msgId,
          chat_id:    chatId,
          direction,
          type,
          body:       text,
          media_url:  mediaUrl,
          media_name: mediaName,
          media_mime: mediaMime,
          media_size: mediaSize,
          author:     direction === 'out' ? 'CRM' : name,
          status:     'delivered',
          sent_at:    sentAt,
        })
        console.log('WA message saved:', msgId, type, direction)
      }
    }

    return res.status(200).json({ ok: true, chatId, msgId, type, direction })
  } catch (err) {
    console.error('WA webhook error:', err)
    return res.status(500).json({ error: err.message })
  }
}
