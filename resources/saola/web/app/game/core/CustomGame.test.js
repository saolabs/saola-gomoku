import CorrectFiveGame from './CorrectFiveGame';
import { analyzePosition } from './GomokuStrategy';
import { refreshGameImplementation } from './Caro';
import BOT_Origin from '../models/BOT_Origin';
import C5_Demo from '../models/C5-demo';
import C5_2025 from '../models/C5-2025';

const sizes = [5, 10, 15, 20, 25, 30];
const directions = [[1,0], [0,1], [1,1], [-1,1]];
const profiles = sizes.flatMap((size, index) => [4,5,6].filter(n => n <= size).map(n => [size,n,index]));
function setup(size, target, mode = 'ai') {
    const g = new CorrectFiveGame();
    g.soundOn = false;
    jest.spyOn(g, 'createSounds').mockImplementation(() => {});
    g.setGameMode(mode);
    g.init({ size: sizes.indexOf(size), winningLineLength: target, soundOn: false });
    g.create();
    return g;
}
function oracle(cells, target, opponents = []) {
    const stones = new Set(cells);
    for (const cell of stones) {
        const [x,y] = cell.split(':').map(Number);
        for (const [dx,dy] of directions) {
            let n = 0;
            while (n < target && stones.has(`${x+n*dx}:${y+n*dy}`)) n++;
            if (n === target && !opponents.includes(`${x-dx}:${y-dy}`) && !opponents.includes(`${x+n*dx}:${y+n*dy}`)) return true;
        }
    }
    return false;
}
afterEach(() => jest.restoreAllMocks());

test.each(profiles)('board %i, target %i: real bots preserve ownership and alternate exactly one stone per turn', (size, target) => {
    let seed = size * 100 + target;
    jest.spyOn(Math, 'random').mockImplementation(() => {
        seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    });
    for (const Model of [BOT_Origin, C5_Demo, C5_2025]) {
        for (const level of [1,2,3]) {
            for (const mode of ['ai','twoPlayer']) {
                const g = setup(size,target,mode);
                g.level = level;
                g.setPlayerAgentModel(Model.NAME);
                g.setComputerAgentModel(Model.NAME);
                const first = mode === 'ai' ? 'player' : 'player1';
                const second = mode === 'ai' ? 'computer' : 'player2';
                for (let ply=0;ply<6;ply++) {
                    const actor = ply%2 ? second : first;
                    expect(g.turn).toBe(actor);
                    const previous = [...g.selectedCells];
                    expect(g.auto()).toBe(5);
                    expect(g.selectedCells).toHaveLength(ply+1);
                    expect(g.selectedCells.slice(0,-1)).toEqual(previous);
                    const cell = g.selectedCells[ply];
                    expect(g.isValidCoordinate(cell)).toBe(true);
                    expect(g.cellData[cell].label).toBe(ply%2 ? 'o' : 'x');
                    const mine = mode === 'ai'
                        ? (ply%2 ? g.computerCells : g.playerCells)
                        : (ply%2 ? g.player2Cells : g.player1Cells);
                    expect(mine).toContain(cell);
                    expect(new Set(g.selectedCells).size).toBe(ply+1);
                    expect(g.blackCells).toHaveLength(Math.ceil((ply+1)/2));
                    expect(g.whiteCells).toHaveLength(Math.floor((ply+1)/2));
                    expect(g.turn).toBe(ply%2 ? first : second);
                    expect(g.currentPlayer).toBe(g.turn);
                }
                g.reset();
                expect(g.selectedCells).toEqual([]);
                expect(g.getCurrentColor()).toBe('black');
                expect(g.turn).toBe(first);
                expect(g.cellData[g.getEmptyCells()[0]].label).toBe('');
            }
        }
    }
}, 60000);

test.each(profiles)('board %i, target %i: geometry and referee agree with an independent oracle', (size, target, index) => {
    const g = setup(size, target);
    expect(g.column).toBe(size);
    expect(g.size).toBe(index);
    expect(g.totalCell).toBe(size * size);
    const spans = size - target + 1;
    expect(g.lines[0]).toHaveLength(2 * size * spans + 2 * spans * spans);
    for (const line of g.lines[0]) {
        expect(line).toHaveLength(target);
        const endpoints = g.getLineEndpoints(line).filter(c => g.isValidCoordinate(c));
        expect(g.checkWinner(line, [])).toBe(true);
        expect(g.checkWinner(line, endpoints)).toBe(endpoints.length === 0);
        for (const end of endpoints) expect(g.checkWinner(line, [end])).toBe(false);
        expect(oracle(line, target)).toBe(true);
        for (const end of endpoints) {
            expect(g.checkWinner([...line, end])).toBe(true);
            expect(oracle([...line, end], target)).toBe(true);
        }
    }
});

