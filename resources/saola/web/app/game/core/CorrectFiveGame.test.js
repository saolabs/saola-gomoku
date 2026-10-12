import CorrectFiveGame from './CorrectFiveGame';

const directions = [[1, 0], [0, 1], [1, 1], [-1, 1]];
function makeGame() {
    const game = new CorrectFiveGame();
    game.soundOn = false;
    jest.spyOn(game, 'createSounds').mockImplementation(() => {});
    game.init({openingRule:'swap2',soundOn:false});
    game.create();
    return game;
}

// Independent bounded ray oracle; friendly stones outside the N-ray are allowed.
export function oracleWin(cells, opponents = []) {
    const mine = new Set(cells);
    for (const cell of mine) {
        const [x, y] = cell.split(':').map(Number);
        for (const [dx, dy] of directions) {
            let length = 0;
            while (length < 5 && mine.has(`${x + length * dx}:${y + length * dy}`)) length++;
            if (length === 5 && !opponents.includes(`${x-dx}:${y-dy}`) && !opponents.includes(`${x+length*dx}:${y+length*dy}`)) return true;
        }
    }
    return false;
}

export function finishOpening(game, choice = 'black') {
    ['8:8', '9:8', '8:9'].forEach(cell => game.placeOpeningStone(cell));
    game.resolveOpeningChoice(choice);
}

test('all 572 fives obey the single blocked-end rule at borders and corners', () => {
    const game = makeGame();
    let checked = 0;
    for (const [dx, dy] of directions) {
        for (let y = 1; y <= 15; y++) for (let x = 1; x <= 15; x++) {
            const end = `${x + 4 * dx}:${y + 4 * dy}`;
            if (!game.isValidCoordinate(end)) continue;
            const cells = Array.from({ length: 5 }, (_, i) => `${x + i * dx}:${y + i * dy}`);
            const ends = [`${x - dx}:${y - dy}`, `${x + 5 * dx}:${y + 5 * dy}`].filter(c => game.isValidCoordinate(c));
            expect(game.getLinesByList(0, cells, 5)).toHaveLength(1);
            expect(game.checkWinner(cells, [])).toBe(true);
            expect(game.checkWinner(cells, ends)).toBe(ends.length === 0);
            for (const end of ends) expect(game.checkWinner(cells, [end])).toBe(false);
            expect(oracleWin(cells)).toBe(true);
            for (const friendlyEnd of ends) expect(game.checkWinner([...cells, friendlyEnd], [])).toBe(true);
            checked++;
        }
    }
    expect(checked).toBe(572);
    expect(game.lines[0]).toHaveLength(572);
});

test.each([6, 7, 8, 9, 10, 15])('a chain of %i stones wins through an unblocked five-stone window', length => {
    const game = makeGame();
    for (const [dx, dy] of directions) {
        const x = dx === -1 ? 15 : 1;
        const cells = Array.from({ length }, (_, i) => `${x + i * dx}:${1 + i * dy}`);
        expect(game.checkWinner(cells, [])).toBe(true);
        expect(oracleWin(cells)).toBe(true);
    }
});

test('an exact five in another direction still wins when the same move also creates an overline', () => {
    const game = makeGame();
    const horizontal = Array.from({ length: 6 }, (_, i) => `${5 + i}:8`);
    const vertical = Array.from({ length: 5 }, (_, i) => `8:${4 + i}`);
    const cells = [...new Set([...horizontal, ...vertical])];
    expect(game.checkWinner(cells, [])).toBe(true);
    expect(oracleWin(cells)).toBe(true);
});

test('rejects gaps and four stones, and ignores an opponent far beyond an endpoint', () => {
    const game = makeGame();
    expect(game.checkWinner(['5:8', '6:8', '8:8', '9:8', '10:8'], [])).toBe(false);
    expect(game.checkWinner(['5:8', '6:8', '7:8', '8:8'], [])).toBe(false);
    expect(game.checkWinner(['5:8', '6:8', '7:8', '8:8', '9:8'], ['3:8'])).toBe(true);
});

