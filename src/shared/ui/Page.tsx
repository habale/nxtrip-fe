import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import type { PropsWithChildren, ReactNode } from 'react';

export type PageProps = PropsWithChildren<{
  title?: string;
  headerStart?: ReactNode;
  headerEnd?: ReactNode;
  padded?: boolean;
  hideHeader?: boolean;
}>;

export function Page({
  title,
  headerStart,
  headerEnd,
  padded = true,
  hideHeader,
  children,
}: PageProps) {
  return (
    <IonPage>
      {!hideHeader && (
        <IonHeader>
          <IonToolbar>
            {headerStart && <div slot="start">{headerStart}</div>}
            <IonTitle>{title}</IonTitle>
            {headerEnd && <div slot="end">{headerEnd}</div>}
          </IonToolbar>
        </IonHeader>
      )}
      <IonContent className={padded ? 'ion-padding' : undefined}>
        {children}
      </IonContent>
    </IonPage>
  );
}
