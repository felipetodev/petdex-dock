import { bindContextMenu, getRendererElements } from './dom';
import { PetController } from './pet-controller';

window.addEventListener('DOMContentLoaded', () => {
  const { sprite, contextMenu } = getRendererElements();
  const controller = new PetController(window.petdex, sprite);

  void controller.loadActivePet();
  controller.start();

  window.petdex.onMousePositionChanged((mouseX: number) => {
    controller.handleMousePosition(mouseX);
  });

  bindContextMenu(contextMenu, () => window.petdex.openPetdexGallery());

  window.petdex.onPetChanged((pet) => {
    controller.handlePetChanged(pet);
  });

  window.petdex.onCliEvent((event) => {
    controller.handleCliEvent(event);
  });
});
