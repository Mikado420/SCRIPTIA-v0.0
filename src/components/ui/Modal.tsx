import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  eyebrow?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** true: 画面全体に固定（デッキ画面など）/ false: 親（ゲームキャンバス）内に配置 */
  fixed?: boolean;
  width?: number | string;
  /** 背景タップで閉じる */
  dismissible?: boolean;
  className?: string;
  bodyClassName?: string;
  zIndex?: number;
  tone?: 'default' | 'arcane' | 'danger';
}

/** 全画面共通のポップアップ。真鍮縁の魔導書パネル＋短いポップイン。 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  eyebrow,
  icon,
  children,
  footer,
  fixed = false,
  width = 360,
  dismissible = true,
  className = '',
  bodyClassName = '',
  zIndex = 60,
  tone = 'default',
}) => {
  if (!open) return null;
  const toneBorder =
    tone === 'arcane' ? 'rgba(134,236,220,0.6)' : tone === 'danger' ? 'rgba(227,102,92,0.7)' : undefined;
  return (
    <div
      className="sc-overlay"
      style={{ position: fixed ? 'fixed' : 'absolute', zIndex }}
      onClick={e => {
        e.stopPropagation();
        if (dismissible) onClose?.();
      }}
      onPointerDown={e => e.stopPropagation()}
      onPointerUp={e => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`sc-panel sc-corners sc-modal flex flex-col max-h-full overflow-hidden ${className}`}
        style={{ width, maxWidth: '100%', borderColor: toneBorder }}
        onClick={e => e.stopPropagation()}
      >
        {(title || onClose) && (
          <div className="flex items-center gap-2.5 px-4 pt-3 pb-2.5 shrink-0">
            {icon && <div className="shrink-0 text-brass-300">{icon}</div>}
            <div className="flex-1 min-w-0">
              {eyebrow && <div className="sc-eyebrow leading-none mb-1">{eyebrow}</div>}
              {title && <div className="sc-title text-[15px] leading-tight truncate">{title}</div>}
            </div>
            {onClose && (
              <button type="button" onClick={onClose} className="sc-btn sc-btn--ghost sc-btn--icon" aria-label="閉じる">
                <X size={16} />
              </button>
            )}
          </div>
        )}
        {(title || onClose) && <div className="sc-divider mx-3 shrink-0" />}
        <div className={`sc-scroll flex-1 min-h-0 px-4 py-3 ${bodyClassName}`}>{children}</div>
        {footer && (
          <>
            <div className="sc-divider mx-3 shrink-0" />
            <div className="flex items-center justify-end gap-2 px-4 py-3 shrink-0">{footer}</div>
          </>
        )}
      </div>
    </div>
  );
};

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  fixed?: boolean;
}

/** window.confirm の置き換え。破壊的操作は赤、それ以外は金。 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'キャンセル',
  danger = false,
  onConfirm,
  onCancel,
  fixed = true,
}) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    fixed={fixed}
    width={340}
    zIndex={10000}
    tone={danger ? 'danger' : 'default'}
    footer={
      <>
        <button type="button" className="sc-btn sc-btn--cancel" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className={`sc-btn ${danger ? 'sc-btn--danger' : 'sc-btn--primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </>
    }
  >
    <div className="text-[13px] leading-relaxed text-parch-100">{message}</div>
  </Modal>
);