test('preserves custom settings and rejects invalid or occupied coordinates', () => {
    const game = makeGame();
    game.init({ size: 5, column: 30, row: 30, winningLineLength: 4, soundOn: false });
    game.create();
    expect(game.getData()).toMatchObject({ column: 30, row: 30, line: 4, size: 5, rulesMode: 'custom' });
    for (const coord of ['0:8', '8:0', '31:8', '1.5:8', '1:8:9', 'oops']) expect(game.choose(coord)).toBe(4);
    expect(game.choose('30:30')).toBe(5);
    expect(game.choose('30:30')).toBe(4);
});

test('reset preserves geometry and starts Swap2; clear preserves autoplay', () => {
    const game = makeGame();
    const map = game.lineMap;
    finishOpening(game);
    game.reset();
    expect(game.lineMap).toBe(map);
    expect(game.emptyCells).toHaveLength(225);
    expect(game.playerCells).toEqual([]);
    expect(game.blackCells).toEqual([]);
    expect(game.getOpeningData().phase).toBe('placeThree');
    game.autoPlay = true;
    game.clear();
    expect(game.autoPlay).toBe(true);
});

test('auto recognizes an unblocked edge five and advances a nonterminal turn exactly once', () => {
    const game = makeGame();
    finishOpening(game);
    game.turn = 'player';
    game.playerCells = ['11:8', '12:8', '13:8', '14:8'];
    game.computerCells = ['10:7'];
    game.selectedCells = [...game.playerCells, ...game.computerCells];
    game.playerAgent.instance = { suggest: () => ['15:8'], endGame: jest.fn() };
    expect(game.auto()).toBe(5);
    expect(game.gameStatus).toBe('win');
    expect(game.cellData['15:8'].group).toContain('win');
    expect(game.auto()).toBe(1);
    game.reset();
    finishOpening(game);
    const actor = game.turn;
    expect(game.auto()).toBe(5);
    expect(game.turn).not.toBe(actor);
});

test('last move draws if no exact five, but exact five takes priority on a full board', () => {
    for (const win of [false, true]) {
        const game = makeGame();
        finishOpening(game);
        game.turn = 'player';
        game.playerCells = win ? ['11:15', '12:15', '13:15', '14:15'] : [];
        game.computerCells = [];
        game.selectedCells = Object.keys(game.cellData).filter(cell => cell !== '15:15');
        game.playerAgent.instance = { suggest: () => ['15:15'], endGame: jest.fn() };
        expect(game.auto()).toBe(5);
        expect(game.gameStatus).toBe(win ? 'win' : 'draw');
    }
});

test('intersection indices are actual line IDs and all common empty cells are returned', () => {
    const game = makeGame();
    const a = game.lines[0].findIndex(line => line.join() === ['4:8', '5:8', '6:8', '7:8', '8:8'].join());
    const b = game.lines[0].findIndex(line => line.join() === ['6:6', '6:7', '6:8', '6:9', '6:10'].join());
    expect(game.findIntersection(0, [a, b, a])).toEqual(['6:8']);
    game.selectedCells = ['6:8'];
    expect(game.findIntersection(0, [a, b])).toEqual([]);
});

test('line lookup retains original two-ended traversal order and excludes occupied opponent lines', () => {
    const game=makeGame();
    const keys=indices => indices.map(i => game.lines[0][i].join(','));
    const expected=[
        '1:1,2:1,3:1,4:1,5:1',
        '1:1,2:2,3:3,4:4,5:5',
        '1:1,1:2,1:3,1:4,1:5',
    ];
    expect(keys(game.getLinesByList(0,['1:1','1:1'],1))).toEqual(expected);
    game.selectedCells=['1:1','2:1'];
    expect(keys(game.getLinesByList(0,['1:1'],1,true))).toEqual(expected.slice(1));
    expect(keys(game.getLinesByList(0,['1:1'],1,false))).toEqual(expected);
});
