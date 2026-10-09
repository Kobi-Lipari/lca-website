// domain/contracts/index.ts
// The request and response contracts for the endpoints under functions/api.
// The server and the tests import the schemas; the site imports only their
// types (`import type`), so zod never reaches the site bundle.
export * from './common'
export * from './events'
export * from './registry'