test.each([BOT_Origin, C5_Demo, C5_2025].map(Model => [Model.NAME, Model]))('%s wins and blocks all gaps with dynamic targets at large-board edges', (name, Model) => {
    for (const [size, target] of [[5,4], [10,4], [20,6], [30,5], [30,6]]) {
        const g = setup(size, target);
        g.openingPhase = 'complete';
        g.turn = 'computer';
        for (const [dx,dy] of directions) {
            const x = dx === -1 ? size : size - target + 1;
            const y = size - target + 1;
            const line = Array.from({length:target}, (_,i) => `${x+i*dx}:${y+i*dy}`);
            const endpoints = g.getLineEndpoints(line).filter(c => g.isValidCoordinate(c));
            for (let gap = 0; gap < target; gap++) {
                const stones = line.filter((_,i) => i !== gap);
                for (const attack of [false,true]) {
                    g.computerCells = attack ? stones : [];
                    g.playerCells = attack ? [] : stones;
                    g.selectedCells = [...g.computerCells,...g.playerCells];
                    const moves = new Model(g).suggest(g.computerCells);
                    expect(moves.length).toBeGreaterThan(0);
                    if (attack) expect(moves).toContain(line[gap]);
                    for (const move of moves) {
                        if (attack) expect(g.checkWinner([...stones, move], [])).toBe(true);
                        else expect(g.getWinningMoves(stones, [move])).toEqual([]);
                    }
                    expect(oracle([...stones,line[gap]],target)).toBe(true);
                }
            }
        }
    }
});

test('analysis uses full 30x30 occupancy, accepts longer-chain gaps and survives a changed configuration', () => {
    const g = setup(30,6);
    const stones = ['25:30','26:30','28:30','29:30','30:30'];
    expect(analyzePosition(g,stones,[]).winningMoves).toEqual(['27:30']);
    expect(analyzePosition(g,['24:30',...stones],[]).winningMoves).toEqual(['27:30']);
    g.init({size:1,winningLineLength:4,soundOn:false});
    g.create();
    expect(g.getWinningMoves(['7:10','8:10','10:10'],['6:9'])).toEqual(['9:10']);
});

test.each([2,3])('level %i simulates legal six-stone play on a 30x30 board without modifying the real position', level => {
    const g = setup(30,6);
    g.playerSelect('16:16');
    g.choose('17:16');
    const before = JSON.stringify(g.getBoardState());
    const moves = g.getStrategicMoves(g.blackCells,g.whiteCells,level);
    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) expect(g.checkCellAvailable(move)).toBe(true);
    expect(JSON.stringify(g.getBoardState())).toBe(before);
});

test.each(['ai','twoPlayer'])('custom %s starts with X, alternates colors, awards a four and resets without Swap2', mode => {
    const g = setup(10,4,mode);
    expect(g.openingPhase).toBe('complete');
    const first = g.getFirstActor();
    expect(g.getCurrentColor()).toBe('black');
    for (const cell of ['7:10','6:9','8:10','1:1','9:10','3:1','10:10']) {
        if (g.turn === 'computer') {
            jest.spyOn(g,'suggest').mockReturnValue([cell]);
            expect(g.auto()).toBe(5);
        } else expect(g.playerSelect(cell)).toBe(5);
    }
    expect(g.winner).toBe(first);
    expect(g.gameStatus).toBe('win');
    expect(Object.values(g.cellData).filter(c => c.group.includes('win'))).toHaveLength(4);
    g.reset();
    expect(g.openingPhase).toBe('complete');
    expect(g.turn).toBe(first);
    expect(g.getCurrentColor()).toBe('black');
    expect(g.getCurrentPlayerCells()).toBe(g.blackCells);
    expect(g.getCompetitorCells()).toBe(g.whiteCells);
});

test('invalid options normalize safely and valid custom settings survive init and HMR', () => {
    const g = setup(5,6);
    expect(g.winningLineLength).toBe(5);
    g.init({size:99,winningLineLength:99,soundOn:false});
    g.create();
    expect(g.getData()).toMatchObject({size:2,column:15,line:5,rulesMode:'custom'});
    g.init({size:5,winningLineLength:6,soundOn:false});
    g.create();
    g.playerSelect('30:30');
    g.autoPlay = true;
    const data = g.cellData;
    refreshGameImplementation(g);
    expect(g.cellData).toBe(data);
    expect(g.selectedCells).toEqual(['30:30']);
    expect(g.autoPlay).toBe(true);
    expect(g.getData()).toMatchObject({column:30,line:6,rulesMode:'custom'});
});
