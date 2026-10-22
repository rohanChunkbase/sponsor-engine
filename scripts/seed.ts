import { getReadyDb, counts } from "@sponsor-engine/core";

const db = getReadyDb();
console.log(JSON.stringify(counts(db), null, 2));
