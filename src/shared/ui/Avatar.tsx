import { IonAvatar, IonImg } from '@ionic/react';

export type AvatarProps = {
  name: string;
  src?: string;
  size?: 'small' | 'medium' | 'large';
};

export function Avatar({ name, src, size = 'medium' }: AvatarProps) {
  const initial = name.trim().charAt(0).toLocaleUpperCase();

  return (
    <IonAvatar aria-label={name} className={`ui-avatar ui-avatar--${size}`}>
      {src ? (
        <IonImg alt="" src={src} />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </IonAvatar>
  );
}
