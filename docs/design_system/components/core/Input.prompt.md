Dark text field with an emerald focus ring. Used for login/signup, market search and any form input.

```jsx
<Input label="E-mail" type="email" placeholder="voce@time.gg"
       value={email} onChange={e => setEmail(e.target.value)} />
<Input iconLeft="🔍" placeholder="Buscar jogador" />
<Input label="Senha" type="password" error="Senha incorreta" />
```

Focus brightens the 1.5px outline to emerald and adds a soft glow. Pass `error` to switch the outline red and show a message. `iconLeft` renders a muted leading glyph (e.g. search).
