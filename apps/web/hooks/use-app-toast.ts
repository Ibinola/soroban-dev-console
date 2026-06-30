/**
 * FE-233: Centralized toast hook for consistent success/warning/error patterns.
 *
 * Wraps sonner's `toast` with opinionated defaults so callers never have to
 * pass duration, icon, or description boilerplate directly.
 */
import { toast } from "sonner";

export type ToastOptions = {
  description?: string;
  /** Existing toast ID to replace (for loading → result transitions). */
  id?: string | number;
};

export function useAppToast() {
  return {
    success(title: string, opts?: ToastOptions) {
      toast.success(title, { duration: 4000, ...opts });
    },
    error(title: string, opts?: ToastOptions) {
      toast.error(title, { duration: 6000, ...opts });
    },
    warning(title: string, opts?: ToastOptions) {
      toast.warning(title, { duration: 5000, ...opts });
    },
    info(title: string, opts?: ToastOptions) {
      toast.info(title, { duration: 4000, ...opts });
    },
    loading(title: string, opts?: Omit<ToastOptions, "id">) {
      return toast.loading(title, { ...opts });
    },
    dismiss(id?: string | number) {
      toast.dismiss(id);
    },
  };
}
