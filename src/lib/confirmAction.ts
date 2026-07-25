export interface ConfirmActionOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'primary';
}

export interface ConfirmActionRequest {
  message: string;
  options: ConfirmActionOptions;
  resolve: (confirmed: boolean) => void;
}

export const CONFIRM_ACTION_EVENT = 'cmms-confirm-action';

export function confirmAction(
  message: string,
  options: ConfirmActionOptions = {}
): Promise<boolean> {
  return new Promise(resolve => {
    window.dispatchEvent(new CustomEvent<ConfirmActionRequest>(CONFIRM_ACTION_EVENT, {
      detail: { message, options, resolve }
    }));
  });
}
