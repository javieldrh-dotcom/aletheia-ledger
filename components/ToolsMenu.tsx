"use client";

import type { ReactNode } from "react";

interface ToolsMenuProps {
  children: ReactNode;
}

/**
 * Contenedor de herramientas del Dashboard, cada una como una seccion
 * plegable independiente (CollapsibleSection). Nuevas herramientas
 * futuras se agregan aqui como hijos adicionales, sin afectar el
 * flujo principal de carga/analisis de datos.
 */
export function ToolsMenu({ children }: ToolsMenuProps) {
  return (
    <div className="space-y-2">
      <h2 className="px-1 font-mono text-xs uppercase tracking-wide text-ink-muted">
        Herramientas
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}