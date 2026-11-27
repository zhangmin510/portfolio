# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy>=1.26,<3", "pillow>=10,<14", "pyshp>=2.3,<4", "shapely>=2,<3"]
# ///
"""Build the site's WGS84 terrain texture and clipped vector layers.

Run with uv run scripts/build_terrain.py --cache-dir PATH.
Existing source files in PATH are reused; --offline forbids network access.
"""
import argparse
import json
import re
import subprocess
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlencode

import numpy as np
import shapefile
from PIL import Image
from shapely.geometry import box, shape
from shapely.ops import unary_union

BOUNDS = (70, 15, 137, 55)
WIDTH, HEIGHT = 1340, 800
FRAME = box(*BOUNDS)
SITE = Path(__file__).resolve().parents[1]
PHYSICAL = ('land', 'lakes', 'rivers_lake_centerlines')
CULTURAL = ('admin_0_countries', 'admin_1_states_provinces', 'admin_1_states_provinces_lines')
EXTRA_REGIONS = {'HKG': ('CN-HK', '香港'), 'MAC': ('CN-MO', '澳门'), 'TWN': ('CN-TW', '台湾')}
GIBS = 'https://gibs.earthdata.nasa.gov'
MODIS = 'MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual/default/2024-01-01/500m/4'
# A level-4 GIBS EPSG:4326 tile spans 18 degrees and contains 512 samples per side.
TILES = [(row, col) for row in range(1, 5) for col in range(13, 18)]
ETOPO = 'https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/ETOPO1_bedrock/ImageServer/exportImage'


def source_files():
    for category, layers in [('physical', PHYSICAL), ('cultural', CULTURAL)]:
        for layer in layers:
            name = f'ne_50m_{layer}.zip'
            yield name, f'https://naturalearth.s3.amazonaws.com/50m_{category}/{name}'
    query = urlencode(dict(bbox=','.join(map(str, BOUNDS)), bboxSR=4326, imageSR=4326,
                           size=f'{WIDTH},{HEIGHT}', format='tiff', pixelType='F32',
                           interpolation='RSP_BilinearInterpolation', f='image'))
    yield 'etopo1.tif', f'{ETOPO}?{query}'
    yield 'igbp.xml', f'{GIBS}/colormaps/v1.3/MODIS_IGBP_Land_Cover_Type.xml'
    for row, col in TILES:
        yield f'igbp-2024-4-{row}-{col}.png', f'{GIBS}/wmts/epsg4326/best/{MODIS}/{row}/{col}.png'


def acquire(cache, offline):
    def fetch(source):
        name, url = source
        target = cache / name
        if target.exists():
            return
        if offline:
            raise FileNotFoundError(target)
        partial = target.with_suffix('.part')
        subprocess.run(['curl', '--fail', '--silent', '--show-error', '--location',
                        '--retry', '3', '--max-time', '90', url, '-o', str(partial)], check=True)
        partial.replace(target)
    cache.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(fetch, source_files()))


def read_features(cache, layer):
    with shapefile.Reader(str(cache / f'ne_50m_{layer}.zip')) as src:
        for feature in src.iterShapeRecords(bbox=BOUNDS):
            if feature.shape.shapeType == shapefile.NULL:
                continue
            attributes = {key.lower(): val for key, val in feature.record.as_dict().items()}
            geom = shape(feature.shape.__geo_interface__)
            if not geom.is_valid:
                geom = geom.buffer(0)
            geom = geom.intersection(FRAME)
            if not geom.is_empty:
                yield attributes, geom


def paths(geom, polygons, tolerance=.014):
    simplified = geom.simplify(tolerance, preserve_topology=True)
    result = []

    def collect(g):
        if g.is_empty:
            return
        if g.geom_type == 'Polygon' and polygons:
            lines = [g.exterior, *g.interiors]
        elif g.geom_type == 'LineString' and not polygons:
            lines = [g]
        elif hasattr(g, 'geoms'):
            for item in g.geoms:
                collect(item)
            return
        else:
            return
        for line in lines:
            result.append([[round(x, 4), round(y, 4)] for x, y in line.coords])
    collect(simplified)
    return result


