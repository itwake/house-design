"""Dependency-free continuous clearance checks for conservative plan footprints.

These are fixed path witnesses, not accessibility certification or a search for
the only possible route. Walls, furniture and a fully open door are assumptions.
"""
import math


def point_segment_distance(point, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    length_squared = dx * dx + dy * dy
    if not length_squared:
        return math.dist(point, a)
    t = max(0, min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length_squared))
    return math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy)


def point_rectangle_distance(point, rectangle):
    x, y = point
    left, top, right, bottom = rectangle
    return math.hypot(max(left - x, 0, x - right), max(top - y, 0, y - bottom))


def segment_rectangle_distance(a, b, rectangle):
    """Exact minimum distance over a continuous segment, including intersections."""
    low, high = 0, 1
    for axis in range(2):
        delta = b[axis] - a[axis]
        if not delta:
            if not rectangle[axis] <= a[axis] <= rectangle[axis + 2]:
                low, high = 1, 0
                break
        else:
            u = (rectangle[axis] - a[axis]) / delta
            v = (rectangle[axis + 2] - a[axis]) / delta
            low, high = max(low, min(u, v)), min(high, max(u, v))
    if low <= high:
        return 0
    left, top, right, bottom = rectangle
    corners = ((left, top), (right, top), (right, bottom), (left, bottom))
    return min(point_rectangle_distance(a, rectangle), point_rectangle_distance(b, rectangle),
               *(point_segment_distance(point, a, b) for point in corners))


def solid_footprints(data, door_trim_cm=6):
    """Floor-level obstacles; shower trays remain walkable, screens do not."""
    result = []
    for index, wall in enumerate(data['walls']):
        x1, y1, x2, y2 = wall
        horizontal = y1 == y2
        if not horizontal and x1 != x2:
            raise ValueError('Clearance checker only supports axis-aligned walls')
        half = data.get('wallSpecs', [])[index].get('thicknessCm', 12) / 2
        fixed = y1 if horizontal else x1
        spans = [(min(x1, x2), max(x1, x2)) if horizontal else (min(y1, y2), max(y1, y2))]
        for door in data['doors']:
            if door.get('sillCm', 0) != 0:
                continue
            if horizontal:
                aligned = door['y1'] == door['y2'] == fixed
                low, high = sorted((door['x1'], door['x2']))
            else:
                aligned = door['x1'] == door['x2'] == fixed
                low, high = sorted((door['y1'], door['y2']))
            if not aligned:
                continue
            config=door.get('sliding')
            trim=config['jambCm'] if config else door_trim_cm
            low, high = low + trim, high - trim
            if config:
                if horizontal or config['stackTo']!='north': raise ValueError('Unsupported sliding stack')
                panel=(high-low+(config['panelCount']-1)*config['overlapCm'])/config['panelCount']
                parked=panel+(config['panelCount']-1)*config['stackStaggerCm']
                result.append((door['id']+' parked leaves',(fixed-config['frameDepthCm']/2,low,fixed+config['frameDepthCm']/2,low+parked)))
            clipped = []
            for a, b in spans:
                if high <= a or low >= b:
                    clipped.append((a, b))
                else:
                    if low > a:
                        clipped.append((a, low))
                    if high < b:
                        clipped.append((high, b))
            spans = clipped
        for a, b in spans:
            rectangle = (a, fixed - half, b, fixed + half) if horizontal else (fixed - half, a, fixed + half, b)
            result.append((f'wall {index}', rectangle))
    for fixture in data['furniture']:
        x, y, width, depth = (fixture[k] for k in ('x', 'y', 'w', 'd'))
        name = fixture['name']
        if '淋浴' in name:
            panel_length = min(60, depth - 67)
            result.append((name + ' fixed screen', (x + 1.1, y + 2, x + 1.9, y + 2 + panel_length)))
        elif '马桶' in name:
            # Deliberately conservative: apply the cistern width to the whole WC.
            if fixture.get('face', 'south') != 'south':
                raise ValueError('WC clearance envelope needs updating for non-south-facing fixtures')
            result.append((name + ' including cistern', (x - 5.5, y - .5, x + width + 5.5, y + depth)))
        else:
            result.append((name, (x, y, x + width, y + depth)))
    return result


def path_clearance(path, obstacles):
    return min((segment_rectangle_distance(a, b, rectangle), name, a, b)
               for a, b in zip(path, path[1:]) for name, rectangle in obstacles)


MASTER_PATH = [(469.5, 294), (469.5, 334), (472, 347), (478, 355), (482.5, 358.5), (486.5, 362), (490, 367),
               (495.75, 376), (495.75, 398), (500, 408), (506, 418), (524, 429),
               (550, 432), (588, 438), (625, 440)]
GUEST_PATH = [(390, 555), (422, 555), (450, 563), (480, 575),
              (505, 587), (535, 587), (585, 587), (630, 587)]
