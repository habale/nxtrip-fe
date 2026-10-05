import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppError } from '../../../shared/api/app-error';
import { convertImageToWebp } from '../../../shared/images/image-conversion';
import {
  Button,
  ConfirmDialog,
  ImagePicker,
  ProgressBar,
} from '../../../shared/ui';
import {
  createCoverThumbnail,
  type CoverImageValidationError,
  validateCoverImage,
} from '../cover-image';
import { useRemoveTripCover, useUpdateTripCover } from '../trip-hooks';
import type { TripDetail, TripRepository } from '../trip-repository';

type TripCoverProps = {
  detail: TripDetail;
  repository?: TripRepository;
};

export function TripCover({ detail, repository }: TripCoverProps) {
  const { t } = useTranslation('common');
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [validationError, setValidationError] =
    useState<CoverImageValidationError | null>(null);
  const [removeConfirmationOpen, setRemoveConfirmationOpen] = useState(false);
  const updateCover = useUpdateTripCover(repository);
  const removeCover = useRemoveTripCover(repository);
  const { trip, role } = detail;
  const coverUrl =
    previewUrl ?? detail.coverThumbnailUrl ?? detail.coverImageUrl;
  const busy = updateCover.isPending || removeCover.isPending;
  const mutationError = updateCover.error ?? removeCover.error;

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  async function selectCover(file: File) {
    setValidationError(null);
    updateCover.reset();
    removeCover.reset();

    const error = validateCoverImage(file);
    if (error) {
      setValidationError(error);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return nextPreviewUrl;
    });

    try {
      const webpFile = await convertImageToWebp(file);
      const thumbnail = await createCoverThumbnail(webpFile);
      await updateCover.mutateAsync({
        tripId: trip.id,
        version: trip.version,
        file: webpFile,
        thumbnail,
        currentImagePath: trip.cover_image_path,
        currentThumbnailPath: trip.cover_thumbnail_path,
      });
      setPreviewUrl(undefined);
    } catch {
      setPreviewUrl(undefined);
    }
  }

  async function remove() {
    setRemoveConfirmationOpen(false);
    await removeCover
      .mutateAsync({
        tripId: trip.id,
        version: trip.version,
        currentImagePath: trip.cover_image_path,
        currentThumbnailPath: trip.cover_thumbnail_path,
      })
      .catch(() => undefined);
  }

  return (
    <section className={`trip-cover${coverUrl ? ' trip-cover--image' : ''}`}>
      {coverUrl ? (
        <img alt={t('tripCover.alt', { name: trip.name })} src={coverUrl} />
      ) : (
        <div className="trip-cover__fallback" aria-hidden="true">
          <span>{trip.name.slice(0, 1).toLocaleUpperCase()}</span>
        </div>
      )}

      {role === 'owner' && (
        <div className="trip-cover__actions">
          <ImagePicker
            disabled={busy}
            label={coverUrl ? t('tripCover.replace') : t('tripCover.choose')}
            onFileSelect={(file) => void selectCover(file)}
          />
          {trip.cover_image_path && (
            <Button
              disabled={busy}
              variant="danger"
              onClick={() => setRemoveConfirmationOpen(true)}
            >
              {t('tripCover.remove')}
            </Button>
          )}
        </div>
      )}

      {busy && (
        <div className="trip-cover__progress">
          <ProgressBar indeterminate label={t('tripCover.uploading')} />
          <span>{t('tripCover.uploading')}</span>
        </div>
      )}

      {validationError && (
        <p className="trip-cover__error" role="alert">
          {t(`tripCover.validation.${validationError}`)}
        </p>
      )}
      {mutationError && (
        <p className="trip-cover__error" role="alert">
          {t(
            mutationError instanceof AppError
              ? mutationError.translationKey
              : 'errors:generic',
          )}
        </p>
      )}

      <ConfirmDialog
        destructive
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('tripCover.remove')}
        message={t('tripCover.removeDescription')}
        open={removeConfirmationOpen}
        title={t('tripCover.removeTitle')}
        onCancel={() => setRemoveConfirmationOpen(false)}
        onConfirm={() => void remove()}
      />
    </section>
  );
}
