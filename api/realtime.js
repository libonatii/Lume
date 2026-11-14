// Avisos em tempo real: o canal só diz que há novidade, e o cliente busca os dados
// pelas rotas HTTP. Falha no canal nunca impede a operação que gerou o aviso.

export async function announce(realtime, userId, event, log = () => {}) {
  if (!realtime?.notify || !userId) return;
  try {
    await realtime.notify(userId, event);
  } catch (error) {
    log('realtime_notify_failed', { error: error instanceof Error ? error.message : String(error) });
  }
}
