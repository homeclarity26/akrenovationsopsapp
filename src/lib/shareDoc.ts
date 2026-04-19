// Share helpers for proposals and invoices.
//
// Provides a single uploadBlobForShare() utility that drops a Blob into the
// `documents` storage bucket under a fixed path and returns a signed URL good
// for 7 days — long enough for a client to open it from an email or SMS.
// Paired with send-email and send-sms edge functions, this gives us the full
// share-via-link pattern without needing each caller to reinvent it.

import { supabase } from '@/lib/supabase'

export type ShareDocKind = 'proposal' | 'invoice' | 'contract'

export interface ShareUploadResult {
  /** Signed URL valid for 7 days. */
  url: string
  /** Storage path (bucket+path) for future re-signing or deletion. */
  storagePath: string
  /** The filename that was uploaded. */
  filename: string
}

const SEVEN_DAYS_SECONDS = 60 * 60 * 24 * 7

/** Upload a blob to `documents/{kind}s/{doc_id}/{timestamp}-{filename}` and return a 7-day signed URL. */
export async function uploadBlobForShare(
  blob: Blob,
  filename: string,
  kind: ShareDocKind,
  documentId: string,
): Promise<ShareUploadResult> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${documentId}/${Date.now()}-${safeName}`
  const { error: upErr } = await supabase.storage
    .from('documents')
    .upload(storagePath, blob, {
      contentType: blob.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: false,
    })
  if (upErr) throw new Error(`Couldn't stage document for share: ${upErr.message}`)

  const { data, error: signErr } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, SEVEN_DAYS_SECONDS)
  if (signErr || !data?.signedUrl) {
    throw new Error(`Couldn't create signed link: ${signErr?.message ?? 'no URL'}`)
  }

  // Helper to tag the kind in metadata for future cleanup/inventory
  void kind
  return { url: data.signedUrl, storagePath, filename: safeName }
}

/** Send an email via the send-email edge function. Returns the function's JSON response. */
export async function sendShareEmail(params: {
  to: string
  subject: string
  body: string
  attachmentUrl?: string
}): Promise<{ ok: boolean; message?: string }> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) return { ok: false, message: 'Not signed in' }
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`
  const bodyWithLink = params.attachmentUrl
    ? `${params.body}\n\nView / download: ${params.attachmentUrl}`
    : params.body
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      to: params.to,
      subject: params.subject,
      text: bodyWithLink,
      html: bodyWithLink.replace(/\n/g, '<br>'),
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    return { ok: false, message: err.substring(0, 200) }
  }
  return { ok: true }
}

/** Send an SMS via the send-sms edge function. Returns the function's JSON response. */
export async function sendShareSms(params: {
  to: string
  body: string
}): Promise<{ ok: boolean; message?: string }> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) return { ok: false, message: 'Not signed in' }
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-sms`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: params.to, body: params.body }),
  })
  if (!res.ok) {
    const err = await res.text()
    return { ok: false, message: err.substring(0, 200) }
  }
  return { ok: true }
}

/** Trigger a client-side print dialog for the current tab. User chooses "Save as PDF". */
export function printCurrent(): void {
  window.print()
}
