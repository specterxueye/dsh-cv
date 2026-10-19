// A fresh process models reopening DSH after an installation change. Reusing a
// process would retain Node's resolved paths from the previous linked package.
import assert from 'node:assert/strict';
import { existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const [cli, installed, profile, home, scratch] = process.argv.slice(2);
const hostRequire = createRequire(cli);
const loadHost = name => import(pathToFileURL(hostRequire.resolve(name)).href);
const { Context } = await loadHost('@deepseek-ai/cordis');
const registry = await loadHost('@deepseek-ai/dsh-skill');
const provider = await loadHost('@deepseek-ai/dsh-skill-filesystem');
const appBoot = await loadHost('@deepseek-ai/dsh-app-boot');
const loader = await loadHost('@deepseek-ai/cordis-plugin-loader');
const row = appBoot.loadOverlayPatches('dsh-cv-test', join(installed, 'cordis.patch.yml'))[0].insert[0];
const configValues = loader.interpolate({ baseUrl: pathToFileURL(join(profile, 'cordis.yml')).href }, row.config);
assert.equal(realpathSync(configValues.customSkillDirs[0]), realpathSync(join(installed, 'preset', 'skills')));
const ctx = new Context();
try {
  const registryFiber = ctx.plugin(registry.default);
  const providerFiber = ctx.plugin(provider, { ...configValues, dshHome: home, agentsHome: join(scratch, 'empty-agents'), watch: false });
  await registryFiber.await();
  await providerFiber.await();
  const catalog = await ctx.skills.list({ cwd: scratch });
  const names = catalog.map ? catalog.map(x => x.name) : catalog.skills.map(x => x.name);
  assert.deepEqual(names.sort(), ['cv-intake', 'interview-pitch', 'mock-interview', 'resume-writing']);
  const skill = await ctx.skills.get('resume-writing', { cwd: scratch });
  assert.equal(skill.provider, 'dsh-cv');
  assert.equal(realpathSync(join(skill.resourceBase.path, '../../..')), realpathSync(installed));
  assert.ok(existsSync(join(skill.resourceBase.path, '../../../data/rules/00-总则.md')));
  console.log('SKILLS_OK 4 actual host skills, current installed resource path');
} finally { await ctx.fiber.dispose(); }
