export type IconName =
  | 'add'
  | 'add_circle'
  | 'activity'
  | 'attachment'
  | 'back'
  | 'bookmark'
  | 'calendar'
  | 'camera'
  | 'cafe'
  | 'check'
  | 'close'
  | 'document'
  | 'directions'
  | 'edit'
  | 'ferry'
  | 'flight'
  | 'forward'
  | 'home'
  | 'hotel'
  | 'location'
  | 'menu'
  | 'misc'
  | 'more'
  | 'person'
  | 'paste'
  | 'previous'
  | 'restaurant'
  | 'search'
  | 'settings'
  | 'shopping'
  | 'sightseeing'
  | 'ticket'
  | 'train'
  | 'trash'
  | 'tune'
  | 'vehicle'
  | 'walk'
  | 'wallet'
  | 'others';

export type IconProps = {
  name: IconName;
  label?: string;
  size?: 'small' | 'medium' | 'large';
};

const materialSymbolByName: Record<IconName, string> = {
  add: 'add',
  add_circle: 'add_circle',
  activity: 'attractions',
  attachment: 'attach_file',
  back: 'arrow_back',
  bookmark: 'bookmark',
  calendar: 'calendar_month',
  camera: 'photo_camera',
  cafe: 'local_cafe',
  check: 'check',
  close: 'close',
  document: 'description',
  directions: 'near_me',
  edit: 'edit',
  ferry: 'directions_boat',
  flight: 'flight',
  forward: 'chevron_right',
  home: 'home',
  hotel: 'hotel',
  location: 'location_on',
  menu: 'menu',
  misc: 'category',
  more: 'more_horiz',
  person: 'person',
  paste: 'content_paste',
  previous: 'chevron_left',
  restaurant: 'restaurant',
  search: 'search',
  settings: 'settings',
  shopping: 'shopping_bag',
  sightseeing: 'temple_buddhist',
  ticket: 'confirmation_number',
  train: 'train',
  trash: 'delete',
  tune: 'tune',
  vehicle: 'directions_car',
  walk: 'directions_walk',
  wallet: 'account_balance_wallet',
  others: 'receipt_long',
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
