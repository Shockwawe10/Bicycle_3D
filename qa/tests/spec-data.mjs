// The spec, parsed from the docs (never from the page): STORYBOARD.md and GEOMETRY.md.
import fs from 'node:fs';
const md = f => fs.readFileSync(f, 'utf8').replace(/\u2212/g, '-').replace(/\r/g, '').split('\n');
const vec = s => s.split(',').map(Number);
export const joints = () => Object.fromEntries(md('GEOMETRY.md').map(l => l.match(/^\| ([A-Z_]+) \|[^|]*\|[^|]*\| (-?[\d.]+) \| (-?[\d.]+) \|$/)).filter(Boolean).map(m => [m[1], [+m[2], +m[3]]]));
export const MOUNT = Object.fromEntries([...fs.readFileSync('STORYBOARD.md', 'utf8').matchAll(/(frame|fork|wheelF|wheelR|drivetrain|handlebar|saddle) (BB|CROWN|FA|RA|STEM|STT)\b/g)].map(m => [m[1], m[2]]));
export const stages = () => md('STORYBOARD.md').map(l => l.match(/^\| (S\d+[ab]?) \| (\w+) \| ([\d.]+) \| ([\d.]+) \| \(([^)]*)\) \| \(([^)]*)\) \| (-?[\d.]+) \| ([01]) \| (\w+) \|/)).filter(Boolean)
  .map(m => ({ id: m[1], part: m[2], a: +m[3], b: +m[4], off: vec(m[5]), axis: vec(m[6]), deg: +m[7], o0: +m[8], ease: m[9] }));
export const cameraKeys = () => md('STORYBOARD.md').map(l => l.match(/^\| ([01]\.\d\d) \| (-?\d+(?:\.\d+)?) \| (-?\d+(?:\.\d+)?) \|/)).filter(Boolean).map(m => [+m[1], +m[2], +m[3]]);
export const beats = () => md('STORYBOARD.md').map(l => l.match(/^\| (hero|frame|fork|wheels|drivetrain|handlebar|saddle|finish) \| ([\d.]+) \| ([\d.]+) \|/)).filter(Boolean).map(m => ({ id: m[1], a: +m[2], b: +m[3] }));
export const reduced = () => md('STORYBOARD.md').map(l => l.match(/^\| R\d \| ([\d.]+) \| ([\d.]+) \|/)).filter(Boolean).map(m => [+m[1], +m[2]]);
// GEOMETRY.md section 6: the only places two parts may share space (a shaft running in its bore)
export const fits = () => md('GEOMETRY.md').map(l => l.match(/^\| `([\w/]+:\w+)` \| `([\w/]+)` \|/)).filter(Boolean).map(m => ({ shaft: m[1], host: m[2] }));
