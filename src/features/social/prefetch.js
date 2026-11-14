import { prefetchResource } from '../../lib/resources.js';

// Endereço do recurso do perfil: o mesmo usado pela tela (Profile.jsx), para que o que
// foi buscado ao passar o mouse seja o que a tela encontra pronto ao abrir.
export function profilePath({ id = '', handle = '' }) {
  return handle && !id
    ? `/api/profile/@${encodeURIComponent(String(handle).toLowerCase())}`
    : `/api/profile/${encodeURIComponent(id)}`;
}

// Baixa a tela de perfil (carregada sob demanda) antes do primeiro clique.
export function preloadProfileScreen() {
  import('./Profile.jsx').catch(() => {});
}

// Passar o mouse, focar ou tocar já traz os dados do perfil: no clique, a tela abre pronta.
export function warmProfile(person) {
  if (!person || (!person.handle && !person.id)) return;
  preloadProfileScreen();
  prefetchResource(profilePath({ handle: person.handle, id: person.handle ? '' : person.id }));
}

export function warmProfileProps(person) {
  const warm = () => warmProfile(person);
  return { onPointerEnter: warm, onFocus: warm, onTouchStart: warm };
}
