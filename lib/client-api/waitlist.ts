/** FRESCO-888: calls `POST /api/waitlist`. Returns `true` when the address is on the list, `false` on any failure. */
export async function joinWaitlist(email: string): Promise<boolean> {
  try {
    const response = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, consent: true }),
    });
    return response.ok;
  }
  catch {
    return false;
  }
}
