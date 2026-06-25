Round player/team avatar. Shows the image when `src` is set, otherwise initials on a deterministic gradient derived from `name`.

```jsx
<Avatar name="Gabriel Souza" status="online" />
<Avatar src={url} size="lg" selected />
<Avatar name="FURIA" size={72} status="injured" />
```

`status` adds a corner dot (online=emerald, injured=red, suspended=amber). `selected` adds the emerald ring used in pickers.
