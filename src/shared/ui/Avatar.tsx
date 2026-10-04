import { IonAvatar, IonImg } from '@ionic/react';

export type AvatarProps = {
  name: string;
  src?: string;
  size?: 'small' | 'medium' | 'large';
  initialCount?: 1 | 2;
};

function getInitials(name: string, count: 1 | 2) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (count === 2 && words.length > 1) {
    return `${words[0].charAt(0)}${words.at(-1)?.charAt(0) ?? ''}`.toLocaleUpperCase();
  }

  return words.join('').slice(0, count).toLocaleUpperCase();
}

export function Avatar({
  name,
  src,
  size = 'medium',
  initialCount = 1,
}: AvatarProps) {
  const initials = getInitials(name, initialCount);

  return (
    <IonAvatar aria-label={name} className={`ui-avatar ui-avatar--${size}`}>
      {src ? (
        <IonImg alt="" src={src} />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </IonAvatar>
  );
}
