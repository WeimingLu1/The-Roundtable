import React from 'react';

type RouteHandler = () => React.ReactNode;

const routes: Map<string, RouteHandler> = new Map();
let currentPath: string = window.location.hash.slice(1) || '/';
const listeners: Set<() => void> = new Set();

export function addRoute(path: string, handler: RouteHandler) {
  routes.set(path, handler);
}

export function navigate(path: string) {
  window.location.hash = path;
}

export function getCurrentPath(): string {
  return currentPath;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

window.addEventListener('hashchange', () => {
  currentPath = window.location.hash.slice(1) || '/';
  listeners.forEach(fn => fn());
});

export function Router() {
  const [path, setPath] = React.useState(currentPath);

  React.useEffect(() => {
    return subscribe(() => setPath(currentPath));
  }, []);

  const handler = routes.get(path);
  if (handler) return React.createElement(React.Fragment, null, handler());

  // Default: redirect to /login
  if (routes.has('/login')) {
    navigate('/login');
    return null;
  }
  return null;
}
