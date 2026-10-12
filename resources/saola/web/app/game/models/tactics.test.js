import CorrectFiveGame from '../core/CorrectFiveGame';
import { analyzePosition } from '../core/GomokuStrategy';
import BOT_Origin from './BOT_Origin';
import C5_Demo from './C5-demo';
import C5_2025 from './C5-2025';

const models = [BOT_Origin, C5_Demo, C5_2025];
const directions = [[1, 0], [0, 1], [1, 1], [-1, 1]];
function setup(mine, opponents) {
    const game = new CorrectFiveGame();
    game.soundOn = false;
    jest.spyOn(game, 'createSounds').mockImplementation(() => {});
    game.create();
    game.openingPhase = 'complete';
    game.colors = { computer: 'black', player: 'white' };
    game.turn = 'computer';
    game.computerCells = [...mine];
    game.playerCells = [...opponents];
    game.selectedCells = [...mine, ...opponents];
    game.emptyCells = Object.keys(game.cellData).filter(cell => !game.selectedCells.includes(cell));
    return game;
}
function oracleWin(cells, opponents = []) {
    const stones = new Set(cells);
    for (const cell of stones) {
        const [x, y] = cell.split(':').map(Number);
        for (const [dx, dy] of directions) {
            let count = 0;
            while (count < 5 && stones.has(`${x + count * dx}:${y + count * dy}`)) count++;
            if (count === 5 && !opponents.includes(`${x-dx}:${y-dy}`) && !opponents.includes(`${x+count*dx}:${y+count*dy}`)) return true;
        }
    }
    return false;
}
function winsNext(game, cells, opponents) {
    return Object.keys(game.cellData).filter(cell =>
        !cells.includes(cell) && !opponents.includes(cell) && oracleWin([...cells, cell], opponents)
    );
}

beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

describe.each(models.map(Model => [Model.NAME, Model]))('%s blocked-end Caro', (name, Model) => {
    test('a blocked gap is not a winning threat or a high scoring opportunity', () => {
        const mine = ['4:8', '10:8'];
        const opponents = ['5:8', '6:8', '8:8', '9:8'];
        const g = setup(mine, opponents);
        expect(g.getWinningMoves(opponents, mine)).toEqual([]);
        expect(g.checkWinner([...opponents, '7:8'], mine)).toBe(false);
        expect(analyzePosition(g, opponents, mine).opportunities.has('7:8')).toBe(false);
        const moves = new Model(g).suggest(mine);
        expect(moves.length).toBeGreaterThan(0);
        for (const move of moves) expect(g.checkCellAvailable(move)).toBe(true);
    });

    test('finds every gap across nine directions/borders, all levels and both player sides', () => {
        const seeds = [[5,8,1,0], [1,1,1,0], [11,15,1,0], [15,11,0,1],
            [8,4,0,1], [11,1,1,1], [1,11,1,1], [5,1,-1,1], [8,7,-1,1]];
        const g = setup([], []);
        const model = new Model(g);
        for (const [x,y,dx,dy] of seeds) {
            const line = Array.from({ length: 5 }, (_, i) => `${x + i*dx}:${y + i*dy}`);
            const mine = [];
            for (let gap = 0; gap < 5; gap++) {
                const opponents = line.filter((c,i) => i !== gap);
                for (const turn of ['player', 'computer']) for (const level of [1,2,3]) {
                    g.turn = turn;
                    g.level = level;
                    g.playerCells = turn === 'player' ? mine : opponents;
                    g.computerCells = turn === 'computer' ? mine : opponents;
                    g.selectedCells = [...mine, ...opponents];
                    const moves = model.suggest(mine);
                    expect(moves.length).toBeGreaterThan(0);
                    for (const move of moves) expect(winsNext(g, opponents, [...mine, move])).toEqual([]);
                }
            }
        }
    });

    test('occupies the common winning square of two crossing broken fours', () => {
        const mine = ['2:5', '10:6'];
        const opponents = ['4:8', '5:8', '7:8', '8:8', '6:6', '6:7', '6:9', '6:10'];
        const g = setup(mine, opponents);
        expect(new Model(g).suggest(mine)).toEqual(['6:8']);
    });

    test('wins immediately before defending, with an unblocked five', () => {
        const mine = ['5:5', '6:5', '8:5', '9:5'];
        const opponents = ['4:4', '10:4', '3:10', '4:10', '6:10', '7:10'];
        const g = setup(mine, opponents);
        expect(new Model(g).suggest(mine)).toEqual(['7:5']);
    });

    test('blocks both winning continuations of an open four in one reply', () => {
        const mine = ['2:5'];
        const opponents = ['5:8', '6:8', '7:8', '8:8'];
        const g = setup(mine, opponents);
        expect(g.getWinningMoves(opponents, mine).sort()).toEqual(['4:8', '9:8']);
        const moves = new Model(g).suggest(mine);
        expect(moves.sort()).toEqual(['4:8', '9:8']);
        for (const move of moves) expect(winsNext(g, opponents, [...mine, move])).toHaveLength(0);
    });

    test('creates a fork at the intersection and preserves the real position', () => {
        const mine = ['5:8', '6:8', '7:8', '8:5', '8:6', '8:7'];
        const opponents = [];
        const g = setup(mine, opponents);
        const before = JSON.stringify(g.getBoardState());
        const moves = new Model(g).suggest(mine);
        expect(moves).toContain('8:8');
        for (const move of moves) {
            expect(g.isValidCoordinate(move)).toBe(true);
            expect(g.selectedCells).not.toContain(move);
            expect(winsNext(g, [...mine, move], opponents).length).toBeGreaterThanOrEqual(2);
        }
        expect(JSON.stringify(g.getBoardState())).toBe(before);
    });

    test('wins by filling a gap to form six stones before defending an opponent four', () => {
        const mine = ['3:8', '4:8', '6:8', '7:8', '8:8'];
        const opponents = ['3:10', '4:10', '6:10', '7:10'];
        const g = setup(mine, opponents);
        expect(g.getWinningMoves(mine, opponents)).toEqual(['5:8']);
        const moves = new Model(g).suggest(mine);
        expect(moves).toEqual(['5:8']);
        expect(oracleWin([...mine,'5:8'], opponents)).toBe(true);
    });
});

