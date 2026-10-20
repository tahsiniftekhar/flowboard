import { Modal } from '@/components/ui/modal';

const SHORTCUTS: Array<[string, string]> = [
  ['N', 'Add a task to the first column'],
  ['/', 'Search tasks'],
  ['?', 'Show keyboard shortcuts'],
  ['Esc', 'Close dialogs, menus and quick add'],
];

export function ShortcutsModal({ close }: { close: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" close={close}>
      <dl className="shortcut-list">
        {SHORTCUTS.map(([key, description]) => (
          <div key={key}>
            <dt>
              <kbd>{key}</kbd>
            </dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
      <p className="muted shortcut-note">
        To reorder with the keyboard, focus a drag handle, press Space, use the arrow keys, then
        press Space again.
      </p>
    </Modal>
  );
}
