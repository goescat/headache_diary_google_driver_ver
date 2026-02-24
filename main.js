
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const STORAGE_KEY = 'headache_diary_v1';
const GOOGLE_CLIENT_ID = window.APP_CONFIG.GOOGLE_CLIENT_ID;
const DRIVE_FILE_ID_KEY = window.APP_CONFIG.DRIVE_FILE_ID_KEY;

function loadEntries() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    try { const parsed = JSON.parse(raw); if (typeof parsed === 'object' && parsed !== null) return parsed; return {}; } catch (e) { console.error('loadEntries parse error', e); return {}; }
}
function saveEntries(obj) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); return true; } catch (e) { console.error('saveEntries failed', e); alert('儲存失敗：' + e.message); return false; } }

let entries = loadEntries();

// ---------- calendar UI ----------
let viewDate = new Date();
const calendarEl = document.getElementById('calendar');
const monthLabel = document.getElementById('monthLabel');
document.getElementById('prev').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() - 1); renderCalendar(); });
document.getElementById('next').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() + 1); renderCalendar(); });

// ---------- file import/export (local) ----------
document.getElementById('exportBtn').addEventListener('click', () => {
    try { const arr = Object.entries(entries).map(([id, entry]) => ({ id, ...entry })); const blob = new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'headache_diary.json'; a.click(); URL.revokeObjectURL(url); } catch (e) { alert('匯出失敗：' + e.message); }
});

const importFile = document.getElementById('importFile');
document.getElementById('importBtn').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return; try {
        const txt = await f.text(); const data = JSON.parse(txt); let incoming = {}; if (Array.isArray(data)) { data.forEach(item => { const id = item.id || ('id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)); const copy = { ...item }; delete copy.id; incoming[id] = copy; }); } else if (typeof data === 'object' && data !== null) { incoming = data; } else throw new Error('不支援的 JSON 格式'); Object.entries(incoming).forEach(([k, v]) => { if (entries[k]) { const newId = 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); entries[newId] = v; } else entries[k] = v; }); const ok = saveEntries(entries); if (ok) {
            renderCalendar(); alert('已匯入並合併紀錄'); // if drive connected, auto-upload
            if (driveConnected()) { autoUploadToDrive(); }
        }
    } catch (err) { alert('匯入失敗：' + err.message); } importFile.value = '';
});

function startOfWeek(d) { const dt = new Date(d); const day = dt.getDay(); dt.setDate(dt.getDate() - day); dt.setHours(0, 0, 0, 0); return dt; }
function formatISODate(d) { const y = d.getFullYear(); const m = ('0' + (d.getMonth() + 1)).slice(-2); const day = ('0' + d.getDate()).slice(-2); return `${y}-${m}-${day}`; }

function renderCalendar() { calendarEl.innerHTML = ''; const year = viewDate.getFullYear(); const month = viewDate.getMonth(); monthLabel.textContent = `${year} 年 ${month + 1} 月`; const wds = ['日', '一', '二', '三', '四', '五', '六']; wds.forEach(w => { const el = document.createElement('div'); el.className = 'weekday'; el.textContent = w; calendarEl.appendChild(el); }); const first = new Date(year, month, 1); const start = startOfWeek(first); for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); const iso = formatISODate(d); const tpl = document.getElementById('cellTemplate'); const node = tpl.content.firstElementChild.cloneNode(true); node.querySelector('.date').textContent = `${d.getDate()} ${d.getMonth() === month ? '' : '(非本月)'}`; const dot = node.querySelector('.dot'); const dayEntries = Object.values(entries).filter(en => en.date && en.date.startsWith(iso)); if (dayEntries.length > 0) { const worst = Math.max(...dayEntries.map(e => Number(e.severity || 0))); if (worst === 1) dot.style.background = 'var(--small)'; if (worst === 2) dot.style.background = 'var(--medium)'; if (worst === 3) dot.style.background = 'var(--large)'; } else dot.style.background = 'transparent'; node.addEventListener('click', () => openDayView(iso, d)); calendarEl.appendChild(node); } }

