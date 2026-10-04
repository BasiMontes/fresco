// Ambient declarations so `tsc -p tsconfig.edge-tests.json` can type-check the Edge Function
// tests (bun:test) together with the Deno sources they import. Real type-checking of the
// functions themselves stays with `deno check` (see supabase/functions/deno.json). Only the
// surface the functions actually use is declared; this file is NOT part of the app's tsc.
declare const Deno: {
  env: { get(key: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): unknown
}

declare module 'web-push' {
  const webpush: {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void
    sendNotification(subscription: unknown, payload?: string, options?: unknown): Promise<{ statusCode: number }>
  }
  export default webpush
}
