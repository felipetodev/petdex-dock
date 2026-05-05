export type RendererElements = {
  sprite: HTMLElement;
  contextMenu: HTMLElement;
};

export function getRendererElements(): RendererElements {
  const sprite = document.getElementById('pet-sprite');
  const contextMenu = document.getElementById('context-menu');

  if (!sprite || !contextMenu) {
    throw new Error('Missing renderer DOM elements');
  }

  return { sprite, contextMenu };
}

export function setSpritesheet(sprite: HTMLElement, path: string): void {
  sprite.style.backgroundImage = `url('file://${path}')`;
}

export function showContextMenu(contextMenu: HTMLElement, x: number, y: number): void {
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.remove('hidden');
}

export function hideContextMenu(contextMenu: HTMLElement): void {
  contextMenu.classList.add('hidden');
}

export function bindContextMenu(
  contextMenu: HTMLElement,
  openPetdexGallery: () => Promise<void>
): void {
  contextMenu.addEventListener('click', async (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const menuItem = target?.closest<HTMLElement>('.menu-item');
    const action = menuItem?.dataset.action;

    if (action === 'change-pet') {
      hideContextMenu(contextMenu);
      await openPetdexGallery();
    }
  });

  window.addEventListener('contextmenu', (event: MouseEvent) => {
    event.preventDefault();
    showContextMenu(contextMenu, event.clientX, event.clientY);
  });

  window.addEventListener('click', () => {
    hideContextMenu(contextMenu);
  });
}
