import { IonLabel, IonSegment, IonSegmentButton } from '@ionic/react';

export type SegmentOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SegmentProps = {
  label: string;
  options: SegmentOption[];
  value?: string;
  disabled?: boolean;
  scrollable?: boolean;
  onValueChange?: (value: string) => void;
};

export function Segment({
  label,
  options,
  value,
  disabled,
  scrollable,
  onValueChange,
}: SegmentProps) {
  return (
    <IonSegment
      aria-label={label}
      className="ui-segment"
      disabled={disabled}
      scrollable={scrollable}
      value={value}
      onIonChange={(event) => {
        if (typeof event.detail.value === 'string') {
          onValueChange?.(event.detail.value);
        }
      }}
    >
      {options.map((option) => (
        <IonSegmentButton
          key={option.value}
          disabled={option.disabled}
          value={option.value}
        >
          <IonLabel>{option.label}</IonLabel>
        </IonSegmentButton>
      ))}
    </IonSegment>
  );
}
