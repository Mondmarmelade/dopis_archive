import { ImapFlow } from "imapflow";
import PostalMime from "postal-mime";
import { decryptData } from "../../utils/cryptography";

export async function GET({ cookies, params, request }) {
  const authCookie = cookies.get("auth");
  if (!authCookie?.value) {
    return new Response(
      JSON.stringify({ error: "Unauthorized. Please log in." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const credentials = decryptData(authCookie.value);
  if (!credentials || credentials.length < 4) {
    return new Response(
      JSON.stringify({ error: "Invalid credentials." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const url = new URL(request.url);
  const emailSeq = url.searchParams.get("seq");

  if (!emailSeq) {
    return new Response(
      JSON.stringify({ error: "Bad Request: Missing sequence parameter 'seq'." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const client = new ImapFlow({
    host: credentials[2].host,
    port: Number(credentials[3].port) || 993,
    secure: true,
    auth: {
      user: credentials[0].user,
      pass: credentials[1].pass,
    },
    logger: false,
  });

  try {
    try {
      await client.connect();
    } catch (connectError) {
      console.error("IMAP Connection Error:", connectError);
      return new Response(
        JSON.stringify({
          error: "Failed to connect to IMAP server. Please check your credentials.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const lock = await client.getMailboxLock("INBOX");

    try {
      const msg = await client.fetchOne(`${emailSeq}`, {
        uid: true,
        source: true,
        envelope: true,
        flags: true,
      });

      if (!msg || !msg.source) {
        return new Response(
          JSON.stringify({ error: "Email not found or empty source." }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      // Parse RFC822 raw message with PostalMime
      const parser = new PostalMime();
      const parsed = await parser.parse(msg.source);

      return new Response(
        JSON.stringify({
          id: String(msg.seq),
          seq: msg.seq,
          uid: msg.uid,
          subject: parsed.subject || msg.envelope?.subject || "(No Subject)",
          from: parsed.from || msg.envelope?.from?.[0] || { name: "", address: "" },
          to: parsed.to || msg.envelope?.to || [],
          cc: parsed.cc || [],
          date: parsed.date || (msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : new Date().toISOString()),
          html: parsed.html || null,
          text: parsed.text || null,
          attachments: (parsed.attachments || []).map((att) => ({
            filename: att.filename,
            mimeType: att.mimeType,
            disposition: att.disposition,
            size: att.content ? att.content.byteLength : 0,
          })),
          flags: msg.flags ? Array.from(msg.flags) : [],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    } finally {
      lock.release();
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    try {
      await client.logout();
    } catch (e) {
      // ignore
    }
  }
}
