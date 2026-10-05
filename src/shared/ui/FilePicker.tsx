import { useRef } from 'react';

import { Button } from './Button';
import { Icon } from './Icon';

export type FilePickerProps = {
  label: string;
  accept?: string;
  disabled?: boolean;
  multiple?: boolean;
  onFilesSelect: (files: File[]) => void;
};

export function FilePicker({
  label,
  accept,
  disabled,
  multiple = false,
  onFilesSelect,
}: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        disabled={disabled}
        variant="quiet"
        onClick={() => inputRef.current?.click()}
      >
        <span className="ui-image-picker__label">
          <Icon name="attachment" />
          {label}
        </span>
      </Button>
      <input
        ref={inputRef}
        hidden
        accept={accept}
        aria-label={label}
        disabled={disabled}
        multiple={multiple}
        type="file"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFilesSelect(files);
          event.target.value = '';
        }}
      />
    </>
  );
}
