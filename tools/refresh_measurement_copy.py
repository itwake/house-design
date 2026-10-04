"""Prove a window-copy-only change and refresh manifests without rebuilding meshes.

First, while all build/render processes are stopped:
    python tools/refresh_measurement_copy.py --capture
Then run the idempotent JS migration and load EACH existing native scene:
    blender --background models/schemes/wood/huiyayuan-wood.blend \
      --python tools/refresh_measurement_copy.py -- wood

Only windows[*].name and windows[*].designScenario may differ. The old native
file and GLB must match the captured hashes, and the manifest must still name
the captured old source. Actual completed frame records remain byte-for-byte
equivalent JSON values with their ORIGINAL source/camera/image hashes. The
reversible proof permits that old source only for these text-only changes.
"""
import array
import copy
import hashlib
import importlib.util
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKUP = ROOT / 'tmp/measurement-copy-baseline-20261004'
SCHEMES = {'wood': 'build_wood_kitchen.py',
           'family': 'build_family_storage.py',
           'laundry': 'build_laundry_layout.py'}
ALLOWED = ('name', 'designScenario')


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def source_hash(raw):
    return digest(raw.replace(b'\r\n', b'\n'))


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def capture():
    if BACKUP.exists():
        raise RuntimeError(f'Refusing to overwrite review evidence: {BACKUP}')
    prepared = []
    # Validate all three before creating any backup.
    for sid in SCHEMES:
        directory = ROOT / 'models/schemes' / sid
        data = directory / 'design-data.json'
        manifest = directory / 'scene-manifest.json'
        raw = data.read_bytes()
        previous = read_json(manifest)
        expected = source_hash(raw)
        if previous.get('sourceSha256') != expected:
            raise RuntimeError(f'{sid}: current manifest does not belong to current data')
        if previous.get('measurementRevision', {}).get('version') != '3.6.0':
            raise RuntimeError(f'{sid}: requires the built partial-measurement native scene')
        proof = {'scheme': sid, 'capturedAt': datetime.now(timezone.utc).isoformat(),
                 'oldSourceSha256': expected, 'oldManifestSha256': digest(manifest.read_bytes()),
                 'nativeBlendSha256': digest((directory / 'huiyayuan-wood.blend').read_bytes()),
                 'nativeGlbSha256': digest((directory / 'huiyayuan-wood.glb').read_bytes())}
        prepared.append((sid, data, manifest, proof))
    for sid, data, manifest, proof in prepared:
        folder = BACKUP / sid
        folder.mkdir(parents=True)
        shutil.copy2(data, folder / 'design-data.json')
        shutil.copy2(manifest, folder / 'scene-manifest.json')
        (folder / 'proof.json').write_text(json.dumps(proof, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'captured': list(SCHEMES), 'evidence': str(BACKUP)}, ensure_ascii=False))


def without_copy(data):
    stripped = copy.deepcopy(data)
    for window in stripped['windows']:
        for key in ALLOWED:
            window.pop(key, None)
    return stripped


def scene_mesh_signature(bpy):
    """Hash real mesh topology/vertices, placement and material bindings."""
    result = hashlib.sha256()
    meshes = {}
    objects = sorted((obj for obj in bpy.context.scene.objects if obj.type == 'MESH'), key=lambda obj: obj.name)
    for obj in objects:
        result.update(json.dumps({'object': obj.name, 'mesh': obj.data.name,
                                  'matrix': [value for row in obj.matrix_world for value in row],
                                  'materials': [slot.material.name if slot.material else None for slot in obj.material_slots],
                                  'hiddenRender': obj.hide_render, 'hiddenViewport': obj.hide_get()},
                                 sort_keys=True).encode())
        mesh = obj.data
        if mesh.name not in meshes:
            signature = hashlib.sha256()
            coordinates = array.array('f', [0.0]) * (len(mesh.vertices) * 3)
            mesh.vertices.foreach_get('co', coordinates)
            signature.update(coordinates.tobytes())
            vertices = array.array('i', [0]) * len(mesh.loops)
            mesh.loops.foreach_get('vertex_index', vertices)
            signature.update(vertices.tobytes())
            for property_name in ('loop_start', 'loop_total', 'material_index'):
                values = array.array('i', [0]) * len(mesh.polygons)
                mesh.polygons.foreach_get(property_name, values)
                signature.update(values.tobytes())
            meshes[mesh.name] = signature.hexdigest()
        result.update(meshes[mesh.name].encode())
    return {'sha256': result.hexdigest(), 'meshObjects': len(objects), 'meshDatablocks': len(meshes)}


