import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardPaste, Sparkles } from 'lucide-react';
import { billingKeys, getSubscription } from '@/features/billing/services/billingApi';
import { draftExercisesWithAI, type ExerciseAIContext, type ExerciseAIResult } from '../../services/exerciseAI';

type Props = {
  context: ExerciseAIContext;
  buildStep: boolean;
  applied: boolean;
  disabled: boolean;
  onBegin: () => void;
  onEnd: () => void;
  onGenerated: (result: ExerciseAIResult) => void;
  onReject: () => void;
  onAdjust: () => void;
  onReview: () => void;
};

export function ExerciseAIHelper({ context, buildStep, applied, disabled, onBegin, onEnd, onGenerated, onReject, onAdjust, onReview }: Props) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [screenshot, setScreenshot] = useState<File>();
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController>();
  const clipboardRequest = useRef(0);
  const canAttach = useRef(false);
  canAttach.current = open && buildStep && !busy && !disabled;
  const contentID = useId();
  const subscription = useQuery({ queryKey: billingKeys.subscription, queryFn: getSubscription, enabled: open, retry: false });
  useEffect(() => () => { request.current?.abort(); clipboardRequest.current++; }, []);
  useEffect(() => {
    if (!screenshot) { setPreview(''); return; }
    const url = URL.createObjectURL(screenshot); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshot]);

  function attach(file?: File) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Use a PNG, JPEG or WebP screenshot.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Screenshot must be at most 10 MiB.'); return; }
    setScreenshot(file); setError('');
  }
  async function pasteScreenshot() {
    if (busy || disabled || pasting) return;
    if (typeof navigator.clipboard?.read !== 'function') {
      setError('Clipboard access is unavailable here. Press Ctrl+V or Cmd+V in the description, or choose a screenshot file.');
      return;
    }
    const id = ++clipboardRequest.current;
    setPasting(true); setError('');
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find(t => ['image/png', 'image/jpeg', 'image/webp'].includes(t));
        if (!type) continue;
        const blob = await item.getType(type);
        if (id !== clipboardRequest.current || !canAttach.current) return;
        attach(new File([blob], `clipboard-screenshot.${type === 'image/jpeg' ? 'jpg' : type.split('/')[1]}`, { type }));
        return;
      }
      if (id === clipboardRequest.current && canAttach.current) {
        setError(items.some(item => item.types.some(type => type.startsWith('image/')))
          ? 'Use a PNG, JPEG or WebP screenshot.'
          : 'The clipboard has no image. Copy a screenshot, then try again.');
      }
    } catch {
      if (id === clipboardRequest.current && canAttach.current) setError('Could not access the clipboard. Press Ctrl+V or Cmd+V in the description, or choose a screenshot file.');
    } finally {
      if (id === clipboardRequest.current) setPasting(false);
    }
  }
  function cancel() {
    request.current?.abort(); request.current = undefined;
    setBusy(false); onEnd();
  }
  async function generate() {
    if (busy || disabled || pasting || !content.trim() || !subscription.data?.ai_access) return;
    const controller = new AbortController(); request.current = controller;
    setError(''); setBusy(true); onBegin();
    try {
      const result = await draftExercisesWithAI(content.trim(), context, screenshot, controller.signal);
      if (request.current !== controller || controller.signal.aborted) return;
      onGenerated(result);
    } catch (e) {
      if (request.current === controller && !controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not set exercises. Your draft is unchanged.');
    } finally {
      if (request.current === controller) { request.current = undefined; setBusy(false); onEnd(); }
    }
  }

  return <section className="exercise-ai-helper" aria-label="Set exercises with AI" hidden={!buildStep && !applied}>
    {buildStep && <button type="button" className="secondary-button" aria-expanded={open} disabled={disabled || busy || pasting} onClick={() => setOpen(v => !v)}><Sparkles size={16} aria-hidden="true"/>Set exercises with AI</button>}
    {open && buildStep && <div className="exercise-ai-inputs" onPaste={event => {
      if (busy || disabled || pasting) return;
      const file = Array.from(event.clipboardData.files).find(f => f.type.startsWith('image/'))
        || Array.from(event.clipboardData.items || []).find(item => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile();
      if (file) { event.preventDefault(); attach(file); }
    }}>
      <label htmlFor={contentID}>Describe the exercises<textarea id={contentID} maxLength={8000} value={content} disabled={busy || disabled} onChange={event => setContent(event.target.value)} placeholder="3 rounds: 10 goblet squats at 20 kg, 8 push-ups..."/></label>
      <label>Screenshot (optional)<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || disabled || pasting} onChange={event => { attach(event.target.files?.[0]); event.target.value = ''; }}/></label>
      <div className="builder-row-actions"><button type="button" className="secondary-button" disabled={busy || disabled || pasting} onClick={() => void pasteScreenshot()}><ClipboardPaste size={16} aria-hidden="true"/>{pasting ? 'Pasting screenshot...' : 'Paste screenshot'}</button></div>
      {screenshot && <div className="exercise-ai-image">{preview && <img src={preview} alt="Exercise screenshot preview"/>}<span>{screenshot.name}</span><button type="button" disabled={busy || disabled || pasting} onClick={() => setScreenshot(undefined)}>Remove screenshot</button></div>}
      <p className="muted-copy">Paste a screenshot here or choose a file. PNG, JPEG or WebP, up to 10 MiB.</p>
      {subscription.isPending && <p role="status">Checking AI access...</p>}
      {subscription.error && <p role="alert">{subscription.error.message} <button type="button" onClick={() => void subscription.refetch()}>Retry access check</button></p>}
      {subscription.data && !subscription.data.ai_access && <p>Choose Pro to use AI exercise setup.</p>}
      <div className="builder-row-actions"><button type="button" className="primary-button" disabled={busy || disabled || pasting || !content.trim() || !subscription.data?.ai_access} onClick={() => void generate()}>{busy ? 'Reading exercises...' : 'Set exercises'}</button>{busy && <button type="button" onClick={cancel}>Cancel generation</button>}</div>
    </div>}
    {busy && <p role="status">Reading your exercises...</p>}
    {error && <p role="alert" className="form-message form-message-error">{error}</p>}
    {applied && <div className="exercise-ai-result"><p role="status">AI changes applied. Review your exercises, then save the workout when ready.</p><div className="builder-row-actions"><button type="button" disabled={busy || disabled || pasting} onClick={onAdjust}>Adjust exercises</button><button type="button" disabled={busy || disabled || pasting} onClick={onReject}>Reject AI changes</button><button type="button" disabled={busy || disabled || pasting} onClick={onReview}>Review &amp; save</button></div></div>}
  </section>;
}
