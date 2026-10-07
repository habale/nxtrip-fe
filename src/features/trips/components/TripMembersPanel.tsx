import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppError } from '../../../shared/api/app-error';
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  ContextMenu,
  Checkbox,
  Icon,
  Modal,
  SearchField,
  Skeleton,
  TextArea,
  TextInput,
} from '../../../shared/ui';
import { useAuth } from '../../auth/auth-context';
import {
  type GuestMemberFormValues,
  validateGuestMemberForm,
} from '../guest-member-form';
import { getMemberManagementPermissions } from '../member-permissions';
import {
  useAddGuestMember,
  useClaimTripMember,
  useDeactivateGuestMember,
  useTripMembers,
  useUpdateGuestMember,
} from '../trip-hooks';
import type { TripMemberDetail, TripRepository } from '../trip-repository';

type TripMembersPanelProps = {
  tripId: string;
  treasurerMemberId: string | null;
  viewerRole: 'owner' | 'member' | 'viewer';
  repository?: TripRepository;
};

const emptyValues: GuestMemberFormValues = {
  displayName: '',
  email: '',
  note: '',
  isTreasurer: false,
};

export function TripMembersPanel({
  tripId,
  treasurerMemberId,
  viewerRole,
  repository,
}: TripMembersPanelProps) {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const membersQuery = useTripMembers(tripId, repository);
  const addGuest = useAddGuestMember(repository);
  const updateGuest = useUpdateGuestMember(repository);
  const deactivateGuest = useDeactivateGuestMember(repository);
  const claimMember = useClaimTripMember(repository);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [values, setValues] = useState(emptyValues);
  const [editTarget, setEditTarget] = useState<TripMemberDetail | null>(null);
  const [editSubmitted, setEditSubmitted] = useState(false);
  const [editValues, setEditValues] = useState(emptyValues);
  const [deactivateTarget, setDeactivateTarget] =
    useState<TripMemberDetail | null>(null);
  const [claimTarget, setClaimTarget] = useState<TripMemberDetail | null>(null);
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
      isTreasurer: target.member.id === treasurerMemberId,
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
        currentTreasurerMemberId: treasurerMemberId,
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

  async function claim() {
    if (!claimTarget) return;
    const target = claimTarget;
    setClaimTarget(null);
    await claimMember
      .mutateAsync({ tripId, tripMemberId: target.member.id })
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
            const displayName =
              linkedUserId === user?.id
                ? `${member.display_name} (${t('labels.you')})`
                : member.display_name;
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
                  name={displayName}
                  src={member.avatar_url ?? undefined}
                />
                <div className="trip-member-card__details">
                  <div className="trip-member-card__name">
                    <h3>{displayName}</h3>
                    {linkedUserId && accessStatus === 'active' && (
                      <span className="trip-member-card__linked-badge">
                        <Icon label={t('tripMembers.linked')} name="link" />
                      </span>
                    )}
                    {role === 'owner' && (
                      <Badge>{t('tripMembers.owner')}</Badge>
                    )}
                    {member.id === treasurerMemberId && (
                      <Badge tone="success">{t('tripMembers.treasurer')}</Badge>
                    )}
                    {!member.is_active && (
                      <Badge tone="warning">{t('tripMembers.inactive')}</Badge>
                    )}
                  </div>
                  {member.email && <p>{member.email}</p>}
                  {member.note && <small>{member.note}</small>}
                </div>
                <div className="trip-member-card__actions">
                  {viewerRole === 'owner' && (
                    <ContextMenu
                      label={t('tripMembers.actionsFor', {
                        name: displayName,
                      })}
                      items={[
                        {
                          label: t('tripMembers.edit'),
                          icon: 'edit',
                          disabled: !permissions.canEdit,
                          onSelect: () => openEdit(target),
                        },
                        {
                          label: t('tripMembers.deactivate'),
                          icon: 'trash',
                          destructive: true,
                          disabled: !permissions.canDeactivate,
                          onSelect: () => setDeactivateTarget(target),
                        },
                      ]}
                    />
                  )}
                  {viewerRole === 'viewer' &&
                    user &&
                    !user.is_anonymous &&
                    member.is_active &&
                    !member.email &&
                    !linkedUserId && (
                      <Button
                        disabled={claimMember.isPending}
                        size="small"
                        variant="quiet"
                        onClick={() => setClaimTarget(target)}
                      >
                        <Icon name="link" />
                        {t('tripMembers.linkAction')}
                      </Button>
                    )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {viewerRole === 'owner' && (
        <Button variant="quiet" onClick={() => setModalOpen(true)}>
          <span className="trip-members-add">
            <Icon name="add" />
            {t('tripMembers.addGuest')}
          </span>
        </Button>
      )}

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
          {viewerRole === 'owner' && (
            <label className="trip-member-form__checkbox">
              <Checkbox
                ariaLabel={t('tripMembers.makeTreasurer')}
                checked={values.isTreasurer}
                disabled={addGuest.isPending}
                onCheckedChange={(checked) => update('isTreasurer', checked)}
              />
              <span>{t('tripMembers.makeTreasurer')}</span>
            </label>
          )}
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
          {viewerRole === 'owner' && (
            <label className="trip-member-form__checkbox">
              <Checkbox
                ariaLabel={t('tripMembers.makeTreasurer')}
                checked={editValues.isTreasurer}
                disabled={updateGuest.isPending}
                onCheckedChange={(checked) =>
                  updateEdit('isTreasurer', checked)
                }
              />
              <span>{t('tripMembers.makeTreasurer')}</span>
            </label>
          )}
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
      {claimMember.error && (
        <p className="trip-member-form__error" role="alert">
          {t(
            claimMember.error instanceof AppError
              ? claimMember.error.translationKey
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
      <ConfirmDialog
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('tripMembers.linkAction')}
        message={t('tripMembers.linkDescription', {
          name: claimTarget?.member.display_name ?? '',
        })}
        open={Boolean(claimTarget)}
        title={t('tripMembers.linkTitle')}
        onCancel={() => setClaimTarget(null)}
        onConfirm={() => void claim()}
      />
    </section>
  );
}
