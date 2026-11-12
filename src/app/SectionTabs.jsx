// Abas de uma seção da navegação principal. Cada aba é um hash próprio, então
// voltar, recarregar e compartilhar o endereço continuam funcionando. As abas
// vêm da tabela de rotas (src/app/routes.jsx).
import { SECTIONS, sectionOf, tabsOf } from './routes.jsx';
import Icon from '../ui/Icon.jsx';

export { SECTIONS, sectionOf };

export default function SectionTabs({ route, unread = 0 }) {
  const key = sectionOf(route);
  const section = SECTIONS[key];
  const tabs = key ? tabsOf(key) : [];
  if (!section || tabs.length < 2) return null;
  return <nav className="section-tabs" aria-label={`Seções de ${section.label}`}>
    {tabs.map(([path, label, icon]) => <a key={path} href={`#${path}`} className={`section-tab ${route === path ? 'active' : ''}`} aria-current={route === path ? 'page' : undefined}>
      {icon && <Icon name={icon}/>}{label}{path === 'mensagens' && unread > 0 && <span className="nav-badge" aria-label={`${unread} não lidas`}>{unread > 99 ? '99+' : unread}</span>}
    </a>)}
  </nav>;
}
