export function decodeXML(value) {
  return String(value||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,entity)=>{
    if(entity[0]==='#'){const n=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);return Number.isFinite(n)&&n<=0x10ffff?String.fromCodePoint(n):'';}
    return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[entity.toLowerCase()];
  }).replace(/\s+/g,' ').trim();
}
const field=(xml,tag)=>decodeXML(xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'))?.[1]||'');
export function parseArxivAtom(xml) {
  if(/<!DOCTYPE|<!ENTITY/i.test(xml)||!/<feed\b/.test(xml))throw new Error('Invalid arXiv Atom feed');
  const papers=[];
  for(const match of xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)){
    const entry=match[1],originalId=field(entry,'id');
    const id=originalId.match(/\/(\d{4}\.\d{4,5})(v\d+)?$/);
    if(!id)continue;
    const authors=[...entry.matchAll(/<author\b[^>]*>([\s\S]*?)<\/author>/gi)].map(m=>field(m[1],'name')).filter(Boolean);
    const published=field(entry,'published'),updated=field(entry,'updated'),title=field(entry,'title');
    if(!title||!authors.length||!Number.isFinite(Date.parse(published)))throw new Error(`Incomplete arXiv record ${id[1]}`);
    papers.push({id:id[1],version:id[2]||'',title,authors,published:published.slice(0,10),updated:updated.slice(0,10),arxivUrl:`https://arxiv.org/abs/${id[1]}`,pdfUrl:`https://arxiv.org/pdf/${id[1]}`});
  }
  if(!papers.length)throw new Error('arXiv returned no paper records');
  return [...new Map(papers.map(p=>[p.id,p])).values()];
}
