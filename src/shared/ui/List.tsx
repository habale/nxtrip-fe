import { IonItem, IonLabel, IonList } from '@ionic/react';
import type { PropsWithChildren, ReactNode } from 'react';

export function List({ children }: PropsWithChildren) {
  return <IonList className="ui-list">{children}</IonList>;
}

export type ItemProps = PropsWithChildren<{
  className?: string;
  dataNodeId?: string;
}>;

export function Item({ children, className, dataNodeId }: ItemProps) {
  return (
    <IonItem
      className={`ui-item${className ? ` ${className}` : ''}`}
      data-node-id={dataNodeId}
      lines="none"
    >
      {children}
    </IonItem>
  );
}

export type ListItemProps = {
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  disabled?: boolean;
  onClick?: () => void;
};

export function ListItem({
  title,
  description,
  leading,
  trailing,
  href,
  disabled,
  onClick,
}: ListItemProps) {
  return (
    <IonItem
      button={Boolean(href || onClick)}
      className="ui-list-item"
      disabled={disabled}
      detail={Boolean(href)}
      routerLink={href}
      onClick={onClick}
    >
      {leading}
      <IonLabel>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </IonLabel>
      {trailing}
    </IonItem>
  );
}
