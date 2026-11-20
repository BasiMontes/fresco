import { AlertBanner } from '@/components/ui/alert-banner';

export default function AlertBannerExample() {
  return (
    <AlertBanner
      title="Sobre tu menú de esta semana"
      advertencias={['No hemos encontrado una cena sin gluten para el jueves.', 'Revisa los ingredientes antes de cocinar.']}
    />
  );
}
