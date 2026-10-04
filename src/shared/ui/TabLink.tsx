import { IonRouterLink } from '@ionic/react';
import type { PropsWithChildren } from 'react';

export type TabLinkProps = PropsWithChildren<{
  href: string;
  selected?: boolean;
  ariaLabel?: string;
}>;

export function TabLink({
  children,
  href,
  selected = false,
  ariaLabel,
}: TabLinkProps) {
  return (
    <IonRouterLink
      aria-label={ariaLabel}
      aria-current={selected ? 'page' : undefined}
      className={`ui-tab-link${selected ? ' ui-tab-link--selected' : ''}`}
      routerDirection="none"
      routerLink={href}
    >
      {children}
    </IonRouterLink>
  );
}