test('winning-move analysis agrees with an independent bounded-ray oracle on generated positions', () => {
    const g = setup([], []);
    let seed = 12345;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const board = Object.keys(g.cellData);
    for (let sample = 0; sample < 30; sample++) {
        const mine = [], other = [];
        for (const cell of board) {
            const n = rand();
            if (n < .16) mine.push(cell);
            else if (n < .32) other.push(cell);
        }
        if (oracleWin(mine, other) || oracleWin(other, mine)) continue;
        expect(g.checkWinner(mine, other)).toBe(oracleWin(mine, other));
        expect(g.getWinningMoves(mine, other).sort()).toEqual(winsNext(g, mine, other).sort());
        expect(g.getWinningMoves(other, mine).sort()).toEqual(winsNext(g, other, mine).sort());
    }
});

test('simulated strategy uses P/Q occupancy and does not mutate the live game', () => {
    const g = setup([], []);
    const moves = g.getStrategicMoves(['8:8'], ['8:9'], 2);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves).not.toContain('8:8');
    expect(moves).not.toContain('8:9');
    expect(g.selectedCells).toEqual([]);
    expect(g.emptyCells).toHaveLength(225);
});

test('longer-chain windows contribute a winning square consistent with the referee', () => {
    const g = setup([], []);
    const cells = ['3:8', '4:8', '6:8', '7:8', '8:8'];
    const analysis = analyzePosition(g, cells, []);
    expect(analysis.winningMoves).toEqual(['5:8']);
    expect(g.checkWinner([...cells, '5:8'], [])).toBe(true);
});

test.each([2, 3])('level %i anticipates an opponent fork instead of allowing two winning squares', level => {
    const mine = [];
    const opponents = ['5:8', '6:8', '7:8', '8:5', '8:6', '8:7'];
    const g = setup(mine, opponents);
    const before = JSON.stringify(g.getBoardState());
    const started = performance.now();
    const moves = g.getStrategicMoves(mine, opponents, level);
    const elapsed = performance.now() - started;
    console.info(`Gomoku level ${level}: ${Math.round(elapsed)}ms`);
    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) {
        const next = [...mine, move];
        for (const reply of Object.keys(g.cellData).filter(c => ![...next, ...opponents].includes(c))) {
            const other = [...opponents, reply];
            // A fork is irrelevant if we can finish our own five before it executes.
            if (g.getWinningMoves(next, other).length) continue;
            expect(g.hasUnstoppableThreat(other, next)).toBe(false);
        }
    }
    expect(JSON.stringify(g.getBoardState())).toBe(before);
});

test.each([1, 2, 3])('level %i offers multiple legal choices in a quiet symmetric position', level => {
    const mine = ['8:8'], opponents = ['8:9'];
    const g = setup(mine, opponents);
    const moves = g.getStrategicMoves(mine, opponents, level);
    expect(moves.length).toBeGreaterThan(1);
    expect(new Set(moves).size).toBe(moves.length);
    for (const move of moves) {
        expect(g.checkCellAvailable(move)).toBe(true);
        expect(winsNext(g, opponents, [...mine, move])).toEqual([]);
    }
});

test('autoplay can choose different evaluated alternatives from the same quiet board', () => {
    const mine = ['8:8'], opponents = ['8:9'];
    const random = jest.spyOn(Math, 'random');
    const results = [];
    for (const value of [0, .999999]) {
        const g = setup(mine, opponents);
        g.level = 2;
        random.mockReturnValue(value);
        expect(g.auto()).toBe(5);
        results.push(g.selectedCells[2]);
    }
    expect(results[0]).not.toBe(results[1]);
});

test('models apply their own strategic preferences to quiet positions', () => {
    const g = setup(['8:8', '10:8'], ['8:10', '10:10']);
    g.level = 2;
    const recommendations = new Set();
    for (const Model of models) {
        const moves = new Model(g).suggest(g.computerCells);
        recommendations.add([...moves].sort().join(','));
        for (const move of moves) {
            expect(g.checkCellAvailable(move)).toBe(true);
            expect(winsNext(g, g.playerCells, [...g.computerCells, move])).toEqual([]);
        }
    }
    expect(recommendations.size).toBeGreaterThan(1);
});
