import { IonBadge } from '@ionic/react';
import type { PropsWithChildren } from 'react';

export type BadgeTone = 'brand' | 'info' | 'success' | 'warning' | 'danger';
export type BadgeProps = PropsWithChildren<{ tone?: BadgeTone }>;

const colorByTone = {
  brand: 'primary',
  info: 'secondary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
} as const;

export function Badge({ tone = 'brand', children }: BadgeProps) {
  return <IonBadge color={colorByTone[tone]}>{children}</IonBadge>;
}
