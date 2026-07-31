import Image from 'next/image';

const FOOTER_LINKS = ['Privacidad', 'Términos', 'Contacto'];

export function SiteFooter() {
  return (
    <footer className="bg-primary px-4 py-10 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Image src="/brand/logo-negativo.svg" alt="Fresco" width={90} height={27} />
          <div className="flex flex-wrap gap-5">
            {FOOTER_LINKS.map(label => (
              <a key={label} href="#" className="text-caption text-accent-300">
                {label}
              </a>
            ))}
          </div>
        </div>
        <p className="border-t border-accent-600 pt-5 text-caption text-accent-500">
          © 2025 Fresco · Hecho con cariño (y muchas lentejas)
        </p>
      </div>
    </footer>
  );
}
