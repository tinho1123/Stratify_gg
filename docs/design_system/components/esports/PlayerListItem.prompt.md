The repeating roster/market row. Composes Avatar + Badge + RatingBadge.

```jsx
<PlayerListItem name="Gabriel 'FalleN' Toledo" role="IGL · AWPer"
  rating={91} status="online" statusLabel="Online" onClick={open} />

<PlayerListItem name="João Silva" role="Rifler" meta="$1.8M"
  rating={76} trailing={<Button size="sm">Contratar</Button>} />
```

Pass `trailing` to swap the chevron for a price or action button. `status` colors the avatar dot; `statusLabel` shows the pill next to the name.
