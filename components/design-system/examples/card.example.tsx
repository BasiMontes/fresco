import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CardExample() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Lentejas con verduras</CardTitle>
          <CardDescription>30 minutos, para 4 personas</CardDescription>
        </CardHeader>
        <CardContent>Un plato de cuchara fácil para toda la semana.</CardContent>
      </Card>
      <Card variant="insight">
        <CardHeader>
          <CardTitle>Fresco ha aprendido algo</CardTitle>
        </CardHeader>
        <CardContent>Sueles cenar ligero entre semana.</CardContent>
      </Card>
    </div>
  );
}
