import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import type { PropsWithChildren, ReactNode } from 'react';

export type PageProps = PropsWithChildren<{
  title: string;
  headerStart?: ReactNode;
  headerEnd?: ReactNode;
  padded?: boolean;
}>;

export function Page({
  title,
  headerStart,
  headerEnd,
  padded = true,
  children,
}: PageProps) {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          {headerStart}
          <IonTitle>{title}</IonTitle>
          {headerEnd}
        </IonToolbar>
      </IonHeader>
      <IonContent className={padded ? 'ion-padding' : undefined}>
        {children}
      </IonContent>
    </IonPage>
  );
}
