"""Rebuild 2024 Taiwan grain and crop figures from official ODS yearbook tables."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET
from zipfile import ZipFile

HERE = Path(__file__).resolve().parent
BASE = 'https://agrstat.moa.gov.tw/moasdweb/book/Book_File.ashx?chapter_id='
BOOKS = {
    'crops': ('1427_10', '6565eec0f9be2ae7621b436b62eeaf01014ce277e47a3d463ae900bc7e10398f'),
    'composition': ('1433_11','c5c67713d147eea1018cf592153df3b5009550f6e170401b8b6dee7c82979ad0'),
    'balance': ('1433_7', 'c478d8ad2cb4356ea0617eb1d156b04bc11740381d42ab6565254c6c35645767'),
}
T = '{urn:oasis:names:tc:opendocument:xmlns:table:1.0}'
P = '{urn:oasis:names:tc:opendocument:xmlns:text:1.0}'
COUNTIES = dict(item.split('|') for item in '''
新北市|65000 臺北市|63000 桃園市|68000 臺中市|66000 臺南市|67000 高雄市|64000
宜蘭縣|10002 新竹縣|10004 苗栗縣|10005 彰化縣|10007 南投縣|10008 雲林縣|10009
嘉義縣|10010 屏東縣|10013 臺東縣|10014 花蓮縣|10015 澎湖縣|10016 基隆市|10017
新竹市|10018 嘉義市|10020 金門縣|09020 連江縣|09007'''.split())
SIMPLIFY = str.maketrans('臺園縣蘭雲義東蓮門連', '台园县兰云义东莲门连')
# The printed sheets use repeated cells. Index the expanded columns.
MEASURES = {
    '總計': dict(riceAreaHa=3, riceYieldKgHa=6, paddyT=13, brownRiceT=16),
    '玉米,甘藷,落花生': dict(feedCornT=6, foodCornT=10, sweetPotatoT=15, peanutT=19),
    '其他雜糧': dict(sorghumT=6, adzukiBeanT=10, soybeanT=15, otherCoarseGrainT=18),
}


def get_book(cache, key, offline):
    chapter, digest = BOOKS[key]
    path = cache / (key+'.ods')
    if not path.exists():
        if offline:
            raise FileNotFoundError(path)
        cache.mkdir(parents=True, exist_ok=True)
        partial = path.with_suffix('.part')
        subprocess.run(['curl','-fsSL','--retry','2','--max-time','90', BASE+chapter+'_1','-o',str(partial)], check=True)
        partial.replace(path)
    if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
        raise ValueError(f'{key} source has changed; review the new edition before rebuilding')
    with ZipFile(path) as book:
        root = ET.fromstring(book.read('content.xml'))
    return {s.get(T+'name'):s for s in root.findall('.//'+T+'table')}


def sheet_rows(sheet):
    for row in sheet.findall(T+'table-row'):
        values=[]
        for cell in row:
            value = ''.join(''.join(p.itertext()) for p in cell.findall(P+'p'))
            repeats = min(int(cell.get(T+'number-columns-repeated',1)),40-len(values))
            values.extend([re.sub(r'\s+', '', value)]*repeats)
            if len(values)==40:
                break
        yield values


def number(text):
    if text in ('-', '－', '…'):
        return None
    if not re.fullmatch(r'[0-9,]+(?:\.[0-9]+)?',text):
        raise ValueError('Unrecognized printed number: '+repr(text))
    return float(text.replace(',','')) if '.' in text else int(text.replace(',',''))


def extract(cache, offline):
    crop_sheets=get_book(cache, 'crops', offline)
    total={}
    counties={name:dict(code=code, name=name.translate(SIMPLIFY), traditional=name) for name,code in COUNTIES.items()}
    for title, measures in MEASURES.items():
        seen=set()
        for row in sheet_rows(crop_sheets[title]):
            if len(row)<2:
                continue
            district=row[0]
            if row[1]=='113':
                target=total
                assert '2024' in row
            elif district in counties:
                target=counties[district]
                seen.add(district)
            else:
                continue
            for field,col in measures.items():
                target[field] = number(row[col])
        assert seen==set(COUNTIES)
    book=get_book(cache, 'balance', offline)
    rows=list(sheet_rows(book['糧食平衡表_(10)']))
    assert '10.民國113年糧食平衡表' in rows[1]
    assert rows[5][3]=='國內生產量' and '千公噸' in rows[3][0]
    assert rows[9][0]=='1.穀類'
    detail=list(sheet_rows(get_book(cache,'composition',offline)['4_1_1']))
    assert detail[2][0]=='(1)穀類國內生產量' and detail[3][0]=='單位：公噸'
    assert detail[5][12]=='(2024)' and detail[6][1]=='1.穀類'
    total['cerealsT']=number(detail[6][12])
    assert round(total['cerealsT']/1000,1)==number(rows[9][3])
    balance_parts={}
    for nth,(i,label) in enumerate([(11,'米'),(13,'小麥'),(14,'玉米'),(15,'高粱'),(16,'其他')],1):
        assert rows[i][2]==label and detail[6+nth][1]==f'({nth}){label}'
        balance_parts[label]=number(detail[6+nth][12])
        assert round(balance_parts[label]/1000,1)==number(rows[i][3])
    assert abs(sum(balance_parts.values())-total['cerealsT'])<=2
    assert total['cerealsT']==1406372 and total['paddyT']==1542942 and total['brownRiceT']==balance_parts['米']==1219183
    assert sum(c['paddyT'] is not None for c in counties.values())==18
    for field in [m for measures in MEASURES.values() for m in measures if m!='riceYieldKgHa']:
        # Districts and totals are rounded separately to displayed units.
        subtotal=sum(c[field] for c in counties.values() if c[field] is not None)
        assert abs(subtotal-total[field])<=len(counties)/2, (field,subtotal,total[field])
    return dict(year=2024,total=total,balanceComponentsT=balance_parts,counties=list(counties.values()),
                sources=dict(cereals=BASE+'1433_11_2',balance=BASE+'1433_7_2',crops=BASE+'1427_10_2',method=BASE+'1433_3_2',
                             cerealsOds=BASE+'1433_11_1',balanceOds=BASE+'1433_7_1',cropsOds=BASE+'1427_10_1'),
                notes=['穀類取自糧食平衡表的國內生產量，米按糙米重量計。該類另含小麥、玉米、高粱與其他穀類。',
                       '稻穀與糙米是同一收穫的兩種重量口徑。農業統計年報另列收穫面積、稻穀單產與各項雜糧生產量。',
                       '區域穀類總量未見分縣市發布。縣市原表中的橫線保留為 null，刊載為 0 的小量作物保留 0。'])


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', type=Path, required=True)
    parser.add_argument('--offline', action='store_true')
    args=parser.parse_args()
    data=extract(args.cache_dir,args.offline)
    (HERE/'grain.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
    print(data['total'])
    print('county/city rows:',len(data['counties']))
