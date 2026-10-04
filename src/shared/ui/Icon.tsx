export type IconName =
  | 'add'
  | 'attachment'
  | 'back'
  | 'bookmark'
  | 'calendar'
  | 'camera'
  | 'check'
  | 'close'
  | 'document'
  | 'forward'
  | 'home'
  | 'location'
  | 'menu'
  | 'more'
  | 'person'
  | 'search'
  | 'settings'
  | 'trash'
  | 'tune'
  | 'wallet';

export type IconProps = {
  name: IconName;
  label?: string;
  size?: 'small' | 'medium' | 'large';
};

const materialSymbolByName: Record<IconName, string> = {
  add: 'add',
  attachment: 'attach_file',
  back: 'arrow_back',
  bookmark: 'bookmark',
  calendar: 'calendar_month',
  camera: 'photo_camera',
  check: 'check',
  close: 'close',
  document: 'description',
  forward: 'chevron_right',
  home: 'home',
  location: 'location_on',
  menu: 'menu',
  more: 'more_horiz',
  person: 'person',
  search: 'search',
  settings: 'settings',
  trash: 'delete',
  tune: 'tune',
  wallet: 'account_balance_wallet',
};

export function Icon({ name, label, size = 'medium' }: IconProps) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={`ui-icon ui-icon--${size}`}
      role={label ? 'img' : undefined}
    >
      {materialSymbolByName[name]}
    </span>
  );
}
