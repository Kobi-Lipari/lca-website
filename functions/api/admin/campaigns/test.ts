// functions/api/admin/campaigns/test.ts
import type { Env } from '../../../types'
import { isResponse, requireAdmin } from '../../../utils/auth'
import { sendTestEmail } from '../../../utils/campaigns'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../../../utils/response'

interface TestSendBody {
  email?: string
  subject?: string
  bodyHtml?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const body = await parseJsonBody<TestSendBody>(context.request)
  if (!body?.email?.trim() || !EMAIL_RE.test(body.email.trim())) {
    return errorResponse('A valid email address is required', 400)
  }
  if (!body.subject?.trim() || !body.bodyHtml?.trim()) {
    return errorResponse('subject and bodyHtml are required', 400)
  }

  // Prefixed so it's unmistakable in the recipient's inbox that this isn't
  // a real send to the full list.
  const result = await sendTestEmail(
    context.env,
    body.email.trim(),
    `[TEST] ${body.subject.trim()}`,
    body.bodyHtml,
  )

  if (!result.ok) return errorResponse(`Failed to send test email: ${result.error}`, 502)

  return jsonResponse({ sent: true })
}