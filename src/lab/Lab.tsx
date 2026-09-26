/**
 * /lab — auto-discovering demo registry. Demos live in src/lab/<slug>/index.tsx
 * OR in src/world/regions/<slug>/index.tsx as "demo-regions" (a component
 * default export carrying a named `meta` export with {title, blurb, tags}).
 * Both are picked up here automatically (demo builders own their folders).
 */
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';

interface DemoMeta {
  title: string;
  blurb?: string;
  tags?: string[];
}

type DemoModule = { default: React.ComponentType; meta?: DemoMeta };

const labModules = import.meta.glob('./*/index.tsx');
// demo-regions: a region folder counts as a demo only if its module exports
// a named `meta` with a title — pure world regions (saltmouth, …) don't.
const regionModules = import.meta.glob('../world/regions/*/index.tsx');

const loaders: Record<string, () => Promise<unknown>> = {};
for (const [path, loader] of Object.entries(regionModules)) {
  const slug = path.split('/')[3];
  loaders[slug] = loader;
}
for (const [path, loader] of Object.entries(labModules)) {
  loaders[path.split('/')[1]] = loader; // src/lab wins on collision
}
const LAB_SLUGS = new Set(Object.keys(labModules).map((p) => p.split('/')[1]));

export function LabIndex() {
  const [metas, setMetas] = useState<Record<string, DemoMeta>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all(
      Object.entries(loaders).map(async ([slug, loader]) => {
        try {
          const m = (await loader()) as DemoModule;
          return [slug, m.meta] as const;
        } catch {
          return [slug, undefined] as const;
        }
      }),
    ).then((entries) => {
      if (!live) return;
      const map: Record<string, DemoMeta> = {};
      for (const [slug, meta] of entries) if (meta) map[slug] = meta;
      setMetas(map);
      setLoaded(true);
    });
    return () => { live = false; };
  }, []);

  // show: src/lab demos always; region demos only once their meta proves them
  const slugs = Object.keys(loaders)
    .filter((slug) => LAB_SLUGS.has(slug) || metas[slug]?.title)
    .sort();

  return (
    <div className="lab-screen">
      <header className="sheet-head">
        <div>
          <h1>The Lab</h1>
          <p className="dim">Experiments, toys and prototypes from the Driftline workshed.</p>
        </div>
        <Link className="btn" to="/">← Title</Link>
      </header>
      {slugs.length === 0 ? (
        <div className="panel lab-empty">
          <h2>{loaded ? 'Nothing mounted yet' : 'Loading the benches…'}</h2>
          <p>
            {loaded
              ? "The benches are clean and the tools are warm. Demos land here automatically as they're built — check back after the next wind."
              : 'Warming up the workshed.'}
          </p>
        </div>
      ) : (
        <ul className="lab-grid">
          {slugs.map((slug) => {
            const meta = metas[slug];
            return (
              <li key={slug}>
                <Link className="lab-card panel" to={`/lab/${slug}`}>
                  <h3>{meta?.title ?? slug}</h3>
                  <p className="dim">{meta?.blurb ?? 'A workshed experiment.'}</p>
                  {meta?.tags && <p className="lab-tags">{meta.tags.map((t) => <span key={t}>{t}</span>)}</p>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function LabDemo() {
  const { slug } = useParams();
  const loader = slug ? loaders[slug] : undefined;
  if (!loader) {
    return (
      <div className="lab-screen">
        <p>Unknown demo. <Link to="/lab">← Lab</Link></p>
      </div>
    );
  }
  const Demo = lazy(loader as () => Promise<{ default: React.ComponentType }>);
  return (
    <div className="lab-demo">
      <div className="lab-demo-bar">
        <Link className="btn" to="/lab">← Lab</Link>
      </div>
      <ErrorBoundary slug={slug ?? ''}>
        <Suspense fallback={<div className="boot">LOADING</div>}>
          <Demo />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

/** Demos are built by parallel workers — a crashing bench must not take the app down. */
class ErrorBoundary extends React.Component<{ slug: string; children: React.ReactNode }, { failed: boolean }> {
  constructor(p: { slug: string; children: React.ReactNode }) {
    super(p);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { slug: string }) {
    if (prev.slug !== this.props.slug && this.state.failed) this.setState({ failed: false });
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="lab-screen">
          <div className="panel lab-empty">
            <h2>“{this.props.slug}” blew a gasket</h2>
            <p>This bench is mid-rebuild. <Link to="/lab">← Back to the Lab</Link></p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function LabRoutes() {
  return (
    <Routes>
      <Route index element={<LabIndex />} />
      <Route path=":slug" element={<LabDemo />} />
    </Routes>
  );
}
