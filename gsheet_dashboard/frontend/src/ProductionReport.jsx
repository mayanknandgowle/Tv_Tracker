import React,{useEffect,useMemo,useRef,useState} from 'react';
import {api} from './workspaceUtils';
import {Dialog} from './DesktopExperience';
import {Search,CheckCircle2,Undo2,Pencil,Check,X,AlertTriangle,Upload,FileSpreadsheet} from 'lucide-react';
import {DataTable} from './WorkspaceViews';
import ReportOrderSearch from './ReportOrderSearch';
import './productionReport.css';
const statusChoices=['Assign to ABS','Attorney Approval','Awaiting for Clarification','Cancelled','Completed and Delivered','Home Builders','Need To Add Subscription','Need to assign ABS','QC in Progress','Responded','Search In Progress','SearchFix','Site Down','Typing in Progress','Waiting for Effective Date'];

function SuccessNotice({title,children}) {
  return <div className="production-success" role="status"><span className="production-success-icon" aria-hidden="true">✅</span><div className="production-success-content"><strong>{title}</strong>{children}</div></div>;
}

// Keep uploaded tokens and report work in the owning workspace for navigation.
function useSessionState(session,key,initial) {
  const [value,setValue]=useState(()=>Object.hasOwn(session.current,key)?session.current[key]:initial);
  function update(next) {
    const previous=Object.hasOwn(session.current,key)?session.current[key]:initial;
    const value=typeof next==='function'?next(previous):next;
    session.current[key]=value;
    setValue(value);
  }
  return [value,update];
}

