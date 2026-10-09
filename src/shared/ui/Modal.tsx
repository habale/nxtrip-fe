import {
  IonContent,
  IonFooter,
  IonHeader,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import type { PropsWithChildren, ReactNode } from 'react';

export type ModalProps = PropsWithChildren<{
  open: boolean;
  title: string;
  footer?: ReactNode;
  dismissible?: boolean;
  onDismiss: () => void;
}>;

export function Modal({
  open,
  title,
  footer,
  dismissible = true,
  onDismiss,
  children,
}: ModalProps) {
  return (
    <IonModal
      backdropDismiss={dismissible}
      className="ui-modal"
      isOpen={open}
      onDidDismiss={onDismiss}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ui-modal__content">{children}</IonContent>
      {footer && (
        <IonFooter>
          <IonToolbar>
            <div className="ui-modal__footer">{footer}</div>
          </IonToolbar>
        </IonFooter>
      )}
    </IonModal>
  );
}
