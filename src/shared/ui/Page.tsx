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
  headerContent?: ReactNode;
  secondaryHeaderContent?: ReactNode;
  headerClassName?: string;
  toolbarClassName?: string;
  secondaryToolbarClassName?: string;
  padded?: boolean;
  hideHeader?: boolean;
}>;

export function Page({
  title,
  headerStart,
  headerEnd,
  headerContent,
  secondaryHeaderContent,
  headerClassName,
  toolbarClassName,
  secondaryToolbarClassName,
  padded = true,
  hideHeader,
  children,
}: PageProps) {
  return (
    <IonPage>
      {!hideHeader && (
        <IonHeader className={headerClassName}>
          <IonToolbar className={toolbarClassName}>
            {headerContent ?? (
              <>
                {headerStart && <div slot="start">{headerStart}</div>}
                {title && <IonTitle>{title}</IonTitle>}
                {headerEnd && <div slot="end">{headerEnd}</div>}
              </>
            )}
          </IonToolbar>
          {secondaryHeaderContent && (
            <IonToolbar className={secondaryToolbarClassName}>
              {secondaryHeaderContent}
            </IonToolbar>
          )}
        </IonHeader>
      )}
      <IonContent className={padded ? 'ion-padding' : undefined}>
        {children}
      </IonContent>
    </IonPage>
  );
}
