type ScreenStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function ScreenState({
  title,
  message,
  actionLabel,
  onAction,
}: ScreenStateProps) {
  return (
    <section className="card screen-state">
      <div className="spinner" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{message}</p>
      {actionLabel && onAction ? (
        <button className="button button--primary" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}