// ---------- modal/form ----------
const modal = document.getElementById('modal');
const datetimeInput = document.getElementById('datetime');
const severityEl = document.getElementById('severity');
const symptomOtherChk = document.getElementById('symptomOtherChk');
const symptomOtherTxt = document.getElementById('symptomOtherTxt');
const medOtherChk = document.getElementById('medOtherChk');
const medOtherTxt = document.getElementById('medOtherTxt');
const deleteBtn = document.getElementById('deleteBtn');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
symptomOtherChk.addEventListener('change', () => { symptomOtherTxt.disabled = !symptomOtherChk.checked; if (!symptomOtherChk.checked) symptomOtherTxt.value = ''; });
medOtherChk.addEventListener('change', () => { medOtherTxt.disabled = !medOtherChk.checked; if (!medOtherChk.checked) medOtherTxt.value = ''; });
cancelBtn.addEventListener('click', () => { closeModal(); });
let editingId = null;

function openDayView(isoDate, dateObj) { editingId = null; document.getElementById('modalTitle').textContent = `紀錄：${isoDate}`; const nowStr = isoDate + 'T12:00'; datetimeInput.value = nowStr; severityEl.value = ''; document.querySelectorAll('.symptom').forEach(ch => ch.checked = false); symptomOtherTxt.value = ''; symptomOtherTxt.disabled = true; symptomOtherChk.checked = false; document.querySelectorAll('.med').forEach(ch => ch.checked = false); medOtherTxt.value = ''; medOtherTxt.disabled = true; medOtherChk.checked = false; document.getElementById('duration').value = ''; document.getElementById('medEffective').checked = false; document.getElementById('affectLife').checked = false; document.getElementById('onPeriod').checked = false; document.getElementById('notes').value = ''; const dayEntries = Object.entries(entries).filter(([k, v]) => v.date && v.date.startsWith(isoDate)); if (dayEntries.length > 0) { const [id, data] = dayEntries[0]; editingId = id; datetimeInput.value = data.date; severityEl.value = data.severity || ''; if (Array.isArray(data.symptoms)) { document.querySelectorAll('.symptom').forEach(ch => { ch.checked = data.symptoms.includes(ch.value); }); if (data.symptoms.includes('其他')) { symptomOtherChk.checked = true; symptomOtherTxt.disabled = false; symptomOtherTxt.value = data.symptomOther || ''; } } document.getElementById('duration').value = data.duration || ''; if (Array.isArray(data.medications)) { document.querySelectorAll('.med').forEach(ch => { ch.checked = data.medications.includes(ch.value); }); if (data.medications.includes('其他')) { medOtherChk.checked = true; medOtherTxt.disabled = false; medOtherTxt.value = data.medOther || ''; } } document.getElementById('medEffective').checked = !!data.medEffective; document.getElementById('affectLife').checked = !!data.affectLife; document.getElementById('onPeriod').checked = !!data.onPeriod; document.getElementById('notes').value = data.notes || ''; } deleteBtn.style.display = editingId ? 'inline-block' : 'none'; modal.style.display = 'flex'; window.scrollTo(0, 0); }

deleteBtn.addEventListener('click', () => { if (!editingId) return; if (!confirm('確定刪除此筆紀錄？')) return; delete entries[editingId]; const ok = saveEntries(entries); if (ok) { renderCalendar(); if (driveConnected()) autoUploadToDrive(); closeModal(); } });

