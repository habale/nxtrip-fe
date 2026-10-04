import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Chip,
  ConfirmDialog,
  DatePicker,
  DateRangePicker,
  Icon,
  IconButton,
  List,
  ListItem,
  Modal,
  RadioGroup,
  ProgressBar,
  SearchField,
  Segment,
  Select,
  Skeleton,
  Spinner,
  TextArea,
  TextInput,
  Toast,
  Toggle,
} from '.';

describe('shared UI components', () => {
  it('renders the foundational controls through app-owned contracts', () => {
    const { container } = render(
      <>
        <Card title="Trip card" subtitle="Shared primitive">
          Card content
        </Card>
        <TextInput label="Trip name" />
        <TextArea label="Description" />
        <Select
          label="Currency"
          options={[{ value: 'VND', label: 'Vietnamese đồng' }]}
        />
        <DatePicker label="Start date" />
        <DateRangePicker
          endDate="2026-10-08"
          label="Trip dates"
          startDate="2026-10-03"
        />
        <Segment
          label="Trip section"
          options={[
            { value: 'info', label: 'Info' },
            { value: 'itinerary', label: 'Itinerary' },
          ]}
          value="info"
        />
        <Checkbox label="Include member" />
        <Toggle label="Notifications" />
        <RadioGroup
          label="Split method"
          options={[{ value: 'equal', label: 'Equal split' }]}
        />
        <SearchField label="Search trips" />
        <Badge>Planning</Badge>
        <Chip label="Hanoi" />
        <Icon name="location" label="Location" />
        <IconButton icon="add" label="Add item" />
        <Avatar name="Nolan" />
        <Avatar name="Alex Morgan" initialCount={2} />
        <Avatar name="Nolan" initialCount={2} />
        <Button selected variant="filter">
          Selected filter
        </Button>
        <List>
          <ListItem title="Tokyo" description="Upcoming trip" />
        </List>
        <ProgressBar label="Upload progress" value={0.5} />
        <Skeleton />
        <Spinner label="Loading" />
        <Modal open={false} title="Edit trip" onDismiss={() => undefined} />
        <Toast open={false} message="Saved" onDismiss={() => undefined} />
        <ConfirmDialog
          open={false}
          title="Remove item?"
          message="This cannot be undone."
          cancelLabel="Cancel"
          confirmLabel="Remove"
          onCancel={() => undefined}
          onConfirm={() => undefined}
        />
      </>,
    );

    expect(screen.getByText('Trip card')).toBeInTheDocument();
    expect(screen.getByText('AM')).toBeInTheDocument();
    expect(screen.getByText('NO')).toBeInTheDocument();
    expect(screen.getByText('Selected filter')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(container.querySelector('ion-segment')).toBeInTheDocument();
    expect(container.querySelector('ion-datetime')).toBeInTheDocument();
    expect(screen.getByText('Oct 3 – Oct 8, 2026')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Location' })).toHaveTextContent(
      'location_on',
    );
    expect(container.querySelector('ion-icon')).not.toBeInTheDocument();
    expect(screen.getByText('Planning')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
  });

  it('forwards button interaction without exposing Ionic events', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Continue</Button>);
    await user.click(screen.getByText('Continue'));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
