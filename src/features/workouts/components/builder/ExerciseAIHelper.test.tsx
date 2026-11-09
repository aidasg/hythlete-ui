import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { ExerciseAIHelper } from './ExerciseAIHelper';
import type { ExerciseAIResult } from '../../services/exerciseAI';

const mocks = vi.hoisted(() => ({ generate: vi.fn(), subscription: vi.fn() }));
vi.mock('../../services/exerciseAI', () => ({ draftExercisesWithAI: mocks.generate }));
vi.mock('@/features/billing/services/billingApi', () => ({ billingKeys: { subscription: ['billing', 'subscription'] }, getSubscription: mocks.subscription }));
const result: ExerciseAIResult = { blocks: [{ id: 'ai-0', format: 'straight_sets', movements: [{ exercise_code: 'back_squat', sets: [{ reps: 8 }] }] }], issues: [] };
const context = { activity: 'strength_training', mode: 'performed' as const, current_blocks: [] };
function mount() {
  const generated = vi.fn(), begin = vi.fn(), end = vi.fn();
  const rendered = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ExerciseAIHelper context={context} buildStep applied={false} disabled={false} onBegin={begin} onEnd={end} onGenerated={generated} onReject={vi.fn()} onAdjust={vi.fn()} onReview={vi.fn()}/></QueryClientProvider>);
  return { ...rendered, generated, begin, end };
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.subscription.mockResolvedValue({ ai_access: true }); mocks.generate.mockResolvedValue(result);
  vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:preview'); static revokeObjectURL = vi.fn(); });
});

it('uploads and pastes a screenshot, preserving text and attachments after failure', async () => {
  const user = userEvent.setup(); const { generated } = mount();
  await user.click(screen.getByRole('button', { name: 'Set exercises with AI' }));
  const description = screen.getByLabelText('Describe the exercises');
  await user.type(description, '8 squats at 40 kg');
  const file = new File(['png'], 'screen.png', { type: 'image/png' });
  await user.upload(screen.getByLabelText('Screenshot (optional)'), file);
  expect(await screen.findByAltText('Exercise screenshot preview')).toHaveAttribute('src', 'blob:preview');
  mocks.generate.mockRejectedValueOnce(new Error('Provider unavailable'));
  await user.click(screen.getByRole('button', { name: 'Set exercises' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Provider unavailable');
  expect(description).toHaveValue('8 squats at 40 kg');
  expect(screen.getByText('screen.png')).toBeInTheDocument();
  expect(generated).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Remove screenshot' }));
  expect(screen.queryByAltText('Exercise screenshot preview')).not.toBeInTheDocument();
  fireEvent.paste(description, { clipboardData: { files: [file] } });
  await user.click(screen.getByRole('button', { name: 'Set exercises' }));
  await waitFor(() => expect(generated).toHaveBeenCalledWith(result));
  expect(mocks.generate).toHaveBeenLastCalledWith('8 squats at 40 kg', context, file, expect.any(AbortSignal));
});

it('validates file type, size, and Pro access before requesting generation', async () => {
  mocks.subscription.mockResolvedValue({ ai_access: false });
  const user = userEvent.setup(); mount();
  await user.click(screen.getByRole('button', { name: 'Set exercises with AI' }));
  await user.type(screen.getByLabelText('Describe the exercises'), '8 squats');
  expect(await screen.findByText('Choose Pro to use AI exercise setup.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Set exercises' })).toBeDisabled();
  const input = screen.getByLabelText('Screenshot (optional)');
  fireEvent.change(input, { target: { files: [new File(['svg'], 'test.svg', { type: 'image/svg+xml' })] } });
  expect(screen.getByRole('alert')).toHaveTextContent('Use a PNG, JPEG or WebP');
  const tooLarge = new File(['png'], 'large.png', { type: 'image/png' }); Object.defineProperty(tooLarge, 'size', { value: 10 * 1024 * 1024 + 1 });
  fireEvent.change(input, { target: { files: [tooLarge] } });
  expect(screen.getByRole('alert')).toHaveTextContent('at most 10 MiB');
  expect(mocks.generate).not.toHaveBeenCalled();
});

it('aborts on cancellation and ignores a late response', async () => {
  let complete!: (value: ExerciseAIResult) => void;
  mocks.generate.mockReturnValue(new Promise(resolve => { complete = resolve; }));
  const user = userEvent.setup(); const { generated, begin, end } = mount();
  await user.click(screen.getByRole('button', { name: 'Set exercises with AI' }));
  await user.type(screen.getByLabelText('Describe the exercises'), '8 squats');
  await user.click(screen.getByRole('button', { name: 'Set exercises' }));
  expect(begin).toHaveBeenCalledOnce();
  const signal = mocks.generate.mock.calls[0]![3] as AbortSignal;
  await user.click(screen.getByRole('button', { name: 'Cancel generation' }));
  expect(signal.aborted).toBe(true); expect(end).toHaveBeenCalledOnce();
  await act(async () => complete(result));
  expect(generated).not.toHaveBeenCalled();
});

it('aborts when the editor is dismissed', async () => {
  mocks.generate.mockReturnValue(new Promise(() => {}));
  const user = userEvent.setup(); const { unmount } = mount();
  await user.click(screen.getByRole('button', { name: 'Set exercises with AI' }));
  await user.type(screen.getByLabelText('Describe the exercises'), '8 squats');
  await user.click(screen.getByRole('button', { name: 'Set exercises' }));
  const signal = mocks.generate.mock.calls[0]![3] as AbortSignal;
  unmount(); expect(signal.aborted).toBe(true);
});

it('reads an image from the clipboard button and sends it with the exercise text', async () => {
  const user = userEvent.setup(); const { generated } = mount();
  const read = vi.fn().mockResolvedValue([{ types: ['text/plain', 'image/png'], getType: async () => new Blob(['clipboard image'], { type: 'image/png' }) }]);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { read } });
  await user.click(screen.getByRole('button', { name: 'Set exercises with AI' }));
  await user.type(screen.getByLabelText('Describe the exercises'), 'Use these sets');
  await user.click(screen.getByRole('button', { name: 'Paste screenshot' }));
  expect(await screen.findByText('clipboard-screenshot.png')).toBeInTheDocument();
  expect(screen.getByAltText('Exercise screenshot preview')).toHaveAttribute('src', 'blob:preview');
  expect(read).toHaveBeenCalledOnce();
  await user.click(screen.getByRole('button', { name: 'Set exercises' }));
  await waitFor(() => expect(generated).toHaveBeenCalled());
  expect(mocks.generate.mock.calls[0]![2]).toMatchObject({ name: 'clipboard-screenshot.png', type: 'image/png', size: 15 });
});

