import {
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonReorder,
  IonReorderGroup,
} from '@ionic/react';
import {
  useEffect,
  useRef,
  type PropsWithChildren,
  type ReactNode,
} from 'react';

import { Icon, type IconName } from './Icon';

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

export type ReorderListProps = PropsWithChildren<{
  className?: string;
  disabled?: boolean;
  onReorder: (from: number, to: number) => void;
}>;

export function ReorderList({
  children,
  className,
  disabled = false,
  onReorder,
}: ReorderListProps) {
  return (
    <IonReorderGroup
      className={className}
      disabled={disabled}
      onIonItemReorder={(event) => {
        const { from, to } = event.detail;
        event.detail.complete(false);
        onReorder(from, to);
      }}
    >
      {children}
    </IonReorderGroup>
  );
}

export function ReorderHandle({ label }: { label: string }) {
  return (
    <IonReorder aria-label={label} className="ui-reorder-handle">
      <Icon name="drag" />
    </IonReorder>
  );
}

export type SwipeItemProps = PropsWithChildren<{
  disabled?: boolean;
  editLabel: string;
  removeLabel: string;
  removeDisabled?: boolean;
  onEdit: () => void;
  onRemove: () => void;
}>;

export function SwipeItem({
  children,
  disabled = false,
  editLabel,
  removeLabel,
  removeDisabled = false,
  onEdit,
  onRemove,
}: SwipeItemProps) {
  const slidingRef = useRef<HTMLIonItemSlidingElement>(null);

  useEffect(() => {
    if (disabled) void slidingRef.current?.close();
  }, [disabled]);

  async function runAfterClose(action: () => void) {
    await slidingRef.current?.close();
    action();
  }

  return (
    <IonItemSliding
      ref={slidingRef}
      className="ui-swipe-item"
      disabled={disabled}
    >
      {children}
      <IonItemOptions
        side="start"
        onIonSwipe={() => void runAfterClose(onEdit)}
      >
        <IonItemOption
          color="primary"
          expandable
          onClick={() => void runAfterClose(onEdit)}
        >
          <Icon name="edit" />
          {editLabel}
        </IonItemOption>
      </IonItemOptions>
      <IonItemOptions
        side="end"
        onIonSwipe={() =>
          void runAfterClose(() => {
            if (!removeDisabled) onRemove();
          })
        }
      >
        <IonItemOption
          color="danger"
          disabled={removeDisabled}
          expandable
          onClick={() => void runAfterClose(onRemove)}
        >
          <Icon name="trash" />
          {removeLabel}
        </IonItemOption>
      </IonItemOptions>
    </IonItemSliding>
  );
}

export type SwipeStartActionItemProps = PropsWithChildren<{
  className?: string;
  actionLabel?: string;
  icon?: IconName;
  onAction?: () => void;
  endActionLabel?: string;
  endIcon?: IconName;
  endDisabled?: boolean;
  onEndAction?: () => void;
}>;

export function SwipeStartActionItem({
  children,
  className,
  actionLabel,
  icon = 'person',
  onAction,
  endActionLabel,
  endIcon = 'check',
  endDisabled = false,
  onEndAction,
}: SwipeStartActionItemProps) {
  const slidingRef = useRef<HTMLIonItemSlidingElement>(null);

  async function runAction() {
    await slidingRef.current?.close();
    onAction?.();
  }

  async function runEndAction() {
    await slidingRef.current?.close();
    if (!endDisabled) onEndAction?.();
  }

  return (
    <IonItemSliding ref={slidingRef} className="ui-swipe-item">
      {actionLabel && onAction && (
        <IonItemOptions side="start" onIonSwipe={() => void runAction()}>
          <IonItemOption
            color="primary"
            expandable
            onClick={() => void runAction()}
          >
            <Icon name={icon} />
            {actionLabel}
          </IonItemOption>
        </IonItemOptions>
      )}
      <IonItem
        className={`ui-item${className ? ` ${className}` : ''}`}
        lines="none"
      >
        {children}
      </IonItem>
      {endActionLabel && onEndAction && (
        <IonItemOptions side="end" onIonSwipe={() => void runEndAction()}>
          <IonItemOption
            color="success"
            disabled={endDisabled}
            expandable
            onClick={() => void runEndAction()}
          >
            <Icon name={endIcon} />
            {endActionLabel}
          </IonItemOption>
        </IonItemOptions>
      )}
    </IonItemSliding>
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