def geography(cache):
    areas = []
    country_geoms = []
    for record, geom in read_features(cache, 'admin_0_countries'):
        code = record['adm0_a3']
        if code == 'CHN' or code in EXTRA_REGIONS:
            country_geoms.append(geom)
        if code in EXTRA_REGIONS:
            iso, name = EXTRA_REGIONS[code]
            areas.append(dict(code=iso, name=name, rings=paths(geom, True)))
    for record, geom in read_features(cache, 'admin_1_states_provinces'):
        if record['adm0_a3'] == 'CHN':
            name = re.sub(r'(壮族自治区|回族自治区|维吾尔自治区|自治区|省|市)$', '', record['name_zh'])
            areas.append(dict(code=record['iso_3166_2'], name=name, rings=paths(geom, True)))
    assert len({item['code'] for item in areas if item['rings']}) == len(areas) == 34
    geometry = dict(bounds=BOUNDS, areas=sorted(areas, key=lambda item: item['code']),
                    country=paths(unary_union(country_geoms), True))
    for output, layer, polygons in [('land', 'land', True), ('rivers', 'rivers_lake_centerlines', False),
                                     ('lakes', 'lakes', True), ('provinces', 'admin_1_states_provinces_lines', False)]:
        geometry[output] = [path for record, geom in read_features(cache, layer)
                            if output != 'provinces' or record['adm0_a3'] == 'CHN'
                            for path in paths(geom, polygons)]
    return geometry


def terrain(cache):
    # Reduce the IGBP classification to game terrain. The final relief classes
    # combine this surface cover with measured elevation and slope.
    cover_to_tile = [0, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 5, 9, 10, 9, 8, 4, 0]
    legend = {}
    for entry in ET.parse(cache / 'igbp.xml').findall('.//ColorMapEntry'):
        raw = entry.get('sourceValue')
        if raw is not None:
            value = int(raw.split(',')[0])
            rgb = tuple(map(int, entry.attrib['rgb'].split(',')))
            legend[rgb] = cover_to_tile[value] if value < len(cover_to_tile) else 1

    # Calculate indices of each output pixel centre in the GIBS grid.
    x = np.floor(((np.arange(WIDTH) + .5) * .05 + BOUNDS[0] + 180) * 512 / 18).astype(int)
    y = np.floor((90 - BOUNDS[3] + (np.arange(HEIGHT) + .5) * .05) * 512 / 18).astype(int)
    cover = np.zeros((HEIGHT, WIDTH), dtype=np.uint8)
    for row, col in TILES:
        tile = Image.open(cache / f'igbp-2024-4-{row}-{col}.png')
        if tile.mode != 'P' or tile.size != (512, 512):
            raise ValueError('Unexpected GIBS tile format')
        palette = np.array(tile.getpalette(), dtype=np.uint8).reshape(-1, 3)
        lookup = np.array([legend.get(tuple(color), 1) for color in palette], dtype=np.uint8)
        ix = np.where(x // 512 == col)[0]
        iy = np.where(y // 512 == row)[0]
        pixels = np.asarray(tile)[np.ix_(y[iy] % 512, x[ix] % 512)]
        cover[np.ix_(iy, ix)] = lookup[pixels]

    image = Image.open(cache / 'etopo1.tif')
    assert image.mode == 'F' and image.size == (WIDTH, HEIGHT)
    assert np.allclose(image.tag_v2[33550][:2], (.05, .05))
    assert np.allclose(image.tag_v2[33922][3:5], (BOUNDS[0], BOUNDS[3]))
    z = np.asarray(image)
    assert np.isfinite(z).all() and -12000 < z.min() < 0 and 6000 < z.max() < 9000
    dy, dx = np.gradient(z)
    lat = BOUNDS[3] - (np.arange(HEIGHT) + .5) * .05
    east = dx / (5557 * np.cos(np.deg2rad(lat))[:, None])
    south = dy / 5557
    grade = np.hypot(east, south)
    land = cover != 0
    cover[land & (z > 1800) & (cover != 8) & ((grade > .025) | (z > 3300))] = 6
    cover[land & (cover != 8) & ((grade > .08) | ((grade > .04) & (z > 3800)))] = 7
    # Northwest light, with exaggerated slopes for legibility on small hexes.
    shade = np.clip(128 + 100 * np.tanh((east + south) * 7), 0, 255)
    elevation = np.clip(np.round(z / 32), 0, 255)
    pixels = np.stack([cover, np.rint(shade), elevation], axis=-1).astype(np.uint8)
    return Image.fromarray(pixels)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', type=Path, required=True)
    parser.add_argument('--offline', action='store_true')
    args = parser.parse_args()
    acquire(args.cache_dir, args.offline)
    data = SITE / 'data'
    data.mkdir(exist_ok=True)
    geo = geography(args.cache_dir)
    relief = terrain(args.cache_dir)
    (data / 'geography.json').write_text(json.dumps(geo, ensure_ascii=False, separators=(',', ':')) + '\n')
    relief.save(data / 'relief.png', optimize=True)
    print(f'{len(geo["areas"])} regions; {len(geo["rivers"])} river paths; {relief.size} terrain samples')


if __name__ == '__main__':
    main()
