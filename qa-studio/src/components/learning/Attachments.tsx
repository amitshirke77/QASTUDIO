'use client';
import { useRef, useState } from 'react';
import { ACCEPT, MAX_FILE_BYTES, MAX_FILES, fsize } from '@/lib/fileTypes';
export type FileMeta = { id: string; name: string; type: string; size: number };

const icon = (t: string) => (t.includes('pdf') ? 'PDF' : t.includes('presentation') || t.includes('powerpoint') ? 'PPT' : t.includes('word') ? 'DOC' : t.includes('sheet') || t.includes('excel') || t === 'text/csv' ? 'XLS' : t.startsWith('image/') ? 'IMG' : t.startsWith('video/') ? 'VID' : t.startsWith('audio/') ? 'AUD' : 'TXT');

/** Upload and list attachments in the learning editor. Files upload straight away and are attached when the item is saved. */
export function AttachmentsEditor({ files, onChange }: { files: FileMeta[]; onChange: (f: FileMeta[]) => void }) {
  const ref = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const upload = async (list: FileList | null) => {
    if (!list?.length) return; setErr(''); let cur = files; const errs: string[] = [];
    for (const f of Array.from(list)) {
      if (cur.length >= MAX_FILES) { errs.push(`At most ${MAX_FILES} files per item.`); break; }
      if (f.size > MAX_FILE_BYTES) { errs.push(`${f.name} is ${fsize(f.size)}; the limit is ${fsize(MAX_FILE_BYTES)}. Put a SharePoint or OneDrive link in the content instead.`); continue; }
      setBusy(`Uploading ${f.name}…`); const fd = new FormData(); fd.set('file', f);
      const r = await fetch('/api/learning/files', { method: 'POST', body: fd }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      if (!r || !r.ok) { errs.push(j.error || `${f.name} could not be uploaded.`); continue; }
      cur = [...cur, j as FileMeta]; onChange(cur);
    }
    setBusy(''); setErr(errs.join(' ')); if (ref.current) ref.current.value = '';
  };
  return <section className="card stack">
    <div><h2>Attachments</h2><p className="muted small" style={{ margin: '4px 0 0' }}>Optional. Add the deck, process document, call recording or screenshots agents should go through. PDF, PowerPoint, Word, Excel, CSV, text, images, audio and video; up to {MAX_FILES} files of {fsize(MAX_FILE_BYTES)} each. Agents open them from the training before they accept it.</p></div>
    <div className="lrn-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }} style={{ border: '1.5px dashed var(--line)', borderRadius: 10, padding: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" className="btn" disabled={!!busy} onClick={() => ref.current?.click()}>Upload files</button>
      <span className="muted small">{busy || 'or drop files here'}</span>
      <input ref={ref} type="file" multiple accept={ACCEPT} hidden aria-label="Upload attachments" onChange={(e) => upload(e.target.files)} />
    </div>
    {files.length > 0 && <FileList files={files} onRemove={(id) => onChange(files.filter((f) => f.id !== id))} />}
    <div className="err" role="alert">{err}</div>
  </section>;
}
export function FileList({ files, onRemove }: { files: FileMeta[]; onRemove?: (id: string) => void }) {
  return <ul className="lrn-files" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
    {files.map((f) => <li key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}>
      <span className="chip" style={{ fontSize: 10, minWidth: 34, justifyContent: 'center' }}>{icon(f.type)}</span>
      <a href={`/api/learning/files/${f.id}`} target="_blank" rel="noopener" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</a>
      <span className="muted small mono">{fsize(f.size)}</span>
      <a className="btn ghost sm" href={`/api/learning/files/${f.id}?download=1`} aria-label={`Download ${f.name}`}>Download</a>
      {onRemove && <button type="button" className="btn ghost sm" aria-label={`Remove ${f.name}`} onClick={() => onRemove(f.id)}>✕</button>}
    </li>)}
  </ul>;
}
