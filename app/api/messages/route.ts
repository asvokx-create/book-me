import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

type ConversationRow = {
  id: string; customer_id: string; provider_id: string; provider_user_id: string;
  provider_name: string; customer_name: string; service_title: string | null;
  last_message: string | null; last_message_at: Date | null; unread_count: number;
};

async function getConversation(userId: string, conversationId: string) {
  const result = await database.query<ConversationRow>(
    `SELECT c.id::text, c.customer_id, c.provider_id::text, p.user_id AS provider_user_id,
            p.business_name AS provider_name, u.name AS customer_name, s.title AS service_title,
            latest.body AS last_message, latest.created_at AS last_message_at,
            (SELECT count(*)::int FROM messages unread
             WHERE unread.conversation_id = c.id AND unread.sender_id <> $1 AND unread.read_at IS NULL) AS unread_count
     FROM conversations c
     JOIN provider_profiles p ON p.id = c.provider_id
     JOIN "user" u ON u.id = c.customer_id
     LEFT JOIN services s ON s.id = c.service_id
     LEFT JOIN LATERAL (
       SELECT body, created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
     ) latest ON true
     WHERE c.id::text = $2 AND (c.customer_id = $1 OR p.user_id = $1)
     LIMIT 1`,
    [userId, conversationId],
  );
  return result.rows[0] ?? null;
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const conversationId = new URL(request.url).searchParams.get("conversationId") ?? "";

  const conversationsResult = await database.query<ConversationRow>(
    `SELECT c.id::text, c.customer_id, c.provider_id::text, p.user_id AS provider_user_id,
            p.business_name AS provider_name, u.name AS customer_name, s.title AS service_title,
            latest.body AS last_message, latest.created_at AS last_message_at,
            (SELECT count(*)::int FROM messages unread
             WHERE unread.conversation_id = c.id AND unread.sender_id <> $1 AND unread.read_at IS NULL) AS unread_count
     FROM conversations c
     JOIN provider_profiles p ON p.id = c.provider_id
     JOIN "user" u ON u.id = c.customer_id
     LEFT JOIN services s ON s.id = c.service_id
     LEFT JOIN LATERAL (
       SELECT body, created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
     ) latest ON true
     WHERE c.customer_id = $1 OR p.user_id = $1
     ORDER BY c.updated_at DESC`,
    [session.user.id],
  );

  const selected = conversationId ? await getConversation(session.user.id, conversationId) : conversationsResult.rows[0] ?? null;
  const messages = selected ? await database.query<{
    id: string; body: string; is_mine: boolean; sender_name: string; created_at: Date;
  }>(
    `SELECT m.id::text, m.body, (m.sender_id = $1) AS is_mine, sender.name AS sender_name, m.created_at
     FROM messages m
     JOIN "user" sender ON sender.id = m.sender_id
     WHERE m.conversation_id::text = $2
     ORDER BY m.created_at ASC
     LIMIT 200`,
    [session.user.id, selected.id],
  ) : null;

  const mapConversation = (row: ConversationRow) => ({
    id: row.id,
    providerId: row.provider_id,
    providerName: row.provider_name,
    customerName: row.customer_name,
    serviceTitle: row.service_title,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
    unreadCount: row.unread_count,
    isProvider: row.provider_user_id === session.user.id,
  });

  return NextResponse.json({
    conversations: conversationsResult.rows.map(mapConversation),
    selectedConversation: selected ? mapConversation(selected) : null,
    messages: messages?.rows.map((message) => ({
      id: message.id,
      body: message.body,
      isMine: message.is_mine,
      senderName: message.sender_name,
      createdAt: message.created_at,
    })) ?? [],
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in to send a message." }, { status: 401 });
  const body = (await request.json()) as { conversationId?: unknown; providerId?: unknown; serviceId?: unknown; message?: unknown };
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  const providerId = typeof body.providerId === "string" ? body.providerId : "";
  const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 2000) return NextResponse.json({ error: "Write a message between 1 and 2,000 characters." }, { status: 400 });

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    let conversation: ConversationRow | null = null;
    if (conversationId) {
      const result = await client.query<ConversationRow>(
        `SELECT c.id::text, c.customer_id, c.provider_id::text, p.user_id AS provider_user_id,
                p.business_name AS provider_name, u.name AS customer_name,
                NULL::text AS service_title, NULL::text AS last_message, NULL::timestamptz AS last_message_at, 0::int AS unread_count
         FROM conversations c
         JOIN provider_profiles p ON p.id = c.provider_id
         JOIN "user" u ON u.id = c.customer_id
         WHERE c.id::text = $1 AND (c.customer_id = $2 OR p.user_id = $2)
         FOR UPDATE OF c`,
        [conversationId, session.user.id],
      );
      conversation = result.rows[0] ?? null;
    } else if (providerId) {
      const result = await client.query<ConversationRow>(
        `INSERT INTO conversations (customer_id, provider_id, service_id)
         SELECT $1, p.id, CASE WHEN s.id IS NULL THEN NULL ELSE s.id END
         FROM provider_profiles p
         LEFT JOIN services s ON s.id::text = NULLIF($3, '') AND s.provider_id = p.id AND s.is_active = true
         WHERE p.id::text = $2 AND p.is_active = true AND p.user_id <> $1
           AND (NULLIF($3, '') IS NULL OR s.id IS NOT NULL)
         ON CONFLICT (customer_id, provider_id) DO UPDATE
           SET service_id = COALESCE(EXCLUDED.service_id, conversations.service_id), updated_at = now()
         RETURNING id::text, customer_id, provider_id::text,
           (SELECT user_id FROM provider_profiles WHERE id = provider_id) AS provider_user_id,
           (SELECT business_name FROM provider_profiles WHERE id = provider_id) AS provider_name,
           (SELECT name FROM "user" WHERE id = customer_id) AS customer_name,
           NULL::text AS service_title, NULL::text AS last_message, NULL::timestamptz AS last_message_at, 0::int AS unread_count`,
        [session.user.id, providerId, serviceId],
      );
      conversation = result.rows[0] ?? null;
    }

    if (!conversation) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    const created = await client.query<{ id: string }>(
      `INSERT INTO messages (conversation_id, sender_id, body)
       VALUES ($1, $2, $3)
       RETURNING id::text`,
      [conversation.id, session.user.id, message],
    );
    await client.query("UPDATE conversations SET updated_at = now() WHERE id::text = $1", [conversation.id]);
    const recipientId = conversation.customer_id === session.user.id ? conversation.provider_user_id : conversation.customer_id;
    const recipientHref = conversation.customer_id === session.user.id
      ? `/provider/dashboard/messages?conversationId=${conversation.id}`
      : `/account/messages?conversationId=${conversation.id}`;
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, href, dedupe_key)
       VALUES ($1, 'new_message', 'New message', $2, $3, $4)
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [recipientId, `${session.user.name || "Someone"} sent you a message.`, recipientHref, `message-${created.rows[0].id}`],
    );
    await client.query("COMMIT");
    return NextResponse.json({ conversationId: conversation.id, messageId: created.rows[0].id }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Message send failed", error);
    return NextResponse.json({ error: "We could not send your message. Please try again." }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = (await request.json()) as { conversationId?: unknown };
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  if (!conversationId) return NextResponse.json({ error: "Choose a conversation." }, { status: 400 });
  const result = await database.query(
    `UPDATE messages m SET read_at = COALESCE(m.read_at, now())
     FROM conversations c JOIN provider_profiles p ON p.id = c.provider_id
     WHERE m.conversation_id = c.id AND c.id::text = $1 AND m.sender_id <> $2
       AND (c.customer_id = $2 OR p.user_id = $2)`,
    [conversationId, session.user.id],
  );
  return NextResponse.json({ ok: true, updated: result.rowCount });
}
