import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppError } from '../../../shared/api/app-error';
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  Icon,
  Modal,
  SearchField,
  Skeleton,
  TextArea,
  TextInput,
} from '../../../shared/ui';
import {
  type GuestMemberFormValues,
  validateGuestMemberForm,
} from '../guest-member-form';
import { getMemberManagementPermissions } from '../member-permissions';
import {
  useAddGuestMember,
  useDeactivateGuestMember,
  useTripMembers,
  useUpdateGuestMember,
} from '../trip-hooks';
import type { TripMemberDetail, TripRepository } from '../trip-repository';

type TripMembersPanelProps = {
  tripId: string;
  viewerRole: 'owner' | 'member';
  repository?: TripRepository;
};

const emptyValues: GuestMemberFormValues = {
  displayName: '',
  email: '',
  note: '',
};

export function TripMembersPanel({
  tripId,
  viewerRole,
  repository,
}: TripMembersPanelProps) {
  const { t } = useTranslation('common');
  const membersQuery = useTripMembers(tripId, repository);
  const addGuest = useAddGuestMember(repository);
  const updateGuest = useUpdateGuestMember(repository);
  const deactivateGuest = useDeactivateGuestMember(repository);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [values, setValues] = useState(emptyValues);
  const [editTarget, setEditTarget] = useState<TripMemberDetail | null>(null);
  const [editSubmitted, setEditSubmitted] = useState(false);
  const [editValues, setEditValues] = useState(emptyValues);
  const [deactivateTarget, setDeactivateTarget] =
    useState<TripMemberDetail | null>(null);
  const errors = submitted ? validateGuestMemberForm(values) : {};
  const members = membersQuery.data ?? [];
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredMembers = members.filter(({ member }) => {
    if (!normalizedSearch) return true;
    return [member.display_name, member.email, member.note]
      .filter(Boolean)
      .some((value) => value?.toLocaleLowerCase().includes(normalizedSearch));
  });

  function update<Field extends keyof GuestMemberFormValues>(
    field: Field,
    value: GuestMemberFormValues[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function updateEdit<Field extends keyof GuestMemberFormValues>(
    field: Field,
    value: GuestMemberFormValues[Field],
  ) {
    setEditValues((current) => ({ ...current, [field]: value }));
  }

  function openEdit(target: TripMemberDetail) {
    setEditTarget(target);
    setEditSubmitted(false);
    setEditValues({
      displayName: target.member.display_name,
      email: target.member.email ?? '',
      note: target.member.note ?? '',
    });
    updateGuest.reset();
  }

  function closeEdit() {
    if (updateGuest.isPending) return;
    setEditTarget(null);
    setEditSubmitted(false);
    updateGuest.reset();
  }

  function closeModal() {
    if (addGuest.isPending) return;
    setModalOpen(false);
    setSubmitted(false);
    setValues(emptyValues);
    addGuest.reset();
  }

  async function submit() {
    setSubmitted(true);
    if (Object.keys(validateGuestMemberForm(values)).length > 0) return;

    const member = await addGuest
      .mutateAsync({ tripId, ...values })
      .catch(() => undefined);
    if (member) closeModal();
  }

  async function submitEdit() {
    if (!editTarget) return;
    setEditSubmitted(true);
    if (Object.keys(validateGuestMemberForm(editValues)).length > 0) return;

    const member = await updateGuest
      .mutateAsync({
        tripId,
        memberId: editTarget.member.id,
        version: editTarget.member.version,
        ...editValues,
      })
      .catch(() => undefined);
    if (member) closeEdit();
  }

  async function deactivate() {
    if (!deactivateTarget) return;
    const target = deactivateTarget;
    setDeactivateTarget(null);
    await deactivateGuest
      .mutateAsync({
        tripId,
        memberId: target.member.id,
        version: target.member.version,
      })
      .catch(() => undefined);
  }

  const errorText = (field: keyof GuestMemberFormValues) => {
    const code = errors[field];
    return code ? t(`tripMembers.validation.${code}`) : undefined;
  };
  const editErrors = editSubmitted ? validateGuestMemberForm(editValues) : {};
  const editErrorText = (field: keyof GuestMemberFormValues) => {
    const code = editErrors[field];
    return code ? t(`tripMembers.validation.${code}`) : undefined;
  };

  return (
    <section className="trip-members-panel">
      <div className="trip-members-panel__heading">
        <h2>{t('tripMembers.title', { count: members.length })}</h2>
      </div>

      {members.length > 0 && (
        <SearchField
          label={t('tripMembers.search')}
          placeholder={t('tripMembers.searchPlaceholder')}
          value={search}
          onValueChange={setSearch}
        />
      )}

      {membersQuery.isPending ? (
        <div
          className="trip-members-panel__list"
          aria-label={t('states.loading')}
        >
          <Skeleton height="5rem" />
          <Skeleton height="5rem" />
        </div>
      ) : membersQuery.isError ? (
        <div className="trip-members-panel__state" role="alert">
          <p>{t('tripMembers.loadError')}</p>
          <Button variant="quiet" onClick={() => void membersQuery.refetch()}>
            {t('actions.retry')}
          </Button>
        </div>
      ) : filteredMembers.length === 0 ? (
        <p className="trip-members-panel__state">
          {members.length === 0
            ? t('tripMembers.empty')
            : t('tripMembers.noResults')}
        </p>
      ) : (
        <div className="trip-members-panel__list">
          {filteredMembers.map((target) => {
            const { member, linkedUserId, role, accessStatus } = target;
            const permissions = getMemberManagementPermissions(
              viewerRole,
              target,
            );

            return (
              <article
                key={member.id}
                className={`trip-member-card${member.is_active ? '' : ' trip-member-card--inactive'}`}
              >
                <Avatar
                  initialCount={2}
                  name={member.display_name}
                  src={member.avatar_url ?? undefined}
                />
                <div className="trip-member-card__details">
                  <div className="trip-member-card__name">
                    <h3>{member.display_name}</h3>
                    {role === 'owner' && (
                      <Badge>{t('tripMembers.owner')}</Badge>
                    )}
                    {!member.is_active && (
                      <Badge tone="warning">{t('tripMembers.inactive')}</Badge>
                    )}
                  </div>
                  {member.email && <p>{member.email}</p>}
                  {member.note && <small>{member.note}</small>}
                </div>
                <div className="trip-member-card__actions">
                  {linkedUserId && accessStatus === 'active' && (
                    <span className="trip-member-card__link-state">
                      {t('tripMembers.linked')}
                    </span>
                  )}
                  {permissions.canDeactivate && (
                    <Button
                      size="small"
                      variant="danger-text"
                      onClick={() => setDeactivateTarget(target)}
                    >
                      {t('tripMembers.deactivate')}
                    </Button>
                  )}
                  {permissions.canEdit && (
                    <Button
                      size="small"
                      variant="quiet"
                      onClick={() => openEdit(target)}
                    >
                      {t('tripMembers.edit')}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Button variant="quiet" onClick={() => setModalOpen(true)}>
        <span className="trip-members-add">
          <Icon name="add" />
          {t('tripMembers.addGuest')}
        </span>
      </Button>

      <Modal
        open={modalOpen}
        title={t('tripMembers.addGuestTitle')}
        onDismiss={closeModal}
      >
        <div className="trip-member-form">
          <p>{t('tripMembers.addGuestDescription')}</p>
          <TextInput
            required
            errorText={errorText('displayName')}
            label={t('tripMembers.displayName')}
            maxlength={120}
            value={values.displayName}
            onValueChange={(value) => update('displayName', value)}
          />
          <TextInput
            errorText={errorText('email')}
            label={t('tripMembers.email')}
            type="email"
            value={values.email}
            onValueChange={(value) => update('email', value)}
          />
          <TextArea
            label={t('tripMembers.note')}
            rows={3}
            value={values.note}
            onValueChange={(value) => update('note', value)}
          />
          {addGuest.error && (
            <p className="trip-member-form__error" role="alert">
              {t(
                addGuest.error instanceof AppError
                  ? addGuest.error.translationKey
                  : 'errors:generic',
              )}
            </p>
          )}
          <div className="trip-member-form__actions">
            <Button
              disabled={addGuest.isPending}
              variant="quiet"
              onClick={closeModal}
            >
              {t('actions.cancel')}
            </Button>
            <Button loading={addGuest.isPending} onClick={() => void submit()}>
              {addGuest.isPending
                ? t('tripMembers.adding')
                : t('tripMembers.addGuest')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(editTarget)}
        title={t('tripMembers.editGuestTitle')}
        onDismiss={closeEdit}
      >
        <div className="trip-member-form">
          <TextInput
            required
            errorText={editErrorText('displayName')}
            label={t('tripMembers.displayName')}
            maxlength={120}
            value={editValues.displayName}
            onValueChange={(value) => updateEdit('displayName', value)}
          />
          <TextInput
            errorText={editErrorText('email')}
            label={t('tripMembers.email')}
            type="email"
            value={editValues.email}
            onValueChange={(value) => updateEdit('email', value)}
          />
          <TextArea
            label={t('tripMembers.note')}
            rows={3}
            value={editValues.note}
            onValueChange={(value) => updateEdit('note', value)}
          />
          {updateGuest.error && (
            <p className="trip-member-form__error" role="alert">
              {t(
                updateGuest.error instanceof AppError
                  ? updateGuest.error.translationKey
                  : 'errors:generic',
              )}
            </p>
          )}
          <div className="trip-member-form__actions">
            <Button
              disabled={updateGuest.isPending}
              variant="quiet"
              onClick={closeEdit}
            >
              {t('actions.cancel')}
            </Button>
            <Button
              loading={updateGuest.isPending}
              onClick={() => void submitEdit()}
            >
              {updateGuest.isPending
                ? t('tripMembers.saving')
                : t('actions.save')}
            </Button>
          </div>
        </div>
      </Modal>

      {deactivateGuest.error && (
        <p className="trip-member-form__error" role="alert">
          {t(
            deactivateGuest.error instanceof AppError
              ? deactivateGuest.error.translationKey
              : 'errors:generic',
          )}
        </p>
      )}
      <ConfirmDialog
        destructive
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('tripMembers.deactivate')}
        message={t('tripMembers.deactivateDescription', {
          name: deactivateTarget?.member.display_name ?? '',
        })}
        open={Boolean(deactivateTarget)}
        title={t('tripMembers.deactivateTitle')}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={() => void deactivate()}
      />
    </section>
  );
}
