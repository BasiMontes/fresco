/** FRESCO-888: calls `POST /api/waitlist`. Returns `true` when the signup was registered and the confirmation email is on its way (FRESCO-1008), `false` on any failure. */
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
