import type { ProviderItem } from "@partner-onboarding/contracts";

type ItemListProps = {
  items: ProviderItem[];
};

export function ItemList({ items }: ItemListProps) {
  if (items.length === 0) {
    return <p className="muted">No Provider items were returned.</p>;
  }

  return (
    <ul className="item-list" aria-label="Provider items">
      {items.map((item) => (
        <li key={item.id} className="item-list__item">
          <span className="item-list__icon" aria-hidden="true">
            ✓
          </span>
          <span>
            <strong>{item.name}</strong>
            <small>{item.id}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
