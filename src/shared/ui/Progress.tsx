import { IonProgressBar, IonSkeletonText } from '@ionic/react';

export type ProgressBarProps = {
  label: string;
  value?: number;
  indeterminate?: boolean;
};

export function ProgressBar({ label, value, indeterminate }: ProgressBarProps) {
  return (
    <div
      aria-label={label}
      aria-valuemax={indeterminate ? undefined : 100}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuenow={
        indeterminate || value === undefined ? undefined : value * 100
      }
      className="ui-progress"
      role="progressbar"
    >
      <IonProgressBar
        type={indeterminate ? 'indeterminate' : 'determinate'}
        value={value}
      />
    </div>
  );
}

export type SkeletonProps = {
  width?: string;
  height?: string;
  animated?: boolean;
};

export function Skeleton({
  width = '100%',
  height = '1rem',
  animated = true,
}: SkeletonProps) {
  return (
    <IonSkeletonText
      animated={animated}
      className="ui-skeleton"
      style={{ width, height }}
    />
  );
}
