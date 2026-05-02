import React from 'react';

type RouteHandler = (params: Record<string, string>) => React.ReactNode;
type RouteEntry = { pattern: string; regex: RegExp; paramNames: string[]; handler: RouteHandler };

const routes: RouteEntry[] = [];
let currentPath: string = window.location.hash.slice(1) || '/';
const listeners: Set<() => void> = new Set();

export function addRoute(pattern: string, handler: RouteHandler) {
  const paramNames: string[] = [];
  const regexStr = pattern.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  routes.push({
    pattern,
    regex: new RegExp(`^${regexStr}$`),
    paramNames,
    handler
  });
}

export function navigate(path: string) {
  window.location.hash = path;
}

export function getCurrentPath(): string {
  return currentPath;
}

function matchRoute(path: string): { handler: RouteHandler; params: Record<string, string> } | null {
  for (const entry of routes) {
    const match = path.match(entry.regex);
    if (match) {
      const params: Record<string, string> = {};
      entry.paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      return { handler: entry.handler, params };
    }
  }
  return null;
}

window.addEventListener('hashchange', () => {
  currentPath = window.location.hash.slice(1) || '/';
  listeners.forEach(fn => fn());
});

export function Router() {
  const [path, setPath] = React.useState(currentPath);

  React.useEffect(() => {
    const unsub = subscribe(() => setPath(currentPath));
    return unsub;
  }, []);

  const match = matchRoute(path);
  if (match) {
    return React.createElement(React.Fragment, null, match.handler(match.params));
  }

  if (routes.length > 0 && routes.some(r => r.pattern === '/login')) {
    navigate('/login');
    return null;
  }
  return null;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