saveBtn.addEventListener('click', () => {
    const data = {}; const dt = datetimeInput.value; if (!dt) { alert('請選擇日期時間'); return; } data.date = dt; data.severity = severityEl.value; const symptoms = Array.from(document.querySelectorAll('.symptom')).filter(ch => ch.checked).map(ch => ch.value); data.symptoms = symptoms; if (symptoms.includes('其他')) data.symptomOther = symptomOtherTxt.value.trim(); data.duration = document.getElementById('duration').value; const meds = Array.from(document.querySelectorAll('.med')).filter(ch => ch.checked).map(ch => ch.value); data.medications = meds; if (meds.includes('其他')) data.medOther = medOtherTxt.value.trim(); data.medEffective = document.getElementById('medEffective').checked; data.affectLife = document.getElementById('affectLife').checked; data.onPeriod = document.getElementById('onPeriod').checked; data.notes = document.getElementById('notes').value.trim(); const key = editingId || ('id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)); entries[key] = data; const ok = saveEntries(entries); if (ok) {
        renderCalendar(); // auto-upload to drive if connected
        if (driveConnected()) autoUploadToDrive(); closeModal();
    }
});

function closeModal() { modal.style.display = 'none'; editingId = null; }

renderCalendar();

window._headache_entries = entries; window._saveEntries = saveEntries;

// ---------- Google Drive integration ----------
// This implementation uses Google Identity Services to obtain an access token.
// You must replace GOOGLE_CLIENT_ID with your client id to enable.

let tokenClient = null;
let accessToken = null;

async function initDrive() {
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('YOUR_CLIENT_ID')) return;
    if (!tokenClient) {
        await loadGoogleIdentity();
    }
    // 如果 localStorage 有 token，直接設定 accessToken
    const savedToken = localStorage.getItem('headache_drive_token');
    if (savedToken) {
        accessToken = savedToken;
        updateDriveStatus();
        // 嘗試自動上傳
        if (driveConnected()) {
            autoUploadToDrive();
        }
    }
}
initDrive();

const savedToken = localStorage.getItem('headache_drive_token');
if (savedToken) {
    accessToken = savedToken;
    updateDriveStatus();
}

function driveConnected() {
    const fid = localStorage.getItem(DRIVE_FILE_ID_KEY);
    return !!fid && !!accessToken;
}
function updateDriveStatus() { const el = document.getElementById('driveStatus'); const fid = localStorage.getItem(DRIVE_FILE_ID_KEY); if (accessToken && fid) el.textContent = `Drive 已連結（fileId: ${fid.slice(0, 6)}...）`; else if (accessToken) el.textContent = 'Drive 已登入，但尚未指定檔案'; else el.textContent = 'Drive 未連結'; }

// Initialize token client when user clicks connect
document.getElementById('driveConnectBtn').addEventListener('click', async () => {
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('YOUR_CLIENT_ID')) { alert('請先在程式內填入你的 Google Client ID'); return; }
    try {
        await loadGoogleIdentity();
        tokenClient.requestAccessToken({ scope: DRIVE_SCOPE, prompt: 'consent' });
    } catch (e) { console.error(e); alert('無法載入 Google 身份服務：' + e.message); }
});

