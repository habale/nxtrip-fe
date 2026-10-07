import {
  IonContent,
  IonHeader,
  IonPage,
  IonRefresher,
  IonRefresherContent,
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
  onRefresh?: () => Promise<unknown> | unknown;
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
  onRefresh,
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
        {onRefresh && (
          <IonRefresher
            slot="fixed"
            onIonRefresh={(event) => {
              Promise.resolve(onRefresh()).finally(() => {
                event.detail.complete();
              });
            }}
          >
            <IonRefresherContent />
          </IonRefresher>
        )}
        {children}
      </IonContent>
    </IonPage>
  );
}
