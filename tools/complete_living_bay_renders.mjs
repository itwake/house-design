// Preserve Blender/Python floating-point JSON types in the camera provenance.
import {execFileSync} from 'node:child_process';
execFileSync(process.env.PYTHON || 'python', ['-B', '-X', 'utf8', 'tools/complete_living_bay_renders.py'], {stdio:'inherit'});
