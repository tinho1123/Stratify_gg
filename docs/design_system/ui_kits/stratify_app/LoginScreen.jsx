// LoginScreen — dark auth screen: logo crest, wordmark, tagline, email/password
// fields with emerald focus, forgot link, primary CTA, signup footer.
function LoginScreen({ onLogin }) {
  const { Button, Input } = window.StratifyDesignSystem_af4c64;
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const submit = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); onLogin && onLogin(); }, 900);
  };

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  padding: '0 24px', position: 'relative', overflow: 'hidden' }}>
      {/* radial glow */}
      <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-glow-emerald)', pointerEvents: 'none' }} />

      {/* header */}
      <div style={{ position: 'relative', textAlign: 'center', marginBottom: 36 }}>
        <img src="../../assets/stratify-logo.png" alt="Stratify" style={{ height: 84, marginBottom: 14 }} />
        <div style={{ font: 'var(--weight-black) 26px var(--font-display)', letterSpacing: '0.32em',
                      color: '#fff', paddingLeft: '0.32em' }}>STRATIFY</div>
        <div style={{ marginTop: 10, font: 'var(--weight-medium) 13px var(--font-sans)', color: 'var(--text-muted)' }}>
          Gerencie seu time. Conquiste o topo.
        </div>
      </div>

      {/* form */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input label="E-mail" type="email" placeholder="usuario@esports.gg"
               value={email} onChange={e => setEmail(e.target.value)} />
        <Input label="Senha" type="password" placeholder="••••••••"
               value={password} onChange={e => setPassword(e.target.value)} />
        <div style={{ textAlign: 'right', marginTop: -4 }}>
          <span style={{ font: 'var(--weight-semibold) 12px var(--font-sans)', color: 'var(--emerald-500)', cursor: 'pointer' }}>
            Esqueceu a senha?
          </span>
        </div>
        <Button fullWidth size="lg" loading={loading} onClick={submit}>
          {loading ? 'Entrando' : 'Entrar'}
        </Button>
      </div>

      {/* footer */}
      <div style={{ position: 'relative', textAlign: 'center', marginTop: 28,
                    font: 'var(--weight-medium) 13px var(--font-sans)', color: 'var(--text-muted)' }}>
        Não tem conta? <span style={{ color: 'var(--emerald-500)', fontWeight: 700, cursor: 'pointer' }}>Criar time</span>
      </div>
    </div>
  );
}
window.LoginScreen = LoginScreen;
