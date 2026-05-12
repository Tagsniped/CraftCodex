export function parseZipEntries(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Zip directory not found.");
  const totalEntries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries = [];
  for (let i = 0; i < totalEntries; i += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength)).replace(/^\.\//, "");
    entries.push({ name, method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries.filter((entry) => entry.name && !entry.name.endsWith("/"));
}

export async function unzipEntry(buffer, entry) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const offset = entry.localOffset;
  if (view.getUint32(offset, true) !== 0x04034b50) throw new Error(`Bad zip entry: ${entry.name}`);
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const dataStart = offset + 30 + nameLength + extraLength;
  const data = bytes.slice(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method !== 8 || typeof DecompressionStream === "undefined") {
    throw new Error(`Unsupported zip compression for ${entry.name}.`);
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZipFile(file) {
  const buffer = await file.arrayBuffer();
  const entries = parseZipEntries(buffer);
  const decoder = new TextDecoder();
  const files = {};
  await Promise.all(entries.map(async (entry) => {
    const data = await unzipEntry(buffer, entry);
    files[entry.name] = {
      bytes: data,
      text: () => decoder.decode(data),
      dataUrl: () => {
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < data.length; i += chunkSize) {
          binary += String.fromCharCode(...data.slice(i, i + chunkSize));
        }
        return `data:${entry.name.endsWith(".png") ? "image/png" : "application/octet-stream"};base64,${btoa(binary)}`;
      },
    };
  }));
  return files;
}
