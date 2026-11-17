'use client';

import { useState } from 'react';
import { PasswordInput } from '@/components/ui/password-input';

export default function PasswordInputExample() {
  const [password, setPassword] = useState('');

  return (
    <div className="flex max-w-sm flex-col gap-3">
      <PasswordInput value={password} onChange={setPassword} label="Contraseña" showPolicyHint />
    </div>
  );
}
