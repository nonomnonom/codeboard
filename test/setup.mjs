import { register } from "tsx/esm/api";

// Native Node execution keeps SQLite rows, typed arrays and structuredClone in one realm.
register();