document.getElementById('driveImportBtn').addEventListener('click', async () => {
    try {
        await ensureToken();
        // list files created by app or named headache_diary.json (own app files are fine)
        const q = "name = 'headache_diary.json' or name contains 'headache_diary'";
        const res = await driveApiGET(`/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&pageSize=10`);
        const files = res.files || [];
        if (files.length === 0) { if (confirm('找不到現有檔案，是否建立新的 drive 檔案並上傳目前資料？')) { const id = await createDriveFile(); if (id) { localStorage.setItem(DRIVE_FILE_ID_KEY, id); updateDriveStatus(); alert('建立並連結檔案成功'); autoUploadToDrive(); } } return; }
        // pick first file (simple UI) — in future replace with picker
        const file = files[0];
        const content = await driveApiGET(`/drive/v3/files/${file.id}?alt=media`, true);
        // parse json
        const data = typeof content === 'string' ? JSON.parse(content) : content;
        // merge
        let incoming = {};
        if (Array.isArray(data)) {
            data.forEach(item => { const id = item.id || ('id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)); const copy = { ...item }; delete copy.id; incoming[id] = copy; });
        } else if (typeof data === 'object' && data !== null) { incoming = data; }
        Object.entries(incoming).forEach(([k, v]) => { if (entries[k]) { const newId = 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); entries[newId] = v; } else entries[k] = v; });
        saveEntries(entries); renderCalendar(); localStorage.setItem(DRIVE_FILE_ID_KEY, file.id); updateDriveStatus(); alert('已從 Drive 匯入並合併紀錄，後續操作會自動同步至該檔案');
    } catch (e) { console.error('drive import', e); alert('Drive 匯入失敗：' + (e.message || e)); }
});

document.getElementById('driveExportBtn').addEventListener('click', async () => {
    try {
        await ensureToken(); const fid = localStorage.getItem(DRIVE_FILE_ID_KEY); if (!fid) { // create new file
            const id = await createDriveFile(); if (id) { localStorage.setItem(DRIVE_FILE_ID_KEY, id); updateDriveStatus(); alert('已建立 Drive 檔案並上傳資料'); } return;
        } await uploadContentToDrive(fid); alert('已上傳至 Drive');
    } catch (e) { console.error('drive export', e); alert('Drive 上傳失敗：' + (e.message || e)); }
});

async function loadGoogleIdentity() {
    if (window.google && window.google.accounts && tokenClient) return; // already loaded
    return new Promise((resolve, reject) => {
        const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = () => {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID, scope: DRIVE_SCOPE, callback: (resp) => {
                    if (resp.error) { console.error('token error', resp); alert('取得 token 失敗'); return; }
                    accessToken = resp.access_token;
                    localStorage.setItem('headache_drive_token', accessToken);
                    updateDriveStatus();
                    resolve();
                }
            });
        }; s.onerror = () => reject(new Error('gsi client load failed')); document.head.appendChild(s);
    });
}

async function ensureToken() {
    if (!tokenClient) await loadGoogleIdentity(); return new Promise((resolve, reject) => {
        if (accessToken) { resolve(accessToken); } else {
            tokenClient.requestAccessToken({ prompt: 'consent' }); // callback resolves
            // poll until accessToken set
            const t0 = Date.now(); const iv = setInterval(() => { if (accessToken) { clearInterval(iv); resolve(accessToken); } if (Date.now() - t0 > 60000) { clearInterval(iv); reject(new Error('取得 token timeout')); } }, 200);
        }
    });
}

// convenience wrapper for Drive API GET; if altMedia true, return text
async function driveApiGET(path, altMedia = false) { const url = 'https://www.googleapis.com' + path; const r = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } }); if (!r.ok) throw new Error('Drive API error: ' + r.status); if (altMedia) return await r.text(); return await r.json(); }

async function createDriveFile() { // create metadata then upload content
    // create file metadata
    const metaRes = await fetch('https://www.googleapis.com/drive/v3/files', { method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'headache_diary.json', mimeType: 'application/json' }) }); if (!metaRes.ok) throw new Error('create file meta failed: ' + metaRes.status); const meta = await metaRes.json(); const fid = meta.id; await uploadContentToDrive(fid); return fid;
}

async function uploadContentToDrive(fileId) {
    const arr = Object.entries(entries).map(([id, entry]) => ({ id, ...entry })); const content = JSON.stringify(arr, null, 2);
    // upload via PATCH with uploadType=media
    const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const r = await fetch(url, { method: 'PATCH', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' }, body: content }); if (!r.ok) throw new Error('upload failed: ' + r.status); return await r.json();
}

// called automatically after local changes if drive connected
async function autoUploadToDrive() { try { const fid = localStorage.getItem(DRIVE_FILE_ID_KEY); if (!fid) return; await ensureToken(); await uploadContentToDrive(fid); console.log('auto-uploaded to drive'); updateDriveStatus(); } catch (e) { console.error('auto upload error', e); /* don't alert user every time */ } }

// update UI state periodically
setInterval(updateDriveStatus, 1000);