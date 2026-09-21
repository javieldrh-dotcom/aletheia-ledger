"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Orbit, Activity, Flame, type LucideIcon } from "lucide-react";

/**
 * Barra lateral de navegacion de la plataforma Aletheia Ledger.
 *
 * ALCANCE (2026-09-20, decision explicita del usuario): se lanza SOLO
 * con el pilar que ya esta construido y validado -- Exoplanetas, con
 * sus dos submodulos (Vetting de Transitos y Auditoria Estelar). No se
 * listan pilares futuros -- ya estan diseñados y validados en el
 * sandbox, pero se dejan fuera para no prometer funcionalidad que
 * todavia no existe.
 *
 * VISUAL (2026-09-20, ajuste tras comparar con el mockup de
 * referencia): se agregan iconos por item de navegacion usando
 * lucide-react (misma libreria que proponia el mockup original,
 * ligera y sin riesgo de licencia). El color de acento, el radio de
 * bordes y el fondo con degradado se definen centralmente en
 * globals.css -- este componente no fija ningun color a mano.
 */

interface PillarLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface ActivePillar {
  key: string;
  label: string;
  kind: "active";
  icon: LucideIcon;
  links: PillarLink[];
}

interface ComingSoonPillar {
  key: string;
  label: string;
  kind: "comingSoon";
  href: string;
  icon: LucideIcon;
}

type Pillar = ActivePillar | ComingSoonPillar;

const PILLARS: readonly Pillar[] = [
  {
    key: "exoplanetas",
    label: "Exoplanetas",
    kind: "active",
    icon: Orbit,
    links: [
      { label: "Vetting de Tránsitos", href: "/", icon: Activity },
      { label: "Auditoría Estelar", href: "/auditoria-estelar", icon: Flame },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col justify-between border-r border-line bg-void p-6">
      <div>
        <div className="mb-8 flex items-center gap-2">
          <div className="h-6 w-6 rounded-tr-xl rounded-bl-xl bg-accent" />
          <h1 className="font-serif text-lg font-bold tracking-wide text-ink">
            Aletheia Ledger
          </h1>
        </div>

        <nav className="space-y-5">
          {PILLARS.map((pillar) => {
            if (pillar.kind === "active") {
              const PillarIcon = pillar.icon;
              return (
                <div key={pillar.key}>
                  <p className="mb-1 flex items-center gap-1.5 px-3 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                    <PillarIcon className="h-3 w-3" strokeWidth={2} />
                    {pillar.label}
                  </p>
                  <div className="space-y-0.5">
                    {pillar.links.map((link) => {
                      const isActive = pathname === link.href;
                      const LinkIcon = link.icon;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={`flex items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors ${
                            isActive
                              ? "border-l-2 border-accent bg-surface-raised text-accent"
                              : "text-ink-muted hover:text-ink"
                          }`}
                        >
                          <LinkIcon className="h-4 w-4" strokeWidth={1.75} />
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const isActive = pathname === pillar.href;
            const PillarIcon = pillar.icon;
            return (
              <Link
                key={pillar.key}
                href={pillar.href}
                className={`flex items-center justify-between rounded-sm px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-surface-raised text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                <span className="flex items-center gap-2">
                  <PillarIcon className="h-4 w-4" strokeWidth={1.75} />
                  {pillar.label}
                </span>
                <span className="rounded-sm border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-ink-muted">
                  Pronto
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <p className="font-mono text-[10px] uppercase leading-relaxed tracking-wide text-ink-muted">
        Plataforma de auditoría de datos astronómicos — 100% client-side
      </p>
    </aside>
  );
}
