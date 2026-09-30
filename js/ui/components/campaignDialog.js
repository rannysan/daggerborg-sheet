// Diálogo de criar/editar campanha (nome + descrição)
import { h } from '../dom.js';
import { openDialog } from './dialog.js';
import { textField, textAreaField } from './fields.js';
import { CAMPAIGN_DESCRIPTION_MAX, CAMPAIGN_NAME_MAX, validateCampaign } from '../../domain/campaign.js';
import { hasErrors } from '../../domain/validation.js';

/**
 * @param {{ title: string, confirmLabel: string, initial?: { name, description },
 *           onSubmit: (values: { name, description }) => Promise<void> }} options
 */
export function openCampaignDialog({ title, confirmLabel, initial = { name: '', description: '' }, onSubmit }) {
  const values = { ...initial };
  const fields = h('div', { class: 'grade-formulario grade-formulario--simples' });

  const render = (errors = {}) => {
    fields.replaceChildren(
      textField({
        label: 'Nome da campanha',
        value: values.name,
        maxLength: CAMPAIGN_NAME_MAX,
        placeholder: 'Ex.: A Queda de Galgaroth',
        error: errors.name,
        onInput: (v) => { values.name = v; },
      }),
      textAreaField({
        label: 'Descrição (opcional)',
        value: values.description,
        rows: 3,
        maxLength: CAMPAIGN_DESCRIPTION_MAX,
        error: errors.description,
        onInput: (v) => { values.description = v; },
      }),
    );
  };
  render();

  openDialog({
    title,
    confirmLabel,
    content: [fields],
    onConfirm: async () => {
      const errors = validateCampaign(values);
      if (hasErrors(errors)) {
        render(errors);
        return false; // mantém aberto
      }
      await onSubmit(values);
      return true;
    },
  });
  fields.querySelector('input')?.focus();
}
