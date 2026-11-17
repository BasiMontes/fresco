import { Card } from '@/components/ui/card';
import { Reveal } from '@/components/ui/reveal';

export default function RevealExample() {
  return (
    <Reveal className="max-w-sm">
      <Card className="p-4">
        <p className="text-body-sm text-text">Esta tarjeta aparece al entrar en pantalla.</p>
      </Card>
    </Reveal>
  );
}
