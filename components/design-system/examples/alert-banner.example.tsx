import { AlertBanner } from '@/components/ui/alert-banner';

export default function AlertBannerExample() {
  return (
    <AlertBanner advertencias={['No hemos encontrado una cena sin gluten para el jueves.', 'Revisa los ingredientes antes de cocinar.']} />
  );
}
