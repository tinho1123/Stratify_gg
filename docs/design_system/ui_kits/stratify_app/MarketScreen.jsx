// MarketScreen — transfer market: header w/ back + budget pill, search, role
// filter pills, segmented sort, auction cards (rating, timer, current bid).
// Tapping a card opens a bid bottom-sheet with the player's skill bars.
function MarketScreen({ onBack }) {
  const S = window.StratifyDesignSystem_af4c64;
  const { IconButton, Input, Badge, RatingBadge, StatBar, Button, SegmentedTabs } = S;
  const d = window.STRATIFY_DATA;
  const [search, setSearch] = React.useState('');
  const [role, setRole] = React.useState(null);
  const [detail, setDetail] = React.useState(null);
  const fmt = n => '$' + (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : (n / 1e3).toFixed(0) + 'K');

  const list = d.market.filter(p =>
    (!role || p.role === role) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.team.toLowerCase().includes(search.toLowerCase())));

  return (
    <div style={{ minHeight: '100%', position: 'relative' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', gap: 12 }}>
        <IconButton ariaLabel="Voltar" onClick={onBack}>‹</IconButton>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--emerald-500)' }} />
          <span style={{ font: 'var(--weight-black) 16px var(--font-display)', letterSpacing: '0.2em', color: '#fff', paddingLeft: '0.2em' }}>MERCADO</span>
        </div>
        <div style={{ textAlign: 'right', background: 'var(--surface-deep)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '6px 10px' }}>
          <div style={{ font: 'var(--weight-bold) 8px var(--font-sans)', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>ORÇAMENTO</div>
          <div style={{ font: 'var(--weight-black) 13px var(--font-mono)', color: 'var(--emerald-400)' }}>{fmt(d.team.budget)}</div>
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input iconLeft="🔍" placeholder="Buscar jogador ou time..." value={search} onChange={e => setSearch(e.target.value)} />

        {/* role filters */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {[null, ...d.roles].map((r, i) => {
            const active = role === r;
            return (
              <button key={i} onClick={() => setRole(r)}
                style={{ flexShrink: 0, height: 30, padding: '0 14px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                  background: active ? 'var(--emerald-tint-12)' : 'var(--surface-control)',
                  border: `1px solid ${active ? 'var(--emerald-tint-30)' : 'var(--border-strong)'}`,
                  color: active ? 'var(--emerald-400)' : 'var(--text-muted)',
                  font: 'var(--weight-bold) 11px var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {r || 'Todos'}
              </button>
            );
          })}
        </div>

        <SegmentedTabs tabs={[{ id: 't', label: 'Tempo' }, { id: 'b', label: 'Lance' }, { id: 'r', label: 'Rating' }]} defaultValue="t" />

        {/* auction cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 24 }}>
          {list.map(p => (
            <div key={p.id} onClick={() => setDetail(p)}
              style={{ background: 'var(--surface-deep)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-2xl)', padding: 14, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <RatingBadge value={p.rating} size="lg" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: 'var(--weight-bold) 16px var(--font-sans)', color: '#fff' }}>{p.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Badge tone="info" size="sm">{p.role}</Badge>
                    <span style={{ font: 'var(--weight-medium) 11px var(--font-sans)', color: 'var(--text-faint)' }}>{p.team}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, font: 'var(--weight-bold) 12px var(--font-mono)', color: 'var(--danger)' }}>
                  <span style={{ fontSize: 11 }}>⏱</span>{p.endsAt}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ font: 'var(--weight-semibold) 9px var(--font-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Lance atual</div>
                  <div style={{ font: 'var(--weight-black) 18px var(--font-mono)', color: '#fff' }}>{fmt(p.bid)}</div>
                </div>
                {p.bidder
                  ? <Badge tone={p.bidder === 'Você' ? 'emerald' : 'neutral'} dot={p.bidder === 'Você'}>{p.bidder === 'Você' ? 'Seu lance' : p.bidder}</Badge>
                  : <Badge tone="emerald" variant="solid">Sem lances</Badge>}
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-faint)', font: 'var(--weight-medium) 13px var(--font-sans)' }}>Nenhum jogador encontrado</div>
          )}
        </div>
      </div>

      {detail && <BidSheet player={detail} fmt={fmt} onClose={() => setDetail(null)} />}
    </div>
  );
}

function BidSheet({ player, fmt, onClose }) {
  const { Button, RatingBadge, StatBar, Badge } = window.StratifyDesignSystem_af4c64;
  const next = player.bid + 200000;
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--surface-overlay)', display: 'flex', alignItems: 'flex-end', zIndex: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'var(--surface-deep)', borderTopLeftRadius: 'var(--radius-sheet)', borderTopRightRadius: 'var(--radius-sheet)', borderTop: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-sheet)', padding: '14px 20px 24px' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-input)', margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <RatingBadge value={player.rating} size="lg" />
          <div style={{ flex: 1 }}>
            <div style={{ font: 'var(--weight-black) 18px var(--font-sans)', color: '#fff' }}>{player.name}</div>
            <div style={{ marginTop: 4 }}><Badge tone="info" size="sm">{player.role}</Badge> <span style={{ font: 'var(--weight-medium) 11px var(--font-sans)', color: 'var(--text-faint)' }}>{player.team}</span></div>
          </div>
          <div onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: 4 }}>✕</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 18 }}>
          {Object.entries(player.skills).map(([k, v]) => (
            <StatBar key={k} label={k} value={v} tone={v >= 90 ? 'emerald' : v >= 80 ? 'blue' : 'warning'} />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '12px 14px', marginBottom: 16 }}>
          <div>
            <div style={{ font: 'var(--weight-semibold) 9px var(--font-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Próximo lance mínimo</div>
            <div style={{ font: 'var(--weight-black) 22px var(--font-mono)', color: 'var(--emerald-400)' }}>{fmt(next)}</div>
          </div>
          <span style={{ font: 'var(--weight-medium) 11px var(--font-mono)', color: 'var(--danger)' }}>⏱ {player.endsAt}</span>
        </div>

        <Button fullWidth size="lg" onClick={onClose}>Dar Lance · {fmt(next)}</Button>
      </div>
    </div>
  );
}
window.MarketScreen = MarketScreen;
