import { useState } from 'react';

import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Chip,
  ConfirmDialog,
  DatePicker,
  Icon,
  IconButton,
  LanguageSwitcher,
  List,
  ListItem,
  Modal,
  Page,
  ProgressBar,
  RadioGroup,
  SearchField,
  Segment,
  Select,
  Skeleton,
  Spinner,
  TextArea,
  TextInput,
  Toast,
  Toggle,
  type IconName,
} from '../../../shared/ui';

import './ui-showcase.css';

const iconNames: IconName[] = [
  'add',
  'attachment',
  'back',
  'bookmark',
  'calendar',
  'check',
  'close',
  'document',
  'forward',
  'home',
  'location',
  'menu',
  'more',
  'person',
  'search',
  'settings',
  'trash',
  'wallet',
];

const colors = [
  ['Primary', '--color-primary'],
  ['Strong', '--color-strong'],
  ['Soft', '--color-soft'],
  ['Secondary', '--color-secondary'],
  ['Secondary strong', '--color-secondary-strong'],
  ['Tertiary', '--color-tertiary'],
  ['Canvas', '--color-canvas'],
  ['Surface', '--color-surface'],
  ['Surface muted', '--color-surface-muted'],
  ['Ink', '--color-ink'],
  ['Ink muted', '--color-ink-muted'],
  ['Border', '--color-border'],
  ['Positive', '--color-positive'],
  ['Positive soft', '--color-positive-soft'],
  ['Negative', '--color-negative'],
  ['Negative soft', '--color-negative-soft'],
  ['Warning', '--color-warning'],
  ['Warning soft', '--color-warning-soft'],
] as const;

const categories = [
  ['Moving', '--color-category-moving', '--color-category-moving-bg'],
  ['Dining', '--color-category-dining', '--color-category-dining-bg'],
  ['Cafe', '--color-category-cafe', '--color-category-cafe-bg'],
  ['Lodging', '--color-category-lodging', '--color-category-lodging-bg'],
  ['Shopping', '--color-category-shopping', '--color-category-shopping-bg'],
  [
    'Sightseeing',
    '--color-category-sightseeing',
    '--color-category-sightseeing-bg',
  ],
  ['Activity', '--color-category-activity', '--color-category-activity-bg'],
  ['Misc', '--color-category-misc', '--color-category-misc-bg'],
] as const;

