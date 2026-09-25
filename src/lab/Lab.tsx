/**
 * /lab — auto-discovering demo registry. Demos live in src/lab/<slug>/index.tsx
 * and are picked up here automatically (demo builders own their folders).
 */
import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';

interface DemoMeta {
  title: string;
  blurb?: string;
  tags?: string[];
}

const modules = import.meta.glob('./*/index.tsx');

const loaders = Object.fromEntries(
  Object.entries(modules).map(([path, loader]) => [path.split('/')[1], loader]),
);

export function LabIndex() {
  const slugs = Object.keys(loaders).sort();
  const [metas, setMetas] = useState<Record<string, DemoMeta>>({});

  useEffect(() => {
    let live = true;
    for (const slug of slugs) {
      void loaders[slug]().then((m) => {
        if (!live) return;
        const meta = (m as { meta?: DemoMeta }).meta;
        if (meta) setMetas((prev) => ({ ...prev, [slug]: meta }));
      });
    }
    return () => { live = false; };
  }, [slugs]);

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
          <h2>Nothing mounted yet</h2>
          <p>
            The benches are clean and the tools are warm. Demos land here automatically as they're
            built — check back after the next wind.
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
      <Suspense fallback={<div className="boot">LOADING</div>}>
        <Demo />
      </Suspense>
    </div>
  );
}

export function LabRoutes() {
  return (
    <Routes>
      <Route index element={<LabIndex />} />
      <Route path=":slug" element={<LabDemo />} />
    </Routes>
  );
}
