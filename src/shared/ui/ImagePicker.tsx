import { useRef } from 'react';

import { Button } from './Button';
import { Icon } from './Icon';

export type ImagePickerProps = {
  label: string;
  disabled?: boolean;
  onFileSelect: (file: File) => void;
};

export function ImagePicker({
  label,
  disabled,
  onFileSelect,
}: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        disabled={disabled}
        variant="quiet"
        onClick={() => inputRef.current?.click()}
      >
        <span className="ui-image-picker__label">
          <Icon name="camera" />
          {label}
        </span>
      </Button>
      <input
        ref={inputRef}
        hidden
        accept="image/jpeg,image/png,image/webp"
        aria-label={label}
        disabled={disabled}
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelect(file);
          event.target.value = '';
        }}
      />
    </>
  );
}