it.each(['empty', 'denied', 'unavailable'])('keeps the existing screenshot when clipboard access is %s', async mode => {
  const user = userEvent.setup(); mount();
  const read = mode === 'denied' ? vi.fn().mockRejectedValue(new Error('NotAllowedError')) : vi.fn().mockResolvedValue([{ types: ['text/plain'] }]);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: mode === 'unavailable' ? undefined : { read } });
  await user.click(screen.getByRole('button', { name: 'Set exercises with AI' }));
  await user.upload(screen.getByLabelText('Screenshot (optional)'), new File(['png'], 'existing.png', { type: 'image/png' }));
  await user.click(screen.getByRole('button', { name: 'Paste screenshot' }));
  const error = await screen.findByRole('alert');
  expect(error).toHaveTextContent(mode === 'empty' ? 'clipboard has no image' : 'Ctrl+V or Cmd+V');
  expect(screen.getByText('existing.png')).toBeInTheDocument();
  expect(mocks.generate).not.toHaveBeenCalled();
});

it('accepts keyboard-pasted images exposed as clipboard items', async () => {
  const user = userEvent.setup(); mount();
  await user.click(screen.getByRole('button', { name: 'Set exercises with AI' }));
  const file = new File(['png'], 'pasted.png', { type: 'image/png' });
  fireEvent.paste(screen.getByLabelText('Describe the exercises'), { clipboardData: { files: [], items: [{ kind: 'file', type: file.type, getAsFile: () => file }] } });
  expect(await screen.findByText('pasted.png')).toBeInTheDocument();
});

it('ignores clipboard results arriving after the editor is dismissed', async () => {
  const user = userEvent.setup(); const { unmount } = mount();
  let complete!: (items: unknown[]) => void;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { read: () => new Promise(resolve => { complete = resolve; }) } });
  await user.click(screen.getByRole('button', { name: 'Set exercises with AI' }));
  await user.click(screen.getByRole('button', { name: 'Paste screenshot' }));
  expect(screen.getByRole('button', { name: 'Pasting screenshot...' })).toBeDisabled();
  unmount();
  await act(async () => complete([{ types: ['image/png'], getType: async () => new Blob(['png']) }]));
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
