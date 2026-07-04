Pill segmented control to switch sub-views within a screen (team detail, stats).

```jsx
<SegmentedTabs
  tabs={[{id:'overview',label:'Visão Geral'},{id:'roster',label:'Elenco'},{id:'stats',label:'Estatísticas'}]}
  defaultValue="overview" onChange={setTab} />
```

Controlled (`value`) or uncontrolled (`defaultValue`). Active segment gets the emerald-tinted chip + ring.
