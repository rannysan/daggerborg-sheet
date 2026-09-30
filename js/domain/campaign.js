// Regras de campanha e de permissão. Funções puras.
//
// Campanha: { id, name, description, ownerId, memberIds: [uid], members: { uid: { name } }, inviteOpen }
// O dono (ownerId) é o Mestre. Cada ficha pertence a no máximo uma campanha.

export const CAMPAIGN_NAME_MAX = 60;
export const CAMPAIGN_DESCRIPTION_MAX = 500;

export const isMaster = (campaign, uid) => Boolean(campaign && uid && campaign.ownerId === uid);
export const isMember = (campaign, uid) => Boolean(campaign && uid && campaign.memberIds?.includes(uid));

// O Mestre pode fechar os convites: o link para de aceitar gente nova
// (quem já está continua). Campanhas antigas, sem o campo, ficam abertas.
export const invitesOpen = (campaign) => campaign?.inviteOpen !== false;

export function memberName(campaign, uid) {
  return campaign?.members?.[uid]?.name || 'Jogador';
}

// Quem pode editar uma ficha: o dono, ou o Mestre da campanha em que ela está.
// Sem login (modo local) tudo é editável: as fichas são só deste aparelho.
export function canEditCharacter(character, { uid, campaign }) {
  if (!uid) return true;
  if (!character.ownerId || character.ownerId === uid) return true;
  return Boolean(character.campaignId && campaign?.id === character.campaignId && isMaster(campaign, uid));
}

export function validateCampaign({ name, description = '' }) {
  const errors = {};
  if (!name.trim()) errors.name = 'Dê um nome à campanha.';
  else if (name.trim().length > CAMPAIGN_NAME_MAX) errors.name = `Use até ${CAMPAIGN_NAME_MAX} caracteres.`;
  if (description.length > CAMPAIGN_DESCRIPTION_MAX) {
    errors.description = `Use até ${CAMPAIGN_DESCRIPTION_MAX} caracteres.`;
  }
  return errors;
}
