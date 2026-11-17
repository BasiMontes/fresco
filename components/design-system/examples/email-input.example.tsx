'use client';

import { useState } from 'react';
import { EmailInput } from '@/components/ui/email-input';

export default function EmailInputExample() {
  const [email, setEmail] = useState('');

  return (
    <div className="flex max-w-sm flex-col gap-3">
      <EmailInput value={email} onChange={setEmail} />
      <p className="text-body-sm text-tertiary">Escribe un correo y sal del campo para ver la validación.</p>
    </div>
  );
}
