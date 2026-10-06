import { IonButton, IonItem, IonList, IonPopover } from '@ionic/react';
import { useState, type MouseEvent } from 'react';

import { Icon, type IconName } from './Icon';

export type ContextMenuItem = {
  label: string;
  icon: IconName;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: () => void;
};

export type ContextMenuProps = {
  label: string;
  items: ContextMenuItem[];
  disabled?: boolean;
};

export function ContextMenu({ label, items, disabled }: ContextMenuProps) {
  const [event, setEvent] = useState<Event | undefined>();

  function openMenu(clickEvent: MouseEvent<HTMLIonButtonElement>) {
    setEvent(clickEvent.nativeEvent);
  }

  return (
    <>
      <IonButton
        aria-label={label}
        className="ui-icon-button ui-icon-button--medium"
        disabled={disabled}
        fill="clear"
        onClick={openMenu}
      >
        <Icon name="more" />
        <span className="sr-only">{label}</span>
      </IonButton>
      <IonPopover
        dismissOnSelect
        event={event}
        isOpen={Boolean(event)}
        onDidDismiss={() => setEvent(undefined)}
      >
        <IonList className="ui-context-menu" lines="none">
          {items.map((item) => (
            <IonItem
              button
              detail={false}
              disabled={item.disabled}
              key={item.label}
              className={item.destructive ? 'ui-context-menu__danger' : ''}
              onClick={item.onSelect}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </IonItem>
          ))}
        </IonList>
      </IonPopover>
    </>
  );
}
