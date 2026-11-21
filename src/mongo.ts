/**
 * `defuss-db/mongo`: MongoDB's query language and aggregation pipelines over any defuss-db collection -
 * findMongo(collection, filter, { sort, projection, skip, limit }) and aggregateMongo(collection, pipeline), plus
 * the pieces they are made of (parseDocument for the shell's syntax, translateFilter, translatePipeline, ...).
 * A subpath, not the main entry: an application that never reads MongoDB syntax never loads it.
 * VERIFIED: scripts/e2e.mjs requires defuss-db/mongo from the packed tarball under CommonJS in Node and Bun.
 */
export * from './mongo-query.js';
export * from './mongo-pipeline.js';
