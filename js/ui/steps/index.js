// Registro das etapas do wizard (pattern Registry).
// Para criar uma etapa: faça um arquivo com { id, title, render, validate }
// e adicione aqui na ordem desejada. O WizardPage não precisa mudar.
//
// Contrato de uma etapa:
//   id        → usado na URL (#/editar/:id/:step)
//   title     → texto no stepper
//   render(container, { character, current, update, gameData, images, errors })
//               character = ficha ao abrir a etapa; current() = ficha atualizada
//   validate(character, gameData) → { campo: 'mensagem' } (vazio = ok)
import { BasicInfoStep } from './BasicInfoStep.js';
import { AttributesStep } from './AttributesStep.js';
import { ClassStep } from './ClassStep.js';
import { EquipmentStep } from './EquipmentStep.js';
import { ExperiencesStep } from './ExperiencesStep.js';
import { OthersStep } from './OthersStep.js';

// Ordem das regras: distribuir atributos, depois escolher a classe
export const WIZARD_STEPS = Object.freeze([
  BasicInfoStep,
  AttributesStep,
  ClassStep,
  ExperiencesStep,
  EquipmentStep,
  OthersStep,
]);
