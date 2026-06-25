// DashboardScreen — the home view: top header (wordmark + bell + profile),
// hero next-match card with countdown, KPI row, roster, quick actions, perf bars.
function DashboardScreen({ onNavigate, onOpenNotifs, unread }) {
  const S = window.StratifyDesignSystem_af4c64;
  const { Card, SectionHeader, IconButton, PlayerListItem, StatBar, Avatar } = S;
  const d = window.STRATIFY_DATA;
  const fmtMoney = n => '$' + (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : (n / 1e3).toFixed(0) + 'K');
  const avg = (d.roster.reduce((s, p) => s + p.rating, 0) / d.roster.length).toFixed(1);

  const kpis = [
    { value: fmtMoney(d.team.budget), label: 'Orçamento', sub: 'disponível' },
    { value: '#' + d.team.ranking, label: 'Ranking', sub: 'global' },
    { value: (d.team.fans / 1000).toFixed(0) + 'K', label: 'Fãs', sub: 'seguidores' },
    { value: d.team.wins + '-' + d.team.losses, label: 'Recorde', sub: (d.team.wins + d.team.losses) + ' partidas' },
  ];

  return (
    <div style={{ paddingBottom: 28 }}>
      {/* top header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--emerald-500)' }} />
          <span style={{ font: 'var(--weight-black) 18px var(--font-display)', letterSpacing: '0.28em', color: '#fff', paddingLeft: '0.28em' }}>STRATIFY</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconButton badge={unread || null} ariaLabel="Notificações" onClick={onOpenNotifs}>🔔</IconButton>
          <Avatar name="Gabriel Souza" size={36} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 16px 0' }}>
        {/* hero next match */}
        <div style={{ position: 'relative', borderRadius: 'var(--radius-3xl)', overflow: 'hidden',
                      background: 'var(--gradient-hero)', border: '1px solid #1A3D2A',
                      boxShadow: 'var(--glow-emerald-soft)', padding: 20 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--emerald-500)' }} />
            <span style={{ font: 'var(--weight-extrabold) 10px var(--font-sans)', letterSpacing: '0.16em', color: 'var(--emerald-400)' }}>{d.nextMatch.badge}</span>
          </div>
          <div style={{ font: 'var(--weight-black) 26px var(--font-display)', letterSpacing: '0.02em', color: '#fff', lineHeight: 1.05 }}>{d.nextMatch.title}</div>
          <div style={{ marginTop: 4, font: 'var(--weight-medium) 14px var(--font-sans)', color: 'var(--text-secondary)' }}>{d.nextMatch.opponent}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, margin: '18px 0' }}>
            {d.nextMatch.countdown.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ font: 'var(--weight-black) 22px var(--font-mono)', color: 'var(--text-ghost)', paddingBottom: 14 }}>:</span>}
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '8px 12px', textAlign: 'center', minWidth: 52 }}>
                  <div style={{ font: 'var(--weight-black) 22px var(--font-mono)', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{String(c.v).padStart(2, '0')}</div>
                  <div style={{ font: 'var(--weight-bold) 8px var(--font-sans)', letterSpacing: '0.1em', color: 'var(--text-muted)', marginTop: 2 }}>{c.l}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
          <div style={{ font: 'var(--weight-black) 12px var(--font-sans)', letterSpacing: '0.08em', color: 'var(--emerald-400)', cursor: 'pointer' }}>VER DETALHES  →</div>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          {kpis.map((k, i) => (
            <div key={i} style={{ background: 'var(--surface-deep)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-2xl)', padding: 14 }}>
              <div style={{ font: 'var(--weight-black) 24px var(--font-mono)', color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{k.value}</div>
              <div style={{ marginTop: 6, font: 'var(--weight-bold) 11px var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{k.label}</div>
              <div style={{ font: 'var(--weight-medium) 10px var(--font-sans)', color: 'var(--text-faint)' }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* roster */}
        <Card>
          <SectionHeader title="Time Principal" action="gerenciar" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ font: 'var(--weight-black) 16px var(--font-display)', letterSpacing: '0.02em', color: '#fff' }}>{d.team.name}</span>
            <span style={{ font: 'var(--weight-bold) 10px var(--font-mono)', color: 'var(--emerald-400)', background: 'var(--emerald-tint-12)', border: '1px solid var(--emerald-tint-30)', borderRadius: 'var(--radius-pill)', padding: '3px 8px' }}>{avg} AVG</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {d.roster.map(p => (
              <PlayerListItem key={p.id} name={p.name} role={p.role} rating={p.rating}
                status={p.status === 'banned' ? 'suspended' : p.status} statusLabel={p.statusLabel} />
            ))}
          </div>
        </Card>

        {/* quick actions */}
        <div>
          <div style={{ font: 'var(--weight-extrabold) 11px var(--font-sans)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Ações Rápidas</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            {d.actions.map((a, i) => (
              <div key={i} onClick={() => a.screen && onNavigate(a.screen)}
                style={{ background: 'var(--surface-deep)', border: `1px solid color-mix(in srgb, ${a.accent} 30%, transparent)`, borderRadius: 'var(--radius-2xl)', padding: 14, cursor: a.screen ? 'pointer' : 'default' }}>
                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${a.accent} 14%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, marginBottom: 10 }}>{a.icon}</div>
                <div style={{ font: 'var(--weight-black) 13px var(--font-sans)', letterSpacing: '0.06em', color: a.accent }}>{a.label}</div>
                <div style={{ font: 'var(--weight-medium) 11px var(--font-sans)', color: 'var(--text-faint)', marginTop: 2 }}>{a.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* performance */}
        <Card>
          <SectionHeader title="Performance" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {d.performance.map((m, i) => (
              <StatBar key={i} label={m.label} value={m.value} tone={m.tone} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
window.DashboardScreen = DashboardScreen;
