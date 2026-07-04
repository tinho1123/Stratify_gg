Dark surface container behind nearly every block. Pair with `SectionHeader` for the eyebrow + action row pattern.

```jsx
<Card>
  <SectionHeader title="Ações Rápidas" action="Ver todos" onAction={...} />
  …content…
</Card>

<Card glow>Destaque do dia</Card>
<Card padded={false}>{/* edge-to-edge list */}</Card>
```

`glow` adds the emerald ring used for active/highlighted cards. `surface` picks the background level (deep/raised/control).