export default function ProductionReport({revision,session}) {
  const localSession=useRef({});
  const reportSession=session||localSession;
  const [folder,setFolder]=useSessionState(reportSession,'folder',''),[previews,setPreviews]=useState([]),[preview,setPreview]=useSessionState(reportSession,'preview','');
  const [detail,setDetail]=useState(null),[detailSearch,setDetailSearch]=useState('');
  const [restore,setRestore]=useSessionState(reportSession,'restore',null),[confirmRevert,setConfirmRevert]=useState(false),[message,setMessage]=useSessionState(reportSession,'message','');
  const [statusOverrides,setStatusOverrides]=useSessionState(reportSession,'statusOverrides',{}),[customOrder,setCustomOrder]=useState(null),[customStatus,setCustomStatus]=useState('');
  const [editingStatus,setEditingStatus]=useState(null),[statusDraft,setStatusDraft]=useState('');
  const [completionUpload,setCompletionUpload]=useSessionState(reportSession,'completionUpload',null);
  const [completionDragging,setCompletionDragging]=useState(false);
  const [exportOptions,setExportOptions]=useSessionState(reportSession,'exportOptions',{new_orders:true,status_changes:true,completion_times:true,completed_tv:true});
  const anyExport=Object.values(exportOptions).some(Boolean);
  function verifyOptions(data){
    if(data.export_options_version!==1||!data.export_options||Object.keys(exportOptions).some(key=>data.export_options[key]!==exportOptions[key]))
      throw Error('The running app server has not confirmed these export options. Restart the app to load the export update, then Check again. No export was started.');
  }
  async function uploadCompletion(selected){
    const files=Array.from(selected||[]);
    if(!files.length||busy)return;
    if(files.length>30||files.some(file=>!file.name.toLowerCase().endsWith('.xlsx'))){setError('Choose between 1 and 30 ExcelReport .xlsx files.');return;}
    setBusy(true);setError('');
    try{
      const form=new FormData();files.forEach(file=>form.append('files',file));
      const data=await api('/api/production-report/completion-upload',{method:'POST',body:form,timeoutMs:180000});
      setCompletionUpload(data);invalidate();
    }catch(error){setError(error.message);}finally{setBusy(false);}
  }
  const [routes,setRoutes]=useSessionState(reportSession,'routes',{}),[result,setResult]=useSessionState(reportSession,'result',null),[busy,setBusy]=useState(false),[error,setError]=useSessionState(reportSession,'error','');
  useEffect(()=>{let alive=true;api('/api/production-report').then(data=>{if(alive){setFolder(value=>value||data.folder);setPreviews(data.previews);setRestore(data.revert||null);setPreview(value=>value||String(data.selected_preview_id||data.previews[0]?.id||''));}}).catch(error=>{if(alive)setError(error.message);});return()=>{alive=false;};},[revision]);
  async function run(action){
    setBusy(true);setError('');setMessage('');setDetail(null);setDetailSearch('');
    try{
      const request={folder,preview_id:Number(preview),routes,status_overrides:statusOverrides,fingerprint:result?.fingerprint,token:restore?.token,export_options:exportOptions,completion_token:completionUpload?.token};
      if(action==='proceed'){
        const checked=await api('/api/production-report/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),timeoutMs:180000});
        verifyOptions(checked);
        if(result.candidate_fingerprint!==checked.candidate_fingerprint){setResult(checked);throw Error('The preview or workbooks changed. Review the refreshed report before proceeding.');}
        if(checked.unresolved.length){setResult(checked);throw Error('Choose destinations for the enabled new orders, then Check again.');}
        request.fingerprint=checked.fingerprint;
      }
      const data=await api(`/api/production-report/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),timeoutMs:180000});
      if(action!=='revert')verifyOptions(data);
      setRestore(data.revert||null);
      if(action==='revert'){setResult(null);setStatusOverrides({});setConfirmRevert(false);setMessage(data.message);}
      else setResult(data);
    }
    catch(error){setError(error.message);}
    finally{setBusy(false);}
  }
  const invalidate=()=>{setResult(null);setDetail(null);setRestore(null);setStatusOverrides({});setMessage('');};
  async function changeStatus(row,status){
    const overrides={...statusOverrides,[row['Order Number']]:status};
    setBusy(true);setError('');
    try{
      const data=await api('/api/production-report/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({folder,preview_id:Number(preview),routes,status_overrides:overrides,export_options:exportOptions,completion_token:completionUpload?.token}),timeoutMs:180000});
      verifyOptions(data);setStatusOverrides(overrides);setResult(data);setCustomOrder(null);setEditingStatus(null);
      const file=(data.candidate_reports||data.reports).find(file=>file.kind===detail.kind);
      setDetail(detail.statusChanges?{...file,orders:file.changed_orders||[],statusChanges:true}:file);
    }catch(error){setError(error.message);}finally{setBusy(false);}
  }
  function statusCell(row,column){
    if(column!=='Status')return undefined;
    const options=[...new Set([...statusChoices,...Object.values(statusOverrides),row.Status])].filter(Boolean).sort();
    if(editingStatus!==row['Order Number']||result.completed)return <div className="production-status-display"><span className="production-status-pill">{row.Status}</span>{!result.completed&&<button type="button" className="icon-button" aria-label={`Edit planned status for ${row['Order Number']}`} title="Edit status" disabled={busy} onClick={()=>{setEditingStatus(row['Order Number']);setStatusDraft(row.Status||'');setError('');}}><Pencil size={15}/></button>}</div>;
    return <div className="production-status-editor"><select autoFocus className="production-status-select" aria-label={`Planned status for ${row['Order Number']}`} title={statusDraft} value={statusDraft} disabled={busy} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();event.preventDefault();setEditingStatus(null);}}} onChange={event=>{if(event.target.value==='__custom__'){setCustomOrder(row);setCustomStatus('');}else setStatusDraft(event.target.value);}}>{options.map(status=><option key={status} value={status}>{status}</option>)}<option value="__custom__">＋ Add New Status…</option></select><button type="button" className="icon-button production-status-confirm" aria-label={`Confirm planned status for ${row['Order Number']}`} title="Confirm status" disabled={busy||!statusDraft} onClick={()=>changeStatus(row,statusDraft)}><Check size={18}/></button><button type="button" className="icon-button production-status-cancel" aria-label={`Cancel status edit for ${row['Order Number']}`} title="Cancel edit" disabled={busy} onClick={()=>{setEditingStatus(null);setError('');}}><X size={18}/></button></div>;
  }
  const openOrders=file=>{setDetail(file);setDetailSearch('');setEditingStatus(null);};
  const detailTitle=detail?.kind==='full'?'Full Search':'C-O and Update';
  const detailCategory=detail?.completedTV?'completed_tv':detail?.completionTimes?'completion_times':detail?.statusChanges?'status_changes':'new_orders';
  const appliedCounts=result?.completed?result.reports.reduce((total,file)=>({new_orders:total.new_orders+(file.missing||0),status_changes:total.status_changes+(file.status_changed||0),completion_times:total.completion_times+(file.completion_count||0),completed_tv:total.completed_tv+(file.completed_tv_count||0)}),{new_orders:0,status_changes:0,completion_times:0,completed_tv:0}):null;
  const detailRows=(detail?.orders||[]).filter(row=>!detailSearch.trim()||result.columns.some(column=>String(row[column]??'').toLowerCase().includes(detailSearch.trim().toLowerCase())));
  const searchableRows=useMemo(()=>(result?.rows||[]).map(({Destination,...row})=>row),[result]);
  return <section className="production-report">
    <div className="production-report-header"><div className="section-heading"><div><h2>Production Report</h2><p className="muted">Add missing preview orders to your two production workbooks.</p></div></div>
    <div className="production-report-search"><ReportOrderSearch name="Production Report" rows={searchableRows} columns={result?.columns||[]} disabled={!result||busy}/>{!result&&<p className="muted">Click Check folder &amp; orders below to load the selected preview for order-number search.</p>}</div>
    </div>
    <div className="production-report-controls">
      <label>Production report folder<input aria-label="Production report folder" placeholder={'C:\\Users\\Harikrishna\\Desktop\\PR'} value={folder} disabled={busy} onChange={event=>{setFolder(event.target.value);invalidate();}}/></label>
      <p className="muted">Paste the folder containing one C-O and Update workbook and one Full Search workbook. Local folders and accessible network paths are supported.</p>
      <label>Source preview<select aria-label="Production report preview" value={preview} disabled={busy} onChange={event=>{setPreview(event.target.value);invalidate();}}><option value="" disabled>Choose a saved preview</option>{previews.map(item=><option key={item.id} value={item.id}>{item.name} · {item.row_count} captured rows</option>)}</select></label>
      <div className={`production-completion-upload${completionDragging?' is-dragging':''}`} onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect=busy?'none':'copy';if(!busy)setCompletionDragging(true);}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget))setCompletionDragging(false);}} onDrop={event=>{event.preventDefault();setCompletionDragging(false);uploadCompletion(event.dataTransfer.files);}} aria-busy={busy}><FileSpreadsheet size={30} aria-hidden="true"/><h3>Completed ExcelReports</h3><p className="muted">Drag and drop multiple ExcelReports here, or choose files below to fill missing Out Times.</p><label className="production-upload-button"><Upload size={18} aria-hidden="true"/><span>{completionUpload?'Replace ExcelReports':'Upload multiple files'}</span><input type="file" multiple accept=".xlsx" aria-label="Upload completed ExcelReport" disabled={busy} onChange={event=>{uploadCompletion(event.target.files);event.target.value='';}}/></label>
      <p className="muted">Up to 30 .xlsx files · 20 MB per file · 100 MB total. A new upload replaces the selected batch.</p>

      {completionUpload&&<div className="production-upload-summary" role="status"><p>{completionUpload.files||1} files selected · {completionUpload.orders} orders with completion times · {completionUpload.conflicts} conflicting orders excluded</p><ul>{(completionUpload.names||[completionUpload.name]).map((name,index)=><li key={`${index}-${name}`}>{name}</li>)}</ul><button type="button" className="secondary" disabled={busy} onClick={()=>{setCompletionUpload(null);invalidate();}}>Remove completion reports</button></div>}
      </div>

      <div className="production-main-actions"><button className="secondary action-check" disabled={busy||!folder.trim()||!preview||!anyExport} onClick={()=>run('check')}><Search size={18}/>{busy?'Working…':'Check folder & orders'}</button><button className="primary action-proceed" disabled={busy||!result||result.completed||(exportOptions.new_orders&&!!result.unresolved.length)||!anyExport} onClick={()=>run('proceed')}><CheckCircle2 size={19}/>Proceed — update selected orders</button><button type="button" className="secondary action-revert" disabled={busy||!restore} onClick={()=>{setError("");setConfirmRevert(true);}} title="Restore the workbooks from before the latest Proceed"><Undo2 size={19}/>Revert Excel</button></div>
      <fieldset className="production-export-options" disabled={busy}><legend>Choose what to update in Excel</legend><div className="production-export-switches">{[['new_orders','Newly orders'],['status_changes','Status changed'],['completion_times','Completion times'],['completed_tv','Completed in TV']].map(([key,label])=><button key={key} type="button" role="switch" aria-label={label} aria-checked={exportOptions[key]} onClick={()=>{setExportOptions({...exportOptions,[key]:!exportOptions[key]});setDetail(null);setEditingStatus(null);setMessage('');setError('');}}><span>{label}</span><span className="production-switch-track" aria-hidden="true"><span className="production-switch-thumb"/><span>{exportOptions[key]?'ON':'OFF'}</span></span></button>)}</div>{!anyExport&&<p role="status">Turn on at least one option to continue.</p>}</fieldset>
    </div>
    {error&&<div role="alert" className="production-revert-warning production-proceed-warning"><span className="production-revert-warning-icon" aria-hidden="true"><AlertTriangle size={26}/></span><div><strong>Action needed to continue</strong><p>{error}</p></div></div>}
    {customOrder&&<Dialog title="Add production status" className="production-add-status-dialog" onClose={()=>{if(!busy)setCustomOrder(null);}}><form className="dialog-content" onSubmit={event=>{event.preventDefault();changeStatus(customOrder,customStatus.trim());}}><p className="production-add-status-context">Add a status for <strong>{customOrder['Order Number']}</strong>.</p><label htmlFor="production-new-status">New status<input id="production-new-status" autoFocus required autoComplete="off" aria-label="New planned status" placeholder="e.g. Waiting for review" maxLength={256} value={customStatus} disabled={busy} onChange={event=>setCustomStatus(event.target.value)}/></label><p className="production-add-status-hint">This selects the status for your planned update. Click Proceed later to apply it to Excel.</p>{error&&<p className="notice warning" role="alert">{error}</p>}<div className="production-add-status-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>setCustomOrder(null)}>Cancel</button><button type="submit" className="primary" disabled={busy||!customStatus.trim()}>{busy?'Saving…':'Use status'}</button></div></form></Dialog>}
    {message&&<SuccessNotice title="Excel reverted successfully"><p>{message}</p></SuccessNotice>}
    {result?.completed&&<SuccessNotice title="Excel updated successfully"><p>{appliedCounts.new_orders} orders added · {appliedCounts.status_changes} statuses changed · {appliedCounts.completion_times} completion times updated · {appliedCounts.completed_tv} orders marked Completed in TV. The enabled export categories were applied to Excel. Disabled categories were left unchanged. Your previous Excel files are backed up and can be restored with Revert Excel.</p><div className="inline">{result.downloads.map(file=><a className="secondary" key={file.url} href={file.url} download>Download {file.name}</a>)}</div></SuccessNotice>}
    {confirmRevert&&<Dialog title="Revert Excel" className="production-revert-dialog" onClose={()=>{if(!busy)setConfirmRevert(false);}}><div className="dialog-content"><p>Restore both production workbooks to their state before the latest Proceed? This removes orders added by that action and restores their previous statuses and data.</p><p>Close the Excel files first. If they were edited after Proceed, the restore will stop to protect those edits.</p>{error&&<div role="alert" className="production-revert-warning"><span className="production-revert-warning-icon" aria-hidden="true"><AlertTriangle size={26}/></span><div><strong>Action needed before restoring</strong><p>{error}</p></div></div>}<div className="inline"><button type="button" className="secondary" disabled={busy} onClick={()=>setConfirmRevert(false)}>Cancel</button><button type="button" className="primary" disabled={busy} onClick={()=>run('revert')}>{busy?'Reverting…':'Restore previous Excel'}</button></div></div></Dialog>}
    {result&&<>
      <div className="production-report-files">{(result.candidate_reports||result.reports).map(file=><article key={file.kind}><h3><button type="button" className="production-file-title" disabled={busy} onClick={()=>openOrders(file)} aria-haspopup="dialog">{file.kind==='full'?'Full Search':'C-O and Update'}</button></h3><p>{file.name}</p><div className="production-order-actions"><button type="button" className={`production-order-count${exportOptions.new_orders?'':' is-excluded'}`} disabled={busy} onClick={()=>openOrders(file)} aria-haspopup="dialog" aria-label={`${file.kind==='full'?'Full Search':'C-O and Update'}: ${file.missing} ${result.completed&&result.export_options?.new_orders?'orders added':'Newly orders'}`}><strong>{file.missing}</strong><span className="production-metric-label">{result.completed&&result.export_options?.new_orders?'orders added':'Newly orders'}</span><span className="production-category-state">{exportOptions.new_orders?'Included':'OFF — skipped'}</span><span>View orders ↗</span></button><button type="button" className={`production-order-count${exportOptions.status_changes?'':' is-excluded'}`} disabled={busy} aria-haspopup="dialog" onClick={()=>openOrders({...file,orders:file.changed_orders||[],statusChanges:true})}><strong>{file.status_changed||0}</strong><span className="production-metric-label">Status Changed</span><span className="production-category-state">{exportOptions.status_changes?'Included':'OFF — skipped'}</span><span>View orders</span></button><button type="button" className={`production-order-count${exportOptions.completion_times?'':' is-excluded'}`} disabled={busy} onClick={()=>openOrders({...file,orders:file.completion_orders||[],completionTimes:true})}><strong>{file.completion_count||0}</strong><span className="production-metric-label">Completion times {result.completed&&result.export_options?.completion_times?'updated':'to update'}</span><span className="production-category-state">{exportOptions.completion_times?'Included':'OFF — skipped'}</span><span>View orders</span></button><button type="button" className={`production-order-count${exportOptions.completed_tv?'':' is-excluded'}`} disabled={busy} aria-haspopup="dialog" aria-label={`${file.kind==='full'?'Full Search':'C-O and Update'}: Completed in TV, ${file.completed_tv_count||0} orders`} onClick={()=>openOrders({...file,orders:file.completed_tv_orders||[],completedTV:true})}><strong>{file.completed_tv_count||0}</strong><span className="production-metric-label">Completed in TV</span><span className="production-category-state">{exportOptions.completed_tv?'Included':'OFF — skipped'}</span><span>View orders</span></button></div><p>{file.completion_kept||0} existing Out Times preserved · {file.completion_unmatched||0} completed rows without a matching time</p><p>{file.existing} existing · {file.skipped} preview orders already present</p></article>)}</div>
      {exportOptions.new_orders&&!!result.unresolved.length&&<div className="production-report-controls"><h3>Choose destinations for unfamiliar products</h3><p>These products are not assigned uniquely by the existing files. Select their report, then check again.</p>{result.unresolved.map(product=><label key={product}>{product}<select aria-label={`Destination for ${product}`} value={routes[product]||''} onChange={event=>setRoutes({...routes,[product]:event.target.value})}><option value="">Choose report</option><option value="co">C-O and Update</option><option value="full">Full Search</option></select></label>)}<button className="secondary" disabled={busy} onClick={()=>run('check')}>Recheck destinations</button></div>}
      <p className="report-context">{result.preview_name} · Orders below use the Google Sheet column order. Destination workbooks retain their own headers and worksheet formatting.</p>
      <DataTable rows={result.rows} columns={result.columns} name="Preview orders in Google Sheet columns" filters={{}} openFilter={()=>{}} filterable={false}/>
    </>}
    {detail&&result&&<Dialog title={detailTitle+' — '+(detail.completedTV?'Matched Orders Not Marked as Completed in Production Reports':detail.completionTimes?'completion times':detail.statusChanges?'status changes':result.completed&&result.export_options?.new_orders?'orders added':'Newly orders')} onClose={()=>setDetail(null)} className="production-orders-dialog" initialFocus=".production-orders-search input"><div className="dialog-content">{!exportOptions[detailCategory]&&<p className="notice warning">OFF — skipped. These are candidate orders for review; this category will not be written to Excel.</p>}<p className="production-status-help">{detail.completedTV?'Matched Orders Not Marked as Completed in Production Reports. These orders have a completion time in your uploaded ExcelReports. Proceed marks them Completed and Delivered and fills missing Out Times, moving weekend dates to Friday.':'Click the pencil to edit a status, ✓ to confirm, or ✕ to cancel. Confirmed choices apply to Excel when you click Proceed. Saved preview statuses are unchanged.'}</p>{error&&<p className="notice warning" role="alert">{error}</p>}<p className="muted">{detail.name} · {result.preview_name} · {detail.orders?.length||0} candidate orders · {exportOptions[detailCategory]?'Included':'OFF — skipped'}</p><label className="search-input production-orders-search"><Search size={16}/><input aria-label="Search report orders" placeholder="Search order number, product, status or any column…" value={detailSearch} onChange={event=>setDetailSearch(event.target.value)}/></label><DataTable key={detail.kind} rows={detailRows} columns={detail.completedTV?['Order Number','PreviousStatus','Status','Previous Out Time','Out Time']:detail.completionTimes?['Order Number','Previous Out Time','Out Time']:detail.statusChanges?['Order Number','Product','PreviousStatus','Status','State','County','Client']:result.columns} renderCell={detail.completionTimes||detail.completedTV?undefined:statusCell} name={detailTitle+' orders'} filters={{}} openFilter={()=>{}} filterable={false}/></div></Dialog>}
  </section>;
}
