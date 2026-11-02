/** Attachment rules shared by the server and the editor (no database imports here). */
/** 4 MB keeps each upload under the 4.5 MB request limit of serverless hosts such as Vercel. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_FILES = 10;
/** Allowed extensions and the type each is served as. HTML, SVG and scripts are never accepted. */
export const FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv', txt: 'text/plain',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm',
};
export const ACCEPT = Object.keys(FILE_TYPES).map((x) => '.' + x).join(',');
/** Types a browser may show in a tab; everything else downloads. */
export const INLINE = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'video/mp4', 'video/webm']);
export const extOf = (name: string) => (name.toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
export const fsize = (n: number) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
