import { IonAlert, IonToast } from '@ionic/react';

export type ToastProps = {
  open: boolean;
  message: string;
  tone?: 'neutral' | 'success' | 'danger';
  durationMs?: number;
  onDismiss: () => void;
};

export function Toast({
  open,
  message,
  tone = 'neutral',
  durationMs = 3000,
  onDismiss,
}: ToastProps) {
  const color = tone === 'neutral' ? undefined : tone;

  return (
    <IonToast
      color={color}
      duration={durationMs}
      isOpen={open}
      message={message}
      position="bottom"
      onDidDismiss={onDismiss}
    />
  );
}

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  cancelLabel,
  confirmLabel,
  destructive,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <IonAlert
      buttons={[
        { text: cancelLabel, role: 'cancel' },
        {
          text: confirmLabel,
          role: destructive ? 'destructive' : 'confirm',
        },
      ]}
      header={title}
      isOpen={open}
      message={message}
      onDidDismiss={(event) => {
        const role = event.detail.role;
        if (role === 'confirm' || role === 'destructive') onConfirm();
        else onCancel();
      }}
    />
  );
}
