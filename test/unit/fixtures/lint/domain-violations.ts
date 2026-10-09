// Lint fixture for test/unit/domain-boundaries.test.ts. The test lints this
// text as if it lived under domain/, and every import and global below must
// be reported. eslint.config.js ignores this folder, so the default
// `npm run lint` never counts these on purpose errors.
import { FEATURES } from '@/lib/features'
import { lcaTimeToMs } from '../../src/lib/lcaTime'
import { jsonResponse } from '../../functions/utils/response'
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { env } from 'cloudflare:workers'

export function domainViolations() {
  const href = window.location.href
  const title = document.title
  const saved = localStorage.getItem('appearance')
  const agent = navigator.userAgent
  return [FEATURES, lcaTimeToMs, jsonResponse, useState, createRoot, env, href, title, saved, agent]
}
