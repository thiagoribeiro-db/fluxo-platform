'use client';

/**
 * Switch (toggle on/off) — wrapper Radix com estilo do projeto.
 *
 * Vantagens vs `<input type="checkbox">` custom:
 *  - role="switch" + aria-checked corretos
 *  - Keyboard: Space toggla, Enter NÃO toggla (padrão a11y)
 *  - Focus visible com ring
 *  - Disabled state com cursor não-permitido
 */

import * as SwitchPrimitive from '@radix-ui/react-switch';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';

export const Switch = forwardRef<
  ElementRef<typeof SwitchPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className = '', ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={`peer inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blip-purple/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-blip-purple data-[state=unchecked]:bg-gray-300 ${className}`}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block h-3 w-3 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-3.5 data-[state=unchecked]:translate-x-0.5" />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';
