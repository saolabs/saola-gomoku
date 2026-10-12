import { GameSession } from '../resources/saola/web/app/GameSession';

let sessions;
beforeEach(() => { vi.useFakeTimers(); sessions = []; });
afterEach(() => { sessions.forEach(s => s.destroy()); vi.useRealTimers(); vi.restoreAllMocks(); });
function session() {
  const s = new GameSession(vi.fn(), { delay: 350 });
  sessions.push(s); return s;
}
function configure(s, options = {}) {
  s.configure({ size: '2', level: '1', winningLineLength: '5', openingRule: 'standard', gameMode: 'twoPlayer', playerAgentModel: 'BOT_Origin', computerAgentModel: 'BOT_Origin', player1Name: 'An', player2Name: 'Bình', ...options });
}

test('view instances have independent boards and four upstream models', () => {
  const a = session(), b = session();
  configure(a); a.select('8:8');
  expect(a.snapshot().moves).toBe(1);
  expect(b.snapshot().moves).toBe(0);
  expect(a.snapshot().models).toHaveLength(4);
  expect(a.snapshot().cells).toHaveLength(225);
});

test('human input cannot place a second stone during the computer turn', () => {
  const s = session(); s.select('8:8'); s.select('9:8');
  expect(s.game.selectedCells).toEqual(['8:8']);
  expect(s.game.turn).toBe('computer');
  expect(s.snapshot().cells.every(cell => cell.disabled)).toBe(true);
});

test('reset cancels a queued computer move', () => {
  const s = session(); const ai = vi.spyOn(s.game, 'auto');
  s.select('8:8'); s.reset(); vi.advanceTimersByTime(1000);
  expect(ai).not.toHaveBeenCalled(); expect(s.snapshot().moves).toBe(0);
});

test('opening and cancelling settings pauses and resumes exactly one computer action', () => {
  const s = session(); s.select('8:8');
  const ai = vi.spyOn(s.game, 'auto').mockImplementation(() => {
    s.game.playerSelect = () => 5;
    s.game.turn = 'player'; return 5;
  });
  s.pause(); vi.advanceTimersByTime(2000); expect(ai).not.toHaveBeenCalled();
  s.resume(); s.resume(); vi.advanceTimersByTime(350); expect(ai).toHaveBeenCalledTimes(1);
});

test('switching mode cancels pending AI and starts a new board', () => {
  const s = session(); s.select('8:8'); const ai = vi.spyOn(s.game, 'auto');
  configure(s); vi.advanceTimersByTime(1000);
  expect(ai).not.toHaveBeenCalled(); expect(s.game.turn).toBe('player1');
  expect(s.snapshot().first).toBe('An'); expect(s.snapshot().second).toBe('Bình');
});

test('two players finish the game using the original blocked-end referee', () => {
  const s = session(); configure(s);
  for (const c of ['5:8','1:1','6:8','2:1','7:8','3:1','8:8','4:1','9:8']) expect(s.select(c)).toBe(5);
  expect(s.snapshot().ended).toBe(true); expect(s.snapshot().headline).toBe('An chiến thắng!');
  expect(s.snapshot().cells.filter(cell => cell.group.includes('win'))).toHaveLength(5);
  expect(s.snapshot().cells.every(cell => cell.disabled)).toBe(true);
});

test('Swap2 extend branch preserves colors and continues with the owner of O', () => {
  const s = session(); configure(s, { openingRule: 'swap2' });
  for (const c of ['8:8','9:8','8:9']) expect(s.select(c)).toBe(5);
  expect(s.snapshot().canChoose).toBe(true); expect(s.snapshot().canExtend).toBe(true);
  expect(s.openingChoice('extend')).toBe(5);
  s.select('9:9'); s.select('7:8');
  expect(s.snapshot().canChoose).toBe(true); expect(s.snapshot().canExtend).toBe(false);
  expect(s.openingChoice('white')).toBe(5);
  expect(s.game.turn).toBe('player1'); expect(s.snapshot().firstMark).toBe('O');
  s.select('7:9'); expect(s.game.cellData['7:9'].label.toLowerCase()).toBe('o');
});

test('invalid board options normalize through the upstream engine', () => {
  const s = session(); configure(s, { size: '0', winningLineLength: '6', openingRule: 'swap2' });
  expect(s.snapshot().column).toBe(5); expect(s.snapshot().line).toBe(5);
  expect(s.game.openingRule).toBe('standard');
});

test('resignation cancels timers and increments the correct actor score', () => {
  const s = session(); configure(s); s.select('8:8'); s.resign();
  expect(s.game.winner).toBe('player1'); expect(s.snapshot().headline).toBe('An chiến thắng!');
  expect(s.snapshot().firstScore).toBe(1);
});

test('draw rejection continues the game and acceptance ends it', () => {
  const s = session(); configure(s); s.select('8:8'); s.offerDraw();
  expect(s.snapshot().hasDrawOffer).toBe(true); s.respondDraw(false);
  expect(s.snapshot().ended).toBe(false); s.offerDraw(); s.respondDraw(true);
  expect(s.snapshot().headline).toBe('Ván cờ hòa');
});

test('autoplay errors stop automation rather than retrying endlessly', () => {
  const s = session(); const ai = vi.spyOn(s.game, 'auto').mockReturnValue(0);
  s.toggleAuto(); vi.advanceTimersByTime(1500);
  expect(ai).toHaveBeenCalledTimes(1); expect(s.game.autoPlay).toBe(false);
  expect(s.snapshot().message).toContain('AI');
});

test('destroy cancels scheduled moves and stale hint callbacks', () => {
  const s = session(); vi.spyOn(s.game, 'suggest').mockReturnValue(['8:8']);
  s.hint(); s.select('8:8'); const ai = vi.spyOn(s.game, 'auto');
  s.destroy(); const calls = s.onChange; vi.advanceTimersByTime(5000);
  expect(ai).not.toHaveBeenCalled(); expect(s.hints).toEqual([]); expect(s.onChange).toBe(calls);
});
