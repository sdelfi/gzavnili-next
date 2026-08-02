import { describe, expect, test } from 'bun:test';
import { groupGeRowsByText } from '../smsQueueDrain';

// `cron/processSMSQueue.cfm`'s GE-row grouping — see docs/decisions/0026-cron-phase6.md.

describe('groupGeRowsByText', () => {
  test('rows with the exact same text are joined into one comma-separated phone list', () => {
    const groups = groupGeRowsByText([
      { id: 1, phone: '995555111111', text: 'hello', phoneType: 'GE' },
      { id: 2, phone: '995555222222', text: 'hello', phoneType: 'GE' },
    ]);
    expect(groups).toEqual([{ text: 'hello', phones: '995555111111,995555222222' }]);
  });

  test('rows with different text stay in separate groups', () => {
    const groups = groupGeRowsByText([
      { id: 1, phone: '995555111111', text: 'hello', phoneType: 'GE' },
      { id: 2, phone: '995555222222', text: 'goodbye', phoneType: 'GE' },
    ]);
    expect(groups).toEqual([
      { text: 'hello', phones: '995555111111' },
      { text: 'goodbye', phones: '995555222222' },
    ]);
  });

  test('empty input yields no groups', () => {
    expect(groupGeRowsByText([])).toEqual([]);
  });

  test('phones are trimmed before joining', () => {
    const groups = groupGeRowsByText([
      { id: 1, phone: ' 995555111111 ', text: 'hi', phoneType: 'GE' },
      { id: 2, phone: ' 995555222222 ', text: 'hi', phoneType: 'GE' },
    ]);
    expect(groups).toEqual([{ text: 'hi', phones: '995555111111,995555222222' }]);
  });
});