def javascript_source_bytes(data):
    """Use the exact source writer's serializer; Python float syntax can differ."""
    node = shutil.which('node')
    if not node:
        raise RuntimeError('Node is required to prove the original source byte hash')
    process = subprocess.run([node, '-e',
                              "const fs=require('fs');process.stdout.write(JSON.stringify(JSON.parse(fs.readFileSync(0,'utf8')),null,2)+'\\n');"],
                             input=json.dumps(data, ensure_ascii=False).encode('utf-8'),
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    return process.stdout


def refresh(sid):
    import bpy
    directory = ROOT / 'models/schemes' / sid
    backup = BACKUP / sid
    data_path = directory / 'design-data.json'
    manifest_path = directory / 'scene-manifest.json'
    native = directory / 'huiyayuan-wood.blend'
    glb = directory / 'huiyayuan-wood.glb'
    proof = read_json(backup / 'proof.json')
    old_raw = (backup / 'design-data.json').read_bytes()
    current_raw = data_path.read_bytes()
    old_data, data = json.loads(old_raw), json.loads(current_raw)
    old_manifest_raw = manifest_path.read_bytes()
    old_manifest = json.loads(old_manifest_raw)
    old_hash, new_hash = source_hash(old_raw), source_hash(current_raw)
    if Path(bpy.data.filepath).resolve() != native.resolve():
        raise RuntimeError(f'{sid}: wrong loaded native scene: {bpy.data.filepath}')
    if old_hash != proof['oldSourceSha256'] or old_manifest.get('sourceSha256') != old_hash:
        raise RuntimeError(f'{sid}: prior manifest/source proof does not match')
    if digest((backup / 'scene-manifest.json').read_bytes()) != proof['oldManifestSha256']:
        raise RuntimeError(f'{sid}: captured manifest evidence changed')
    if digest(old_manifest_raw) != proof['oldManifestSha256']:
        raise RuntimeError(f'{sid}: manifest changed after capture; stop builds/renders before refreshing')
    if old_manifest.get('measurementRevision') != old_data.get('measurementRevision'):
        raise RuntimeError(f'{sid}: native manifest is not the captured measurement revision')
    if without_copy(old_data) != without_copy(data):
        raise RuntimeError(f'{sid}: non-copy source changes require a real geometry rebuild')
    if digest(native.read_bytes()) != proof['nativeBlendSha256'] or digest(glb.read_bytes()) != proof['nativeGlbSha256']:
        raise RuntimeError(f'{sid}: native scene or GLB changed after capture')
    changes = []
    for old_window, window in zip(old_data['windows'], data['windows']):
        for key in ALLOWED:
            if old_window.get(key) != window.get(key):
                changes.append({'window': window['id'], 'field': key,
                                'beforePresent': key in old_window, 'before': old_window.get(key),
                                'afterPresent': key in window, 'after': window.get(key)})
    if not changes or old_hash == new_hash:
        raise RuntimeError(f'{sid}: no metadata-only change to refresh')
    restored = copy.deepcopy(data)
    for change in changes:
        window = next(window for window in restored['windows'] if window['id'] == change['window'])
        if change['beforePresent']:
            window[change['field']] = change['before']
        else:
            window.pop(change['field'], None)
    if source_hash(javascript_source_bytes(restored)) != old_hash:
        raise RuntimeError(f'{sid}: reversible copy evidence does not restore the exact old source SHA')
    mesh_before = scene_mesh_signature(bpy)
    spec = importlib.util.spec_from_file_location('metadata_copy_builder', ROOT / 'tools' / SCHEMES[sid])
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    builder = module.b
    if builder.MODEL_DIR.resolve() != directory.resolve():
        raise RuntimeError(f'{sid}: builder output directory mismatch')
    builder.HEIGHT = float(data.get('wallHeightCm', 270)) / 100
    builder.THICK = float(data.get('wallThicknessCm', 12)) / 100
    if sid == 'family':
        module.configure_flow_views(data)
    try:
        openings = builder.load_openings(data)
        builder.manifest(data, openings, data_path)
        result = read_json(manifest_path)
        if result.get('sourceSha256') != new_hash:
            raise RuntimeError(f'{sid}: regenerated manifest source mismatch')
        mesh_after = scene_mesh_signature(bpy)
        if mesh_after != mesh_before:
            raise RuntimeError(f'{sid}: manifest refresh unexpectedly modified scene mesh state')
        if digest(native.read_bytes()) != proof['nativeBlendSha256'] or digest(glb.read_bytes()) != proof['nativeGlbSha256']:
            raise RuntimeError(f'{sid}: metadata refresh unexpectedly changed a native model file')
        # Keep all actual frame provenance intact. Old source hashes remain old;
        # validators can replay changes above to prove source equivalence.
        for key in ('renderedViews', 'baseBlendSha256', 'renderSpec'):
            if key in old_manifest:
                result[key] = old_manifest[key]
        result['metadataOnlySourceRefresh'] = {
            'date': '2026-10-04', 'method': 'Validated current window labels/scenario copy only; native meshes and files unchanged',
            'oldSourceSha256': old_hash, 'currentSourceSha256': new_hash,
            'nativeBlendSha256': proof['nativeBlendSha256'], 'nativeGlbSha256': proof['nativeGlbSha256'],
            'meshStateBeforeAndAfter': mesh_after, 'changes': changes,
            'sourceSerialization': "JSON.stringify(data, null, 2) + '\\n'; CRLF normalized to LF",
            'previousRenderRecordsPreserved': len(old_manifest.get('renderedViews', {})),
            'renderStatus': 'Actual completed frames preserved with original hashes; render all missing views before publishing',
        }
        if result.get('renderedViews', {}) != old_manifest.get('renderedViews', {}):
            raise RuntimeError(f'{sid}: completed frame provenance changed')
        manifest_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    except Exception:
        # Restore only the manifest this function replaced, never native files.
        manifest_path.write_bytes(old_manifest_raw)
        raise
    print(json.dumps({'scheme': sid, 'changes': len(changes), 'sourceSha256': new_hash,
                      'nativeMeshesUnchanged': True,
                      'renderedViewsPreserved': len(old_manifest.get('renderedViews', {}))}, ensure_ascii=False))


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    if args == ['--capture']:
        capture()
    elif len(args) == 1 and args[0] in SCHEMES:
        refresh(args[0])
    else:
        raise SystemExit('Use Python --capture, or Blender with -- wood|family|laundry')
