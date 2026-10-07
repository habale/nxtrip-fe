import {
  IonFab,
  IonFabButton,
  IonFabList,
  useIonViewDidEnter,
  useIonViewWillLeave,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { Icon, type IconName } from './Icon';

export type FabMenuAction = {
  label: string;
  icon: IconName;
  disabled?: boolean;
  onClick: () => void;
};

export type FabMenuProps = {
  label: string;
  icon?: IconName;
  actions: FabMenuAction[];
};

function useKeyboardOpen(enabled: boolean) {
  const [focusedField, setFocusedField] = useState(false);
  const [viewportReduced, setViewportReduced] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const editableSelector =
      'input, textarea, select, ion-input, ion-textarea, ion-select, ion-datetime';
    const viewport = window.visualViewport;
    let largestViewportHeight = viewport?.height ?? window.innerHeight;

    const updateViewport = () => {
      const height = viewport?.height ?? window.innerHeight;
      largestViewportHeight = Math.max(largestViewportHeight, height);
      setViewportReduced(largestViewportHeight - height > 150);
    };
    const updateFocus = (event: FocusEvent) => {
      setFocusedField(
        event.target instanceof Element &&
          event.target.matches(editableSelector),
      );
    };
    const clearFocus = () => setFocusedField(false);

    document.addEventListener('focusin', updateFocus);
    document.addEventListener('focusout', clearFocus);
    viewport?.addEventListener('resize', updateViewport);
    window.addEventListener('resize', updateViewport);

    return () => {
      document.removeEventListener('focusin', updateFocus);
      document.removeEventListener('focusout', clearFocus);
      viewport?.removeEventListener('resize', updateViewport);
      window.removeEventListener('resize', updateViewport);
    };
  }, [enabled]);

  return enabled && (focusedField || viewportReduced);
}

export type FabButtonProps = {
  label: string;
  icon: IconName;
  hideWhenKeyboardOpen?: boolean;
  onClick: () => void;
};

export function FabButton({
  label,
  icon,
  hideWhenKeyboardOpen = false,
  onClick,
}: FabButtonProps) {
  const [pageActive, setPageActive] = useState(true);
  const keyboardOpen = useKeyboardOpen(hideWhenKeyboardOpen);
  useIonViewDidEnter(() => setPageActive(true));
  useIonViewWillLeave(() => setPageActive(false));
  if (keyboardOpen || !pageActive) return null;

  return createPortal(
    <IonFab className="ui-fab-menu" horizontal="end" vertical="bottom">
      <IonFabButton aria-label={label} onClick={onClick}>
        <Icon name={icon} size="large" />
        <span className="sr-only">{label}</span>
      </IonFabButton>
    </IonFab>,
    document.body,
  );
}

export function FabMenu({ label, icon = 'more', actions }: FabMenuProps) {
  const [open, setOpen] = useState(false);
  const [pageActive, setPageActive] = useState(true);
  useIonViewDidEnter(() => setPageActive(true));
  useIonViewWillLeave(() => {
    setOpen(false);
    setPageActive(false);
  });

  if (!pageActive) return null;

  return createPortal(
    <IonFab
      activated={open}
      className="ui-fab-menu"
      horizontal="end"
      vertical="bottom"
    >
      <IonFabButton
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={open ? 'close' : icon} size="large" />
        <span className="sr-only">{label}</span>
      </IonFabButton>
      <IonFabList side="top">
        {actions.map((action) => (
          <IonFabButton
            key={action.label}
            aria-label={action.label}
            className="ui-fab-menu__action"
            data-label={action.label}
            disabled={action.disabled}
            onClick={() => {
              setOpen(false);
              action.onClick();
            }}
          >
            <Icon name={action.icon} />
            <span className="sr-only">{action.label}</span>
          </IonFabButton>
        ))}
      </IonFabList>
    </IonFab>,
    document.body,
  );
}
