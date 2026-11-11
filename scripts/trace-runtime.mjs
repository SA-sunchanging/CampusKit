// Copies the files one built service needs at runtime into an output folder, so each Docker image
// holds only its own service's dependencies instead of the whole monorepo's node_modules.
// Usage (after `nest build <app>`): node scripts/trace-runtime.mjs <app> <outDir>
import { nodeFileTrace } from '@vercel/nft';
import { cp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const [app, outDir] = process.argv.slice(2);
if (!app || !outDir) throw new Error('usage: trace-runtime.mjs <app> <outDir>');

// Packages that a traced package loads through a computed name, which a static trace cannot follow.
// Add an entry here when a container logs "package is missing" or "Cannot find package".
const DYNAMIC_DEPS = {
  typeorm: ['pg'],
  '@nestjs/microservices': ['@grpc/grpc-js', '@grpc/proto-loader'],
};

const require = createRequire(path.resolve('package.json'));

async function trace(entries) {
  const { fileList } = await nodeFileTrace(entries, { base: process.cwd() });
  return [...fileList];
}

const files = new Set(await trace([`dist/apps/${app}/main.js`]));
const uses = (pkg) => [...files].some((file) => file.startsWith(`node_modules/${pkg}/`));
const extras = Object.entries(DYNAMIC_DEPS)
  .filter(([pkg]) => uses(pkg))
  .flatMap(([, deps]) => deps.map((dep) => require.resolve(dep)));
for (const file of extras.length > 0 ? await trace(extras) : []) files.add(file);

for (const file of files) {
  await cp(file, path.join(outDir, file), { recursive: true });
}
console.log(`traced ${files.size} files for ${app}`);
