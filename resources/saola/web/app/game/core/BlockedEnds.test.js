import CorrectFiveGame from './CorrectFiveGame';
import BOT_Origin from '../models/BOT_Origin';
import C5_Demo from '../models/C5-demo';
import C5_2025 from '../models/C5-2025';

function game() {
    const g = new CorrectFiveGame();
    g.soundOn = false;
    jest.spyOn(g, 'createSounds').mockImplementation(() => {});
    g.create();
    g.openingPhase = 'complete';
    g.turn = 'computer';
    return g;
}
afterEach(() => jest.restoreAllMocks());

test('the reported 5:4 to 9:8 window wins despite the friendly 10:9 and opponent 11:10', () => {
    const g = game();
    const red = ['5:4','6:5','7:6','8:7','9:8','10:9'];
    const blue = ['8:3','9:3','10:3','9:4','8:5','9:5','10:5','10:6',
        '10:7','11:7','11:8','11:9','11:10','11:11'];
    expect(g.checkWinner(red,blue,'win')).toBe(true);
    const highlighted = Object.entries(g.cellData).filter(([,c]) => c.group.includes('win')).map(([c]) => c);
    expect(highlighted).toEqual(['5:4','6:5','7:6','8:7','9:8']);
    expect(highlighted).not.toContain('10:9');
});

test.each([BOT_Origin,C5_Demo,C5_2025].flatMap(Model => [1,2,3].map(level => [Model.NAME,level,Model])))('%s level %i wins or blocks the gap of the reported longer diagonal', (name,level,Model) => {
    const g = game();
    g.level = level;
    const red = ['5:4','6:5','8:7','9:8','10:9'];
    const blue = ['11:10'];
    g.computerCells = red;
    g.playerCells = blue;
    g.selectedCells = [...red,...blue];
    expect(new Model(g).suggest(red)).toEqual(['7:6']);
    expect(g.checkWinner([...red,'7:6'],blue)).toBe(true);
    g.computerCells = blue;
    g.playerCells = red;
    const replies = new Model(g).suggest(blue);
    expect(replies.length).toBeGreaterThan(0);
    for (const reply of replies) expect(g.getWinningMoves(red,[...blue,reply])).toEqual([]);
});

test.each([4,5,6])('an N=%i window accepts friendly endpoints and rejects opponent endpoints', target => {
    const g = game();
    g.init({size:2,winningLineLength:target,soundOn:false});
    g.create();
    for (const [dx,dy] of [[1,0],[0,1],[1,1],[-1,1]]) {
        const cells = Array.from({length:target},(_,i) => `${8+i*dx}:${4+i*dy}`);
        const [before,after] = g.getLineEndpoints(cells);
        expect(g.checkWinner(cells,[before])).toBe(false);
        expect(g.checkWinner(cells,[after])).toBe(false);
        // A longer chain can shift its N-window past a blocked outer end.
        expect(g.checkWinner([...cells,after],[before])).toBe(true);
        expect(g.checkWinner([...cells,before],[after])).toBe(true);
        expect(g.checkWinner([...cells,after],[before,`${8+(target+1)*dx}:${4+(target+1)*dy}`])).toBe(false);
        expect(g.checkWinner([...cells,before,after],[`${8+(target+1)*dx}:${4+(target+1)*dy}`])).toBe(true);
    }
});

test.each([BOT_Origin, C5_Demo, C5_2025].flatMap(Model =>
    [1, 2, 3].map(level => [Model.NAME, level, Model])))('%s level %i cancels two different winning gaps by blocking their shared endpoint', (name, level, Model) => {
    const g = game();
    g.level = level;
    const opponents = ['5:8', '6:8', '8:8', '9:8', '4:9', '4:10', '4:12', '4:13'];
    g.computerCells = [];
    g.playerCells = opponents;
    g.selectedCells = [...opponents];
    const before = JSON.stringify(g.getBoardState());
    expect(g.getWinningMoves(opponents, []).sort()).toEqual(['4:11', '7:8']);
    expect(g.hasUnstoppableThreat(opponents, [])).toBe(false);
    expect(new Model(g).suggest([])).toEqual(['4:8']);
    expect(g.getWinningMoves(opponents, ['4:8'])).toEqual([]);
    expect(JSON.stringify(g.getBoardState())).toBe(before);
});

test('a genuine fork has no single gap or endpoint defense', () => {
    const g = game();
    const cells = ['4:8', '5:8', '7:8', '8:8', '6:6', '6:7', '6:9', '6:10'];
    // The first pair shares a gap; the second pair has independent gaps and endpoints.
    const independent = ['5:8', '6:8', '8:8', '9:8', '11:5', '11:6', '11:8', '11:9'];
    expect(g.hasUnstoppableThreat(cells, [])).toBe(false);
    expect(g.hasUnstoppableThreat(independent, [])).toBe(true);
    for (const reply of g.getDefensiveMoves([], independent)) {
        expect(g.getWinningMoves(independent, [reply]).length).toBeGreaterThan(0);
    }
});

test.each([[1, 0], [0, 1], [1, 1], [-1, 1]])('blocking either endpoint cancels only its own direction (%i,%i)', (dx, dy) => {
    const g = game();
    const x = 8, y = 5;
    const cells = Array.from({ length: 5 }, (_, i) => `${x+i*dx}:${y+i*dy}`);
    const before = `${x-dx}:${y-dy}`, after = `${x+5*dx}:${y+5*dy}`;
    expect(g.checkWinner(cells, [])).toBe(true);
    for (const blocker of [before, after]) {
        expect(g.checkWinner(cells, [blocker], true)).toBe(false);
        expect(g.getWinningMoves(cells.slice(0, 4), [blocker])).not.toContain(cells[4]);
        expect(Object.values(g.cellData).some(cell => cell.group.includes('win'))).toBe(false);
    }
});

test('autoplay continues after completing a chain blocked at one end', () => {
    const g = game();
    g.colors = { computer: 'black', player: 'white' };
    g.gameStatus = 'playing';
    g.computerCells = ['11:8', '12:8', '13:8', '14:8'];
    g.playerCells = ['10:8'];
    g.selectedCells = [...g.computerCells, ...g.playerCells];
    g.computerAgent.instance = { suggest: () => ['15:8'], endGame: jest.fn() };
    expect(g.auto()).toBe(5);
    expect(g.gameStatus).toBe('playing');
    expect(g.turn).toBe('player');
    expect(g.cellData['15:8'].group).not.toContain('win');
});
