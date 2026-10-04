import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
} from '@ionic/react';
import type { PropsWithChildren, ReactNode } from 'react';

export type CardProps = PropsWithChildren<{
  title?: ReactNode;
  subtitle?: ReactNode;
}>;

export function Card({ title, subtitle, children }: CardProps) {
  return (
    <IonCard className="ui-card">
      {(title || subtitle) && (
        <IonCardHeader>
          {subtitle && <IonCardSubtitle>{subtitle}</IonCardSubtitle>}
          {title && <IonCardTitle>{title}</IonCardTitle>}
        </IonCardHeader>
      )}
      <IonCardContent>{children}</IonCardContent>
    </IonCard>
  );
}
