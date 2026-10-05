# Query types

Data shapes for query. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## PageOptions

```ts
export interface PageOptions {
    limit?: number;
    offset?: number;
}
```

## ObjectQuery

```ts
export interface ObjectQuery extends PageOptions {
    name?: string;
    kind?: string;
    panelId?: Id;
    parentId?: Id;
    id?: Id;
}
```

## ObjectSummary

```ts
export interface ObjectSummary {
    id: Id;
    kind: string;
    name: string;
    panelId?: Id;
    parentId?: Id;
    nameTruncated?: true;
}
```

## ObjectPageQuery

```ts
export interface ObjectPageQuery extends Omit<ObjectQuery, "offset"> {
    cursor?: string;
}
```

## ObjectPage

```ts
export interface ObjectPage {
    version: number;
    items: ObjectSummary[];
    nextCursor?: string;
}
```
