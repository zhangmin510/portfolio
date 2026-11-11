export function openStorage(indexedDB = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!indexedDB) return reject(new Error('当前浏览器不支持实验存储，请使用现代浏览器'));
    const request = indexedDB.open('autoeval-private-v1', 1);
    request.onupgradeneeded = () => {
      for (const name of ['datasets', 'jobs']) request.result.createObjectStore(name, { keyPath: 'id' });
    };
    request.onerror = () => reject(new Error('无法打开浏览器存储，请检查隐私设置'));
    request.onblocked = () => reject(new Error('存储升级被其他标签页阻挡，请关闭旧页面再试'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      const operation = (store, mode, callback) => new Promise((accept, fail) => {
        const tx = db.transaction(store, mode);
        let value;
        const result = callback(tx.objectStore(store));
        result.onsuccess = () => { value = result.result; };
        tx.oncomplete = () => accept(value);
        tx.onerror = tx.onabort = () => fail(new Error('无法保存浏览器记录，请导出备份并检查存储空间'));
      });
      resolve({
        all: store => operation(store, 'readonly', s => s.getAll()),
        get: (store, id) => operation(store, 'readonly', s => s.get(id)),
        put: (store, value) => operation(store, 'readwrite', s => s.put(structuredClone(value))),
      });
    };
  });
}
