// Abas de uma seção da navegação principal. Cada aba é um hash próprio, então
// voltar, recarregar e compartilhar o endereço continuam funcionando.
export const SECTIONS = {
  hoje: { label: 'Hoje', icon: 'home', home: 'hoje', tabs: [] },
  biblioteca: { label: 'Biblioteca', icon: 'book', home: 'biblioteca', tabs: [['biblioteca', 'Materiais'], ['github', 'GitHub']] },
  plano: { label: 'Plano', icon: 'list', home: 'plano', tabs: [['plano', 'Cronograma'], ['tarefas', 'Tarefas'], ['roteiro', 'Roteiro']] },
  amigos: { label: 'Amigos', icon: 'users', home: 'amigos', tabs: [['amigos', 'Contatos'], ['mensagens', 'Mensagens'], ['ranking', 'Ranking']] },
  perfil: { label: 'Perfil', icon: 'user', home: 'perfil', tabs: [['perfil', 'Meu perfil'], ['conquistas', 'Conquistas'], ['historico', 'Meu caminho'], ['configuracoes', 'Configurações']] },
};

export function sectionOf(route) {
  return Object.keys(SECTIONS).find((key) => SECTIONS[key].home === route || SECTIONS[key].tabs.some(([path]) => path === route)) || null;
}

export default function SectionTabs({ route, unread = 0 }) {
  const section = SECTIONS[sectionOf(route)];
  if (!section || !section.tabs.length) return null;
  return <nav className="section-tabs" aria-label={`Seções de ${section.label}`}>
    {section.tabs.map(([path, label]) => <a key={path} href={`#${path}`} className={`section-tab ${route === path ? 'active' : ''}`} aria-current={route === path ? 'page' : undefined}>
      {label}{path === 'mensagens' && unread > 0 && <span className="nav-badge" aria-label={`${unread} não lidas`}>{unread > 99 ? '99+' : unread}</span>}
    </a>)}
  </nav>;
}
