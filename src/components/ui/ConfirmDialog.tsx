import { useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
  /** When set, a text field is required (e.g. refund reason, payment reference). */
  inputLabel?: string;
  inputPlaceholder?: string;
  isLoading?: boolean;
  error?: string | null;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

/** Confirmation modal used for every sensitive action (payments, moderation, deletion). */
export function ConfirmDialog({
  isOpen, title, description, confirmLabel = 'Confirmer', tone = 'primary', inputLabel, inputPlaceholder,
  isLoading, error, onConfirm, onClose,
}: ConfirmDialogProps) {
  const [value, setValue] = useState('');
  const requiresInput = Boolean(inputLabel);
  const disabled = isLoading || (requiresInput && value.trim().length < 3);

  const close = () => {
    setValue('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled) onConfirm(value.trim());
        }}
        className="space-y-4"
      >
        {description && <div className="text-sm leading-relaxed text-gray-600">{description}</div>}
        {requiresInput && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">{inputLabel}</span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={inputPlaceholder}
              maxLength={200}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-secondary-500 focus:outline-none focus:ring-2 focus:ring-secondary-500/20"
              autoFocus
            />
          </label>
        )}
        {error && <p role="alert" className="rounded-lg bg-danger-50 p-3 text-sm text-danger-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>Annuler</Button>
          <Button type="submit" variant={tone === 'danger' ? 'danger' : 'secondary'} isLoading={isLoading} disabled={disabled}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
