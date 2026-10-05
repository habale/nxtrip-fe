import {
  IonContent,
  IonHeader,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import type { PropsWithChildren } from 'react';

export type ModalProps = PropsWithChildren<{
  open: boolean;
  title: string;
  dismissible?: boolean;
  onDismiss: () => void;
}>;

export function Modal({
  open,
  title,
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
    </IonModal>
  );
}
