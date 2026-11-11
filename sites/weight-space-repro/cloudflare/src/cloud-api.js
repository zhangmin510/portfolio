/* Browser API for the published explorer. All byte offsets refer to the pinned checkpoint. */
(() => {
  "use strict";

  const DATA_ROOT = "/data/";
  const MAX_BLOCK_BYTES = 8 * 1024 * 1024;
  const MAX_GAP_BYTES = 64 * 1024;
  const RANGE_CONCURRENCY = 4;
  const DTYPE_BYTES = { BF16: 2, F32: 4 };
  const PATCH_RECORD_BYTES = 6;
  const jsonCache = new Map();
  const assetCache = new Map();
  const patchCache = new Map();
  const floatBits = new DataView(new ArrayBuffer(4));
  const knownSorts = new Set(["name", "params", "bytes", "dtype"]);

  // Unicode folds that lowercase alone does not handle. Keep browser token
  // matching consistent with Python's str.casefold(), including µ and ß.
  const extraFolds = {
    "µ": "μ", "ß": "ss", "ŉ": "ʼn", "ſ": "s", "ǰ": "ǰ", "ͅ": "ι", "ΐ": "ΐ", "ΰ": "ΰ",
    "ς": "σ", "ϐ": "β", "ϑ": "θ", "ϕ": "φ", "ϖ": "π", "ϰ": "κ", "ϱ": "ρ", "ϵ": "ε",
    "և": "եւ", "ᏸ": "Ᏸ", "ᏹ": "Ᏹ", "ᏺ": "Ᏺ", "ᏻ": "Ᏻ", "ᏼ": "Ᏼ", "ᏽ": "Ᏽ", "ᲀ": "в",
    "ᲁ": "д", "ᲂ": "о", "ᲃ": "с", "ᲄ": "т", "ᲅ": "т", "ᲆ": "ъ", "ᲇ": "ѣ", "ᲈ": "ꙋ",
    "ẖ": "ẖ", "ẗ": "ẗ", "ẘ": "ẘ", "ẙ": "ẙ", "ẚ": "aʾ", "ẛ": "ṡ", "ὐ": "ὐ", "ὒ": "ὒ",
    "ὔ": "ὔ", "ὖ": "ὖ", "ᾀ": "ἀι", "ᾁ": "ἁι", "ᾂ": "ἂι", "ᾃ": "ἃι", "ᾄ": "ἄι", "ᾅ": "ἅι",
    "ᾆ": "ἆι", "ᾇ": "ἇι", "ᾐ": "ἠι", "ᾑ": "ἡι", "ᾒ": "ἢι", "ᾓ": "ἣι", "ᾔ": "ἤι", "ᾕ": "ἥι",
    "ᾖ": "ἦι", "ᾗ": "ἧι", "ᾠ": "ὠι", "ᾡ": "ὡι", "ᾢ": "ὢι", "ᾣ": "ὣι", "ᾤ": "ὤι", "ᾥ": "ὥι",
    "ᾦ": "ὦι", "ᾧ": "ὧι", "ᾲ": "ὰι", "ᾳ": "αι", "ᾴ": "άι", "ᾶ": "ᾶ", "ᾷ": "ᾶι", "ι": "ι",
    "ῂ": "ὴι", "ῃ": "ηι", "ῄ": "ήι", "ῆ": "ῆ", "ῇ": "ῆι", "ῒ": "ῒ", "ΐ": "ΐ", "ῖ": "ῖ",
    "ῗ": "ῗ", "ῢ": "ῢ", "ΰ": "ΰ", "ῤ": "ῤ", "ῦ": "ῦ", "ῧ": "ῧ", "ῲ": "ὼι", "ῳ": "ωι",
    "ῴ": "ώι", "ῶ": "ῶ", "ῷ": "ῶι", "ꭰ": "Ꭰ", "ꭱ": "Ꭱ", "ꭲ": "Ꭲ", "ꭳ": "Ꭳ", "ꭴ": "Ꭴ",
    "ꭵ": "Ꭵ", "ꭶ": "Ꭶ", "ꭷ": "Ꭷ", "ꭸ": "Ꭸ", "ꭹ": "Ꭹ", "ꭺ": "Ꭺ", "ꭻ": "Ꭻ", "ꭼ": "Ꭼ",
    "ꭽ": "Ꭽ", "ꭾ": "Ꭾ", "ꭿ": "Ꭿ", "ꮀ": "Ꮀ", "ꮁ": "Ꮁ", "ꮂ": "Ꮂ", "ꮃ": "Ꮃ", "ꮄ": "Ꮄ",
    "ꮅ": "Ꮅ", "ꮆ": "Ꮆ", "ꮇ": "Ꮇ", "ꮈ": "Ꮈ", "ꮉ": "Ꮉ", "ꮊ": "Ꮊ", "ꮋ": "Ꮋ", "ꮌ": "Ꮌ",
    "ꮍ": "Ꮍ", "ꮎ": "Ꮎ", "ꮏ": "Ꮏ", "ꮐ": "Ꮐ", "ꮑ": "Ꮑ", "ꮒ": "Ꮒ", "ꮓ": "Ꮓ", "ꮔ": "Ꮔ",
    "ꮕ": "Ꮕ", "ꮖ": "Ꮖ", "ꮗ": "Ꮗ", "ꮘ": "Ꮘ", "ꮙ": "Ꮙ", "ꮚ": "Ꮚ", "ꮛ": "Ꮛ", "ꮜ": "Ꮜ",
    "ꮝ": "Ꮝ", "ꮞ": "Ꮞ", "ꮟ": "Ꮟ", "ꮠ": "Ꮠ", "ꮡ": "Ꮡ", "ꮢ": "Ꮢ", "ꮣ": "Ꮣ", "ꮤ": "Ꮤ",
    "ꮥ": "Ꮥ", "ꮦ": "Ꮦ", "ꮧ": "Ꮧ", "ꮨ": "Ꮨ", "ꮩ": "Ꮩ", "ꮪ": "Ꮪ", "ꮫ": "Ꮫ", "ꮬ": "Ꮬ",
    "ꮭ": "Ꮭ", "ꮮ": "Ꮮ", "ꮯ": "Ꮯ", "ꮰ": "Ꮰ", "ꮱ": "Ꮱ", "ꮲ": "Ꮲ", "ꮳ": "Ꮳ", "ꮴ": "Ꮴ",
    "ꮵ": "Ꮵ", "ꮶ": "Ꮶ", "ꮷ": "Ꮷ", "ꮸ": "Ꮸ", "ꮹ": "Ꮹ", "ꮺ": "Ꮺ", "ꮻ": "Ꮻ", "ꮼ": "Ꮼ",
    "ꮽ": "Ꮽ", "ꮾ": "Ꮾ", "ꮿ": "Ꮿ", "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl",
    "ﬅ": "st", "ﬆ": "st", "ﬓ": "մն", "ﬔ": "մե", "ﬕ": "մի", "ﬖ": "վն", "ﬗ": "մխ",
  };
  const extraFoldPattern = new RegExp(`[${Object.keys(extraFolds).join("")}]`, "gu");

  function caseFold(value) {
    return value.toLowerCase().replace(extraFoldPattern, character => extraFolds[character]);
  }

  async function checkedFetch(url) {
    const response = await fetch(url);
    if (!response.ok) {
      let message = `${url} 返回 HTTP ${response.status}`;
      if (response.headers.get("Content-Type")?.includes("application/json")) {
        const payload = await response.json();
        if (typeof payload.error === "string") message = payload.error;
      }
      throw new Error(message);
    }
    return response;
  }

  function cached(cache, key, read) {
    if (!cache.has(key)) {
      const pending = read().catch(error => {
        cache.delete(key);
        throw error;
      });
      cache.set(key, pending);
    }
    return cache.get(key);
  }

  function data(filename) {
    return cached(jsonCache, filename, async () => {
      const compressed = filename !== "weights.json" &&
        (await data("weights.json")).compressedData?.includes(filename);
      const response = await checkedFetch(DATA_ROOT + filename + (compressed ? ".gz" : ""));
      if (!compressed) return response.json();
      if (typeof DecompressionStream !== "function" || !response.body) {
        throw new Error("当前浏览器无法解压 gzip 探索器数据");
      }
      const decoded = response.body.pipeThrough(new DecompressionStream("gzip"));
      return new Response(decoded).json();
    });
  }

  function integer(value, fallback, label) {
    if (value === undefined || value === null || value === "") return fallback;
    if (!/^[+-]?\d+$/.test(String(value).trim()) || !Number.isSafeInteger(Number(value))) {
      throw new Error(`${label} 必须是整数`);
    }
    return Number(value);
  }

  function variantOf(query) {
    const variant = query.variant || "base";
    if (variant !== "base" && variant !== "edited" && variant !== "delta") {
      throw new Error("未知权重版本");
    }
    return variant;
  }

  async function tensorOf(name) {
    const index = (await data("weights.json")).tensors;
    if (typeof name !== "string" || !Object.hasOwn(index, name)) {
      throw new Error("未知张量名称");
    }
    return index[name];
  }

  function sampleIndices(first, count, stride, size) {
    const length = Math.min(count, Math.floor((size - 1 - first) / stride) + 1);
    return Array.from({ length }, (_, i) => first + i * stride);
  }

  function blocksForRows(rowIndices, columnIndices, columns, itemBytes, offset) {
    const firstColumn = columnIndices[0];
    const lastColumn = columnIndices[columnIndices.length - 1];
    const blocks = [];
    for (const [index, row] of rowIndices.entries()) {
      const rowStart = offset + (row * columns + firstColumn) * itemBytes;
      const rowEnd = offset + (row * columns + lastColumn + 1) * itemBytes;
      const prior = blocks[blocks.length - 1];
      if (prior && rowStart - prior.end <= MAX_GAP_BYTES && rowEnd - prior.start <= MAX_BLOCK_BYTES) {
        prior.end = rowEnd;
        prior.rows.push({ index, start: rowStart });
      } else {
        if (rowEnd - rowStart > MAX_BLOCK_BYTES) throw new Error("单行读取超过分块上限");
        blocks.push({ start: rowStart, end: rowEnd, rows: [{ index, start: rowStart }] });
      }
    }
    return blocks;
  }

  async function binary(url, bytes) {
    const response = await checkedFetch(url);
    const advertised = response.headers.get("Content-Length");
    // Compressed static assets may advertise their compressed size. The decoded
    // buffer length below is the definitive check for all responses.
    if (advertised && !response.headers.get("Content-Encoding") && Number(advertised) !== bytes) {
      throw new Error("权重数据长度与索引不一致");
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== bytes) throw new Error("权重数据长度与索引不一致");
    return new DataView(buffer);
  }

  function asset(url, bytes) {
    if (typeof url !== "string" || !url.startsWith(DATA_ROOT)) {
      throw new Error("发布包缺少修改前后的张量文件");
    }
    return cached(assetCache, url, () => binary(url, bytes));
  }

  async function sparsePatch(tensor, elementCount) {
    const { patchPath: url, dtype } = tensor;
    if (dtype !== "BF16" || typeof url !== "string" || !url.startsWith("/data/patches/")) {
      throw new Error("稀疏 BF16 补丁索引无效");
    }
    const manifest = await data("weights.json");
    const expectedRecords = manifest.changes?.find(change => change.path === url)?.records;
    return cached(patchCache, url, async () => {
      const response = await checkedFetch(url);
      const view = new DataView(await response.arrayBuffer());
      const count = view.byteLength / PATCH_RECORD_BYTES;
      if (!Number.isInteger(count) || count > elementCount ||
          (expectedRecords !== undefined && count !== expectedRecords)) {
        throw new Error("稀疏 BF16 补丁长度与索引不一致");
      }
      let previous = -1;
      for (let offset = 0; offset < view.byteLength; offset += PATCH_RECORD_BYTES) {
        const index = view.getUint32(offset, true);
        if (index <= previous || index >= elementCount) {
          throw new Error("稀疏 BF16 补丁包含越界或未排序索引");
        }
        previous = index;
      }
      return { view, count };
    });
  }

  function patchedBits(patch, index) {
    let low = 0;
    let high = patch.count;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const offset = middle * PATCH_RECORD_BYTES;
      const candidate = patch.view.getUint32(offset, true);
      if (candidate === index) return patch.view.getUint16(offset + 4, true);
      if (candidate < index) low = middle + 1;
      else high = middle;
    }
    return undefined;
  }

  function decodeBFloat16(bits) {
    floatBits.setUint32(0, bits * 65536, true);
    return floatBits.getFloat32(0, true);
  }

  function readScalar(view, at, dtype) {
    if (dtype === "F32") {
      return { bits: view.getUint32(at, true), value: view.getFloat32(at, true) };
    }
    const bits = view.getUint16(at, true);
    return { bits, value: decodeBFloat16(bits) };
  }

  function serializeNumber(value) {
    if (Number.isFinite(value)) return value;
    if (Number.isNaN(value)) return "nan";
    return value > 0 ? "inf" : "-inf";
  }

  async function slice(query) {
    const tensor = await tensorOf(query.name);
    const variant = variantOf(query);
    const { shape, dtype, absolute_offset: offset, bytes } = tensor;
    const itemBytes = DTYPE_BYTES[dtype];
    if (!itemBytes) throw new Error(`未支持的数据类型 ${dtype}`);
    const columns = shape.length ? shape[shape.length - 1] : 1;
    const rows = shape.reduce((product, dim) => product * dim, 1) / columns;
    if (!Number.isSafeInteger(offset) || offset < 0 || rows * columns * itemBytes !== bytes) {
      throw new Error("权重字节索引不一致");
    }
    const rowStart = integer(query.row, 0, "起始行");
    const colStart = integer(query.col, 0, "起始列");
    const rowCount = integer(query.rows, 48, "显示行数");
    const colCount = integer(query.cols, 64, "显示列数");
    const rowStride = integer(query.row_stride, 1, "行步长");
    const colStride = integer(query.col_stride, 1, "列步长");
    if (rowStart < 0 || rowStart >= rows || colStart < 0 || colStart >= columns ||
        rowCount < 1 || rowCount > 256 || colCount < 1 || colCount > 256 ||
        rowStride < 1 || colStride < 1) {
      throw new Error("切片超出范围。显示行数和列数必须在 1–256 之间");
    }
    const rowIndices = sampleIndices(rowStart, rowCount, rowStride, rows);
    const columnIndices = sampleIndices(colStart, colCount, colStride, columns);
    const baseValues = new Array(rowIndices.length);
    const editedValues = new Array(rowIndices.length);
    const baseBits = new Array(rowIndices.length);
    const editedBits = new Array(rowIndices.length);
    const deltaValues = new Array(rowIndices.length);
    const patch = tensor.patchPath ? await sparsePatch(tensor, rows * columns) : null;

    function readRow(index, localStart, before, after) {
      const valuesBefore = [];
      const valuesAfter = [];
      const bitsBefore = [];
      const bitsAfter = [];
      const differences = [];
      for (const column of columnIndices) {
        const at = localStart + (column - colStart) * itemBytes;
        const a = readScalar(before, at, dtype);
        const replacement = patch ? patchedBits(patch, rowIndices[index] * columns + column) : undefined;
        let b = before === after ? a : readScalar(after, at, dtype);
        if (replacement !== undefined) b = { bits: replacement, value: decodeBFloat16(replacement) };
        valuesBefore.push(serializeNumber(a.value));
        valuesAfter.push(serializeNumber(b.value));
        bitsBefore.push(a.bits);
        bitsAfter.push(b.bits);
        differences.push(serializeNumber(b.value - a.value));
      }
      baseValues[index] = valuesBefore;
      editedValues[index] = valuesAfter;
      baseBits[index] = bitsBefore;
      editedBits[index] = bitsAfter;
      deltaValues[index] = differences;
    }

    if (!patch && (tensor.base_asset || tensor.edited_asset)) {
      const [before, after] = await Promise.all([
        asset(tensor.base_asset, bytes),
        asset(tensor.edited_asset, bytes),
      ]);
      rowIndices.forEach((row, index) => readRow(index, (row * columns + colStart) * itemBytes, before, after));
    } else {
      if (tensor.edited && !patch) throw new Error("发布包缺少已修改张量的数据");
      const blocks = blocksForRows(rowIndices, columnIndices, columns, itemBytes, offset);
      for (let i = 0; i < blocks.length; i += RANGE_CONCURRENCY) {
        await Promise.all(blocks.slice(i, i + RANGE_CONCURRENCY).map(async block => {
          const query = new URLSearchParams({ start: block.start, end: block.end });
          const view = await binary(`/weight-bytes?${query}`, block.end - block.start);
          for (const row of block.rows) readRow(row.index, row.start - block.start, view, view);
        }));
      }
    }

    const values = { base: baseValues, edited: editedValues, delta: deltaValues }[variant];
    return {
      name: query.name, dtype, shape, matrix_shape: [rows, columns],
      row_indices: rowIndices, column_indices: columnIndices, variant, values,
      base_values: baseValues, edited_values: editedValues, base_bits: baseBits,
      edited_bits: editedBits, bit_width: itemBytes * 8, sampling: "actual indexed values; no averaging",
    };
  }

  async function tensors(query) {
    const index = await data("tensors.json");
    const search = String(query.q || "").toLowerCase();
    const sort = knownSorts.has(query.sort) ? query.sort : "name";
    const order = query.order === "desc" ? -1 : 1;
    const rows = index.tensors.filter(tensor =>
      tensor.name.toLowerCase().includes(search) && (!query.group || tensor.group === query.group));
    rows.sort((a, b) => order * (a[sort] < b[sort] ? -1 : a[sort] > b[sort] ? 1 : 0));
    return { tensors: rows, total: rows.length, statistics_ready: index.statistics_ready };
  }

  async function histogram(query) {
    const tensor = await tensorOf(query.name);
    const variant = variantOf(query);
    const index = await data("histograms.json");
    const hist = Object.hasOwn(index, query.name) ? index[query.name] : null;
    if (hist?.[variant]) return hist[variant];
    if (tensor.edited || tensor.patchPath || tensor.base_asset || tensor.edited_asset || !hist?.base) {
      throw new Error("发布包缺少该张量的精确直方图");
    }
    if (variant === "edited") return hist.base;
    const edges = Array.from({ length: 65 }, (_, i) => -1e-6 + i * (2e-6 / 64));
    const counts = Array(64).fill(0);
    counts[32] = hist.base.total;
    return { edges, counts, total: hist.base.total, exact: true };
  }

  async function vocab(query) {
    const rows = await data("vocab.json");
    const search = String(query.q || "");
    const folded = caseFold(search);
    const matching = search ? rows.filter(row =>
      String(row.id) === search || caseFold(row.token).includes(folded)) : rows;
    const offset = Math.max(0, integer(query.offset, 0, "词表偏移"));
    const limit = Math.min(500, Math.max(1, integer(query.limit, 100, "词表页长")));
    return { total: matching.length, offset, limit, rows: matching.slice(offset, offset + limit) };
  }

  async function documentText(query) {
    const { files } = await data("overview.json");
    const file = files.find(file => file.path === query.file);
    if (!file || file.bytes > 2_000_000 ||
        !(/\.(json|md|txt|jinja|lock)$/i.test(file.path) || /(^|\/)(LICENSE|\.gitattributes)$/.test(file.path))) {
      throw new Error("可预览 2 MB 以内的文本文件，其他文件可直接下载");
    }
    const params = new URLSearchParams({ file: file.path });
    const response = await checkedFetch(`/download?${params}`);
    return { file: file.path, text: await response.text() };
  }

  window.cloudApi = async function cloudApi(path, query = {}) {
    switch (path) {
      case "/api/overview": return data("overview.json");
      case "/api/metadata": return data("metadata.json");
      case "/api/inference-trace": return data("inference-trace.json");
      case "/api/experiment": {
        const run = query.run || "smoke";
        if (run !== "smoke" && run !== "budget8192") throw new Error("未知实验运行");
        return data(`experiment-${run}.json`);
      }
      case "/api/tensors": return tensors(query);
      case "/api/slice": return slice(query);
      case "/api/histogram": return histogram(query);
      case "/api/vocab": return vocab(query);
      case "/api/document": return documentText(query);
      default: throw new Error(`未知探索器接口 ${path}`);
    }
  };
})();
