Primary call-to-action — emerald fill, heavy uppercase label; use for the single most important action on a screen (Entrar, Dar Lance, Iniciar).

```jsx
<Button onClick={submit}>Entrar</Button>
<Button variant="secondary">Fechar</Button>
<Button variant="outline" iconRight="→">Ver detalhes</Button>
<Button variant="danger" size="sm">Remover</Button>
<Button loading fullWidth>Entrando…</Button>
```

Variants: `primary` (emerald/black), `secondary` (dark control), `ghost` (transparent), `outline` (emerald ring), `danger` (red). Sizes `sm | md | lg`. Press dips opacity + scales 0.97 like the native TouchableOpacity. Requires the `stratify-spin` keyframe (shipped in the kit) for the loading spinner.