export function UiShowcasePage() {
  const [segment, setSegment] = useState('itinerary');
  const [select, setSelect] = useState('VND');
  const [radio, setRadio] = useState('equal');
  const [checked, setChecked] = useState(true);
  const [toggled, setToggled] = useState(true);
  const [chipSelected, setChipSelected] = useState(true);
  const [search, setSearch] = useState('Hanoi');
  const [name, setName] = useState('Autumn in Kyoto');
  const [notes, setNotes] = useState('Remember to reserve train seats.');
  const [date, setDate] = useState('2026-10-04');
  const [modalOpen, setModalOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);

  return (
    <Page title="NxTrip UI kit">
      <main className="showcase">
        <header className="showcase-hero">
          <Badge tone="brand">Design playground</Badge>
          <h1>Shared components</h1>
          <p>
            Edit the theme or a shared adapter and compare every component here.
          </p>
          <LanguageSwitcher />
        </header>

        <section className="showcase-section" aria-labelledby="type-heading">
          <div className="showcase-heading">
            <p>Foundations</p>
            <h2 id="type-heading">Typography &amp; color</h2>
          </div>
          <Card>
            <div className="type-specimen">
              <h1>Explore farther.</h1>
              <h2>Your next trip, beautifully organized.</h2>
              <p>
                Plus Jakarta Sans keeps dense planning details friendly and easy
                to scan.
              </p>
              <small>Small text · Flight VN 210 · 08:30</small>
            </div>
          </Card>
          <div className="swatch-grid">
            {colors.map(([label, token]) => (
              <article className="swatch" key={token}>
                <span style={{ background: `var(${token})` }} />
                <strong>{label}</strong>
                <code>{token}</code>
              </article>
            ))}
          </div>
          <div className="category-grid">
            {categories.map(([label, foreground, background]) => (
              <span
                className="category-swatch"
                key={label}
                style={{
                  background: `var(${background})`,
                  color: `var(${foreground})`,
                }}
              >
                <Icon name={label === 'Dining' ? 'location' : 'bookmark'} />
                {label}
              </span>
            ))}
          </div>
        </section>

        <section className="showcase-section" aria-labelledby="actions-heading">
          <div className="showcase-heading">
            <p>Actions</p>
            <h2 id="actions-heading">Buttons &amp; icons</h2>
          </div>
          <Card title="Button variants" subtitle="Default, state, and scale">
            <div className="showcase-row">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="quiet">Quiet</Button>
              <Button variant="danger">Danger</Button>
              <Button disabled>Disabled</Button>
              <Button loading>Loading</Button>
            </div>
            <div className="showcase-row showcase-row--end">
              <Button size="small">Small</Button>
              <Button size="medium">Medium</Button>
              <Button size="large">Large</Button>
            </div>
            <Button block>Full-width action</Button>
          </Card>
          <Card title="Icon buttons">
            <div className="showcase-row">
              <IconButton icon="add" label="Add" variant="primary" />
              <IconButton icon="settings" label="Settings" />
              <IconButton icon="trash" label="Delete" variant="danger" />
              <IconButton icon="more" label="More" disabled />
            </div>
          </Card>
          <Card title="Material Symbols">
            <div className="icon-grid">
              {iconNames.map((icon) => (
                <div key={icon}>
                  <Icon name={icon} size="large" />
                  <span>{icon}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="showcase-section" aria-labelledby="status-heading">
          <div className="showcase-heading">
            <p>Labels</p>
            <h2 id="status-heading">Badges, chips &amp; avatars</h2>
          </div>
          <Card>
            <div className="showcase-row">
              <Badge>Brand</Badge>
              <Badge tone="info">Info</Badge>
              <Badge tone="success">Confirmed</Badge>
              <Badge tone="warning">Pending</Badge>
              <Badge tone="danger">Cancelled</Badge>
            </div>
            <div className="showcase-row">
              <Chip
                label="Selected"
                selected={chipSelected}
                onClick={() => setChipSelected((value) => !value)}
              />
              <Chip label="Default" onClick={() => undefined} />
              <Chip label="Disabled" disabled />
            </div>
            <div className="showcase-row showcase-row--end">
              <Avatar name="Nolan" size="small" />
              <Avatar name="Nolan" />
              <Avatar name="Nolan" size="large" />
            </div>
          </Card>
        </section>

        <section className="showcase-section" aria-labelledby="forms-heading">
          <div className="showcase-heading">
            <p>Forms</p>
            <h2 id="forms-heading">Inputs &amp; selection</h2>
          </div>
          <div className="showcase-columns">
            <Card title="Text fields">
              <div className="showcase-stack">
                <TextInput
                  label="Trip name"
                  value={name}
                  helperText="Give your adventure a memorable name."
                  onValueChange={setName}
                />
                <TextInput
                  label="Email"
                  value="not-an-email"
                  errorText="Enter a valid email address."
                />
                <TextInput label="Disabled" value="Locked value" disabled />
                <TextArea
                  label="Notes"
                  value={notes}
                  maxlength={180}
                  onValueChange={setNotes}
                />
                <SearchField
                  label="Search places"
                  value={search}
                  placeholder="Search places"
                  onValueChange={setSearch}
                />
              </div>
            </Card>
            <Card title="Selection controls">
              <div className="showcase-stack">
                <Select
                  label="Currency"
                  value={select}
                  helperText="Used for the trip ledger."
                  options={[
                    { value: 'VND', label: 'Vietnamese đồng' },
                    { value: 'JPY', label: 'Japanese yen' },
                    { value: 'USD', label: 'US dollar' },
                  ]}
                  onValueChange={(value) =>
                    setSelect(typeof value === 'string' ? value : value[0])
                  }
                />
                <Checkbox
                  label="Include checked baggage"
                  checked={checked}
                  helperText="Up to 23 kg"
                  onCheckedChange={setChecked}
                />
                <Checkbox label="Unavailable option" disabled />
                <Toggle
                  label="Trip notifications"
                  checked={toggled}
                  helperText="Receive changes from collaborators."
                  onCheckedChange={setToggled}
                />
                <RadioGroup
                  label="Split expenses"
                  value={radio}
                  options={[
                    { value: 'equal', label: 'Equally' },
                    { value: 'amount', label: 'By exact amount' },
                    { value: 'shares', label: 'By shares', disabled: true },
                  ]}
                  onValueChange={setRadio}
                />
              </div>
            </Card>
          </div>
          <Card title="Segments &amp; date">
            <div className="showcase-stack">
              <Segment
                label="Trip section"
                value={segment}
                options={[
                  { value: 'info', label: 'Info' },
                  { value: 'itinerary', label: 'Itinerary' },
                  { value: 'ledger', label: 'Ledger' },
                ]}
                onValueChange={setSegment}
              />
              <DatePicker
                label="Departure date"
                value={date}
                onValueChange={setDate}
              />
            </div>
          </Card>
        </section>

        <section className="showcase-section" aria-labelledby="content-heading">
          <div className="showcase-heading">
            <p>Content</p>
            <h2 id="content-heading">Cards, lists &amp; progress</h2>
          </div>
          <Card title="Kyoto in autumn" subtitle="October 4–10 · 4 travelers">
            A compact card for grouped trip information.
          </Card>
          <List>
            <ListItem
              leading={<Icon name="location" />}
              title="Fushimi Inari Shrine"
              description="Sightseeing · 08:30"
              trailing={<Badge tone="success">Saved</Badge>}
              onClick={() => undefined}
            />
            <ListItem
              leading={<Icon name="wallet" />}
              title="Dinner at Gion Kappa"
              description="Dining · ¥8,400"
              trailing={<Icon name="forward" />}
              href="#content-heading"
            />
            <ListItem title="Unavailable activity" disabled />
          </List>
          <Card title="Loading states">
            <div className="showcase-stack">
              <ProgressBar label="Trip completion" value={0.68} />
              <ProgressBar label="Uploading attachments" indeterminate />
              <div className="showcase-row">
                <Spinner label="Loading" size="small" />
                <Spinner label="Loading" />
                <Spinner label="Loading" size="large" />
              </div>
              <Skeleton height="1.25rem" width="75%" />
              <Skeleton height="4rem" />
            </div>
          </Card>
        </section>

        <section className="showcase-section" aria-labelledby="overlay-heading">
          <div className="showcase-heading">
            <p>Feedback</p>
            <h2 id="overlay-heading">Overlays &amp; messages</h2>
          </div>
          <Card>
            <div className="showcase-row">
              <Button onClick={() => setModalOpen(true)}>Open modal</Button>
              <Button variant="danger" onClick={() => setDialogOpen(true)}>
                Open confirmation
              </Button>
              <Button variant="secondary" onClick={() => setToastOpen(true)}>
                Show toast
              </Button>
            </div>
          </Card>
        </section>
      </main>

      <Modal
        open={modalOpen}
        title="Shared modal"
        onDismiss={() => setModalOpen(false)}
      >
        <div className="showcase-stack">
          <p>Modal content uses the same shared controls.</p>
          <TextInput label="Traveler name" placeholder="Add a name" />
          <Button onClick={() => setModalOpen(false)}>Done</Button>
        </div>
      </Modal>
      <ConfirmDialog
        open={dialogOpen}
        title="Remove this itinerary item?"
        message="This action cannot be undone."
        cancelLabel="Keep item"
        confirmLabel="Remove"
        destructive
        onCancel={() => setDialogOpen(false)}
        onConfirm={() => setDialogOpen(false)}
      />
      <Toast
        open={toastOpen}
        message="Trip changes saved"
        tone="success"
        onDismiss={() => setToastOpen(false)}
      />
    </Page>
  );
}
