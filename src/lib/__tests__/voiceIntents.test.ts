import { describe, it, expect } from 'vitest';
import { matchVoiceIntent } from '../voiceIntents';

describe('matchVoiceIntent', () => {
  // --- clock_in ---
  it('"clock in" matches clock_in', () => {
    const result = matchVoiceIntent('clock in');
    expect(result).not.toBeNull();
    expect(result!.commandId).toBe('clock_in');
  });

  it('"clock in to Johnson bathroom" matches clock_in with projectName', () => {
    const result = matchVoiceIntent('clock in to Johnson bathroom');
    expect(result).not.toBeNull();
    expect(result!.commandId).toBe('clock_in');
    expect(result!.params.projectName).toBe('Johnson bathroom');
  });

  it('"clockin on the Smith project" matches clock_in', () => {
    const result = matchVoiceIntent('clockin on the Smith project');
    expect(result).not.toBeNull();
    expect(result!.commandId).toBe('clock_in');
    expect(result!.params.projectName).toBe('the Smith project');
  });

  // --- clock_out ---
  it('"clock out" matches clock_in (same page)', () => {
    const result = matchVoiceIntent('clock out');
    expect(result).not.toBeNull();
    expect(result!.commandId).toBe('clock_in');
  });

  // --- create_project ---
  it('"create project" matches create_project', () => {
    const result = matchVoiceIntent('create project');
    expect(result).not.toBeNull();
    expect(result!.commandId).toBe('create_project');
  });

  it('"new project Smith kitchen" matches create_project', () => {
    const result = matchVoiceIntent('new project Smith kitchen');
    expect(result).not.toBeNull();
    expect(result!.commandId).toBe('create_project');
    expect(result!.params.projectName).toBe('Smith kitchen');
  });

  it('"start project" matches create_project', () => {
    const result = matchVoiceIntent('start project');
    expect(result).not.toBeNull();
    expect(result!.commandId).toBe('create_project');
  });

  // --- add_task ---
  it('"add task call the inspector" matches add_task', () => {
    const result = matchVoiceIntent('add task call the inspector');
    expect(result).not.toBeNull();
    expect(result!.commandId).toBe('add_task');
    expect(result!.params.taskName).toBe('call the inspector');
  });

  it('"add task" alone does not match (requires task name)', () => {
    // The regex requires at least one char after "add task "
    const result = matchVoiceIntent('add task');
    expect(result).toBeNull();
  });

  // --- send_update ---
  it('"send update" matches send_update', () => {
    const result = matchVoiceIntent('send update');
    expect(result).not.toBeNull();
    expect(result!.commandId).toBe('send_update');
  });

  it('"send message to John" matches send_update with recipient', () => {
    const result = matchVoiceIntent('send message to John');
    expect(result).not.toBeNull();
    expect(result!.commandId).toBe('send_update');
    expect(result!.params.recipient).toBe('John');
  });

  // --- whats_at_risk ---
  it('"what\'s at risk" matches whats_at_risk', () => {
    const result = matchVoiceIntent("what's at risk");
    expect(result).not.toBeNull();
    expect(result!.commandId).toBe('whats_at_risk');
  });

  it('"whats at risk today" matches whats_at_risk', () => {
    const result = matchVoiceIntent('whats at risk today');
    expect(result).not.toBeNull();
    expect(result!.commandId).toBe('whats_at_risk');
  });

  // --- add_to_shopping ---
  it('"add 2x4 lumber to shopping list" matches add_to_shopping', () => {
    const result = matchVoiceIntent('add 2x4 lumber to shopping list');
    expect(result).not.toBeNull();
    expect(result!.commandId).toBe('add_to_shopping');
    expect(result!.params.itemName).toBe('2x4 lumber');
  });

  it('"add nails to the list" matches add_to_shopping', () => {
    const result = matchVoiceIntent('add nails to the list');
    expect(result).not.toBeNull();
    expect(result!.commandId).toBe('add_to_shopping');
    expect(result!.params.itemName).toBe('nails');
  });

  // --- review_pending ---
  it('"review pending" matches review_pending', () => {
    const result = matchVoiceIntent('review pending');
    expect(result).not.toBeNull();
    expect(result!.commandId).toBe('review_pending');
  });

  it('"show pending" matches review_pending', () => {
    const result = matchVoiceIntent('show pending');
    expect(result).not.toBeNull();
    expect(result!.commandId).toBe('review_pending');
  });

  // --- check_inventory ---
  it('"check inventory" matches check_inventory', () => {
    const result = matchVoiceIntent('check inventory');
    expect(result).not.toBeNull();
    expect(result!.commandId).toBe('check_inventory');
  });

  it('"check stock" matches check_inventory', () => {
    const result = matchVoiceIntent('check stock');
    expect(result).not.toBeNull();
    expect(result!.commandId).toBe('check_inventory');
  });

  // --- No match (falls through to AI) ---
  it('"what\'s the weather" returns null (no match)', () => {
    const result = matchVoiceIntent("what's the weather");
    expect(result).toBeNull();
  });

  it('"help me with this" returns null', () => {
    expect(matchVoiceIntent('help me with this')).toBeNull();
  });

  it('empty string returns null', () => {
    expect(matchVoiceIntent('')).toBeNull();
  });

  it('whitespace-only returns null', () => {
    expect(matchVoiceIntent('   ')).toBeNull();
  });
});
