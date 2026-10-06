import { Bell, Heart } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MenuHeaderProps {
  nombre: string | null
  hasUnseenNotifications: boolean
}

export function MenuHeader({ nombre, hasUnseenNotifications }: MenuHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-h2">{nombre ? `¡Hola, ${nombre}!` : '¡Hola!'}</h1>
        <p className="mt-1 text-body-md text-tertiary">Tu menú de hoy, listo.</p>
      </div>
      <div className="flex gap-2">
        <Link href="/favorites" className={cn(buttonVariants({ variant: 'icon', size: 'sm' }))} aria-label="Favoritos" data-testid="favoritos_button">
          <Heart className="size-6" />
        </Link>
        <Link href="/notifications" className={cn(buttonVariants({ variant: 'icon', size: 'sm' }), 'relative')} aria-label="Notificaciones" data-testid="notificaciones_button">
          <Bell className="size-6" />
          {hasUnseenNotifications && (
            <span
              aria-hidden="true"
              data-testid="notificaciones_badge"
              className="absolute right-1.5 top-1.5 size-2 rounded-full bg-error"
            />
          )}
        </Link>
      </div>
    </div>
  );
}
