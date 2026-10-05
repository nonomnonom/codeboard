# Read a saved project in pages

Find objects and timing in a saved project before loading artwork. Use the returned version when requesting the next page.

## Query saved metadata without decoding artwork

```ts
const store = ProjectStore.open('film.cboard');
try {
  const page = store.query({ kind: 'shot', limit: 20 });
  const next = store.query({ kind: 'shot', limit: 20, offset: 20 }, { expectedVersion: page.version });
  console.log(page.summary, page.items, page.indexed, next.items);
} finally { store.close(); }
```

`query` supports ID, direct parent, panel, kind and case-insensitive name filters across the same objects as authoring discovery. It returns `{ summary, version, items, indexed }`, with 50 records by default, at most 200, truncated display labels and a 256 KiB total response limit. Store pages use binary ID order. Match labels against their full stored value; IDs are never truncated.

Current saved catalogs read only derived SQL metadata. They do not decode project/artwork/brush payloads. These optional tables share the same save transaction as authoritative project data. Partial panel edits update only the affected catalog rows. The catalog's header fingerprint detects saves by older runtimes, which do not maintain it. Missing or stale catalogs fall back to a validated full-document read and report `indexed: false`. Reads do not migrate files; the next full save rebuilds the catalog. Catalog changes do not themselves change the container version; schema-5 projects still require a container-3-capable reader. `verify()` compares a current catalog with the authoritative metadata and rejects corruption. Legacy `findObjects()` remains a narrower panel-object index query.
