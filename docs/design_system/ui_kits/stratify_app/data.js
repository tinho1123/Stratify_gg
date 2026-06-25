// Mock data for the Stratify app UI kit — mirrors the real Supabase schema
// (teams, players, notifications, auctions) with stand-in content.

window.STRATIFY_DATA = {
  team: {
    name: 'BLACKOUT',
    budget: 8400000,
    ranking: 12,
    fans: 248000,
    wins: 34,
    losses: 11,
  },
  nextMatch: {
    badge: 'PRÓXIMA PARTIDA',
    title: 'FINAL DO TORNEIO',
    opponent: 'vs. Team Liquid',
    countdown: [{ v: 2, l: 'DIAS' }, { v: 14, l: 'HRS' }, { v: 32, l: 'MIN' }],
  },
  roster: [
    { id: 1, name: 'Gabriel Souza', role: 'IGL · Rifler', status: 'online', statusLabel: 'Online', rating: 91 },
    { id: 2, name: 'Rafael Costa', role: 'AWPer', status: 'online', statusLabel: 'Online', rating: 88 },
    { id: 3, name: 'Lucas Lima', role: 'Entry Fragger', status: 'injured', statusLabel: 'Lesão', rating: 79 },
    { id: 4, name: 'Pedro Alves', role: 'Support', status: 'online', statusLabel: 'Online', rating: 84 },
    { id: 5, name: 'Matheus Rocha', role: 'Lurker', status: 'banned', statusLabel: 'Banido', rating: 72 },
  ],
  performance: [
    { label: 'Moral', value: 85, tone: 'emerald' },
    { label: 'Forma', value: 92, tone: 'blue' },
    { label: 'Hype', value: 78, tone: 'warning' },
    { label: 'Comunicação', value: 70, tone: 'pink' },
  ],
  actions: [
    { icon: '🎯', label: 'TREINAR', sub: 'Melhorar skills', accent: 'var(--emerald-500)', screen: 'training' },
    { icon: '🏪', label: 'MERCADO', sub: 'Contratar jogadores', accent: 'var(--info)', screen: 'market' },
    { icon: '📋', label: 'TÁTICAS', sub: 'Estratégias do time', accent: 'var(--warning)', screen: null },
    { icon: '🎮', label: 'PARTIDAS', sub: 'Ver calendário', accent: 'var(--accent-pink)', screen: null },
  ],
  notifications: [
    { id: 1, type: 'success', tag: 'TRANSFERÊNCIA', message: 'Sua proposta por "kRavenz" foi aceita. Bem-vindo ao time!', read: false, date: '24 jun · 14:32' },
    { id: 2, type: 'alert', tag: 'LESÃO', message: 'Lucas Lima sofreu uma lesão e ficará 3 dias indisponível.', read: false, date: '24 jun · 09:10' },
    { id: 3, type: 'info', tag: 'MERCADO', message: 'Novo leilão aberto: AWPer rating 90 disponível por 6h.', read: true, date: '23 jun · 21:45' },
  ],
  market: [
    { id: 11, name: 'kRavenz', role: 'AWPer', team: 'Free Agent', rating: 92, bid: 4200000, bidder: 'MIBR', endsAt: '02:14:08', skills: { Mira: 95, 'Game Sense': 88, Awareness: 90 } },
    { id: 12, name: 'b1t0', role: 'Rifler', team: 'Pain Gaming', rating: 86, bid: 2800000, bidder: 'Você', endsAt: '05:41:22', skills: { Mira: 84, 'Game Sense': 89, Awareness: 82 } },
    { id: 13, name: 'zelW', role: 'IGL', team: 'Imperial', rating: 83, bid: 1900000, bidder: 'LOUD', endsAt: '11:08:55', skills: { Mira: 72, 'Game Sense': 94, Awareness: 88 } },
    { id: 14, name: 'noxiD', role: 'Support', team: 'Free Agent', rating: 77, bid: 950000, bidder: null, endsAt: '18:30:00', skills: { Mira: 70, 'Game Sense': 80, Awareness: 84 } },
  ],
  roles: ['AWPer', 'Rifler', 'IGL', 'Entry', 'Support'],
};
