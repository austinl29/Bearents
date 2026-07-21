let queue = [];
let showing = false;
let container = null;

function ensureContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

function showNext() {
  if (showing || queue.length === 0) return;
  showing = true;
  const message = queue.shift();
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  ensureContainer().appendChild(node);
  requestAnimationFrame(() => node.classList.add('show'));
  setTimeout(() => {
    node.classList.remove('show');
    setTimeout(() => {
      node.remove();
      showing = false;
      showNext();
    }, 250);
  }, 2000);
}

function toast(message) {
  queue.push(message);
  showNext();
}

export { toast };
