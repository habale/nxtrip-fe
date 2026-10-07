export type IconName =
  | 'add'
  | 'add_circle'
  | 'activity'
  | 'attachment'
  | 'back'
  | 'bookmark'
  | 'bus'
  | 'calendar'
  | 'camera'
  | 'cafe'
  | 'check'
  | 'close'
  | 'copy'
  | 'document'
  | 'drag'
  | 'directions'
  | 'edit'
  | 'ferry'
  | 'flight'
  | 'forward'
  | 'home'
  | 'hotel'
  | 'link'
  | 'location'
  | 'menu'
  | 'misc'
  | 'more'
  | 'person'
  | 'paste'
  | 'previous'
  | 'refresh'
  | 'restaurant'
  | 'savings'
  | 'search'
  | 'share'
  | 'settings'
  | 'shopping'
  | 'sightseeing'
  | 'ticket'
  | 'today'
  | 'train'
  | 'transfer'
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
  bus: 'directions_bus',
  calendar: 'calendar_month',
  camera: 'photo_camera',
  cafe: 'local_cafe',
  check: 'check',
  close: 'close',
  copy: 'content_copy',
  document: 'description',
  drag: 'drag_indicator',
  directions: 'near_me',
  edit: 'edit',
  ferry: 'directions_boat',
  flight: 'flight',
  forward: 'chevron_right',
  home: 'home',
  hotel: 'hotel',
  link: 'link',
  location: 'location_on',
  menu: 'menu',
  misc: 'category',
  more: 'more_horiz',
  person: 'person',
  paste: 'content_paste',
  previous: 'chevron_left',
  refresh: 'refresh',
  restaurant: 'restaurant',
  savings: 'savings',
  search: 'search',
  share: 'share',
  settings: 'settings',
  shopping: 'shopping_bag',
  sightseeing: 'temple_buddhist',
  ticket: 'confirmation_number',
  today: 'today',
  train: 'train',
  transfer: 'send_money',
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
