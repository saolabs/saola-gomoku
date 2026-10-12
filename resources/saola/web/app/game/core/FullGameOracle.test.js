import CorrectFiveGame from './CorrectFiveGame';
import BOT_Origin from '../models/BOT_Origin';
import C5_Demo from '../models/C5-demo';
import C5_2025 from '../models/C5-2025';

const sizes = [5,10,15,20,25,30];
const profiles = sizes.flatMap(size => [4,5,6].filter(n => n <= size).map(n => [size,n]));
const models = [BOT_Origin,C5_Demo,C5_2025];
const directions = [[1,0],[0,1],[1,1],[-1,1]];
const results = [];

function randomSource(seed) {
    return () => {
        seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
}
function setup(size,n) {
    const g = new CorrectFiveGame();
    jest.spyOn(g,'createSounds').mockImplementation(() => {});
    g.init({size:sizes.indexOf(size),winningLineLength:n,soundOn:false});
    g.create();
    return g;
}

// Independent numeric board: no production lines, endpoints, occupancy or referee.
// Walk each maximal friendly run, then inspect its possible N-cell windows.
function board(size,p,q) {
    const grid = Array.from({length:size+2},() => new Uint8Array(size+2));
    for (const [value,cells] of [[1,p],[2,q]]) for (const c of cells) {
        const [x,y] = c.split(':').map(Number);
        grid[y][x] = value;
    }
    return grid;
}
function winningWindows(grid,size,n) {
    const at = (x,y) => grid[y]?.[x] || 0;
    const windows = [];
    for (let y=1;y<=size;y++) for (let x=1;x<=size;x++) {
        if (at(x,y) !== 1) continue;
        for (const [dx,dy] of directions) {
            if (at(x-dx,y-dy) === 1) continue;
            const run = [];
            for (let i=0;at(x+i*dx,y+i*dy) === 1;i++) run.push(`${x+i*dx}:${y+i*dy}`);
            for (let start=0;start+n<=run.length;start++) {
                if (at(x+(start-1)*dx,y+(start-1)*dy) !== 2 &&
                    at(x+(start+n)*dx,y+(start+n)*dy) !== 2) windows.push(run.slice(start,start+n));
            }
        }
    }
    return windows;
}
// Only a line through the newly placed stone can become a new win.
function finishingWindows(grid,size,n,x,y) {
    const at = (a,b) => a>=1 && b>=1 && a<=size && b<=size ? grid[b][a] : 0;
    const wins = [];
    for (const [dx,dy] of directions) {
        let left=0,right=0;
        while (at(x-(left+1)*dx,y-(left+1)*dy) === 1) left++;
        while (at(x+(right+1)*dx,y+(right+1)*dy) === 1) right++;
        for (let start=Math.max(-left,1-n);start<=Math.min(0,right-n+1);start++) {
            if (at(x+(start-1)*dx,y+(start-1)*dy) === 2 || at(x+(start+n)*dx,y+(start+n)*dy) === 2) continue;
            wins.push({cells:Array.from({length:n},(_,i) => `${x+(start+i)*dx}:${y+(start+i)*dy}`),
                ends:[[x+(start-1)*dx,y+(start-1)*dy],[x+(start+n)*dx,y+(start+n)*dy]]});
        }
    }
    return wins;
}
function finishers(size,n,p,q) {
    const grid = board(size,p,q), moves = [], defenses = new Set();
    for (let y=1;y<=size;y++) for (let x=1;x<=size;x++) {
        if (grid[y][x]) continue;
        grid[y][x] = 1;
        const windows = finishingWindows(grid,size,n,x,y);
        grid[y][x] = 0;
        if (!windows.length) continue;
        const gap = `${x}:${y}`;
        moves.push(gap);
        defenses.add(gap);
        for (const win of windows) for (const [a,b] of win.ends) {
            if (a>=1 && b>=1 && a<=size && b<=size && grid[b][a] === 0) defenses.add(`${a}:${b}`);
        }
    }
    return {moves,defenses:[...defenses]};
}
beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());
afterAll(() => console.info('Complete seeded games:', JSON.stringify(results)));

test.each(profiles)('board %i, N=%i: dense and sparse positions agree with independent numeric oracle', (size,n) => {
    const g = setup(size,n), random = randomSource(size*1000+n);
    for (let sample=0;sample<24;sample++) {
        const p=[],q=[];
        const density = [.12,.3,.55,.85][sample%4];
        for (let y=1;y<=size;y++) for (let x=1;x<=size;x++) {
            if (random() < density) (random() < .5 ? p : q).push(`${x}:${y}`);
        }
        for (const [mine,other] of [[p,q],[q,p]]) {
            const wins = winningWindows(board(size,mine,other),size,n);
            expect(g.checkWinner(mine,other)).toBe(wins.length>0);
            if (!wins.length) expect(g.getWinningMoves(mine,other).sort()).toEqual(finishers(size,n,mine,other).moves.sort());
        }
    }
});

test.each([4,5,6])('N=%i: all 9 endpoint colors, four directions, gaps and longer chains', n => {
    const size=15, g=setup(size,n);
    for (const [dx,dy] of directions) for (const length of [n,n+1,n+2]) {
        const x=dx===-1 ? 9 : 7;
        const c = i => `${x+i*dx}:${3+i*dy}`;
        const run = Array.from({length},(_,i) => c(i));
        for (const before of [0,1,2]) for (const after of [0,1,2]) {
            const p=[...run],q=[];
            if (before) (before===1?p:q).push(c(-1));
            if (after) (after===1?p:q).push(c(length));
            expect(g.checkWinner(p,q)).toBe(winningWindows(board(size,p,q),size,n).length>0);
            // Removing any interior stone can expose a second, shifted winning window.
            for (const missing of run) {
                const broken=p.filter(c => c !== missing);
                const win=winningWindows(board(size,broken,q),size,n).length>0;
                expect(g.checkWinner(broken,q)).toBe(win);
                if (!win) expect(g.getWinningMoves(broken,q).sort()).toEqual(finishers(size,n,broken,q).moves.sort());
            }
        }
    }
});

test.each([4,5,6])('N=%i: legacy N/N+1/N+2 line counts and availability agree with numeric geometry', n => {
    const size=30,g=setup(size,n),random=randomSource(9200+n),p=[],q=[];
    for (let y=1;y<=size;y++) for (let x=1;x<=size;x++) {
        if (random()<.7) (random()<.5?p:q).push(`${x}:${y}`);
    }
    g.selectedCells=[...p,...q];
    const grid=board(size,p,q);
    for (const type of [0,1,2]) {
        const length=n+type,windows=[];
        for (let y=1;y<=size;y++) for (let x=1;x<=size;x++) for (const [dx,dy] of directions) {
            const ex=x+(length-1)*dx,ey=y+(length-1)*dy;
            if (ex<1 || ex>size || ey>size) continue;
            const cells=Array.from({length},(_,i) => `${x+i*dx}:${y+i*dy}`);
            const values=Array.from({length},(_,i) => grid[y+i*dy][x+i*dx]);
            windows.push({key:cells.join(','),count:values.filter(v => v===1).length,blocked:values.includes(2)});
        }
        for (let count=1;count<=length;count++) for (const available of [false,true]) {
            const expected=windows.filter(w => w.count===count && (!available || !w.blocked)).map(w => w.key).sort();
            const indices=g.getLinesByList(type,[...p,...p.slice(0,5)],count,available);
            expect(new Set(indices).size).toBe(indices.length);
            expect(indices.map(i => g.lines[type][i].join(',')).sort()).toEqual(expected);
        }
    }
});

const matches = [
    ...profiles.map(([size,n],i) => [size,n,1,i%3,(i+1)%3,7300+i]),
    ...[2,3].flatMap(level => [[5,4],[10,5],[10,6]].map(([size,n],i) => [size,n,level,i,(i+2)%3,8100+level*10+i]))
];
test.each(matches)('complete board %i, N=%i, level %i, models %i/%i, seed %i', (size,n,level,pModel,qModel,seed) => {
    const g=setup(size,n);
    g.level=level;
    g.setPlayerAgentModel(models[pModel].NAME);
    g.setComputerAgentModel(models[qModel].NAME);
    jest.spyOn(Math,'random').mockImplementation(randomSource(seed));
    const warn=jest.spyOn(console,'warn');
    let forcedWins=0,forcedDefenses=0;
    for (let ply=0;ply<size*size;ply++) {
        const actor = ply%2 ? 'computer' : 'player';
        expect(g.turn).toBe(actor);
        const p=[...g.getCurrentPlayerCells()],q=[...g.getCompetitorCells()];
        const attack=finishers(size,n,p,q),threat=finishers(size,n,q,p);
        const previous=[...g.selectedCells];
        expect(g.auto()).toBe(5);
        expect(warn).not.toHaveBeenCalled();
        expect(g.selectedCells.slice(0,-1)).toEqual(previous);
        expect(g.selectedCells).toHaveLength(ply+1);
        const move=g.selectedCells[ply];
        expect(previous).not.toContain(move);
        expect(g.cellData[move].label).toBe(ply%2 ? 'o':'x');
        expect(g.blackCells).toHaveLength(Math.ceil((ply+1)/2));
        expect(g.whiteCells).toHaveLength(Math.floor((ply+1)/2));
        expect(g.currentPlayer).toBe(g.turn);
        if (attack.moves.length) {
            forcedWins++;
            expect(attack.moves).toContain(move);
        } else if (threat.moves.length) {
            forcedDefenses++;
            const remaining=finishers(size,n,q,[...p,move]).moves.length;
            const best=Math.min(...threat.defenses.map(c => finishers(size,n,q,[...p,c]).moves.length));
            expect(remaining).toBe(best);
        }
        const wins=winningWindows(board(size,[...p,move],q),size,n);
        expect(winningWindows(board(size,q,[...p,move]),size,n)).toEqual([]);
        if (wins.length) {
            expect(g.winner).toBe(actor);
            expect(g.gameStatus).toBe(actor==='computer'?'lose':'win');
            const marked=Object.entries(g.cellData).filter(([,v]) => v.group.includes('win')).map(([c]) => c).sort();
            expect(wins.some(line => JSON.stringify([...line].sort()) === JSON.stringify(marked))).toBe(true);
            expect(g.getPlayData()[actor+'_count']).toBe(1);
        } else if (ply+1 === size*size) {
            expect(g.gameStatus).toBe('draw');
            expect(g.winner).toBeNull();
        } else {
            expect(['ready','playing']).toContain(g.gameStatus);
            expect(g.winner).toBeNull();
            expect(g.turn).toBe(actor==='player'?'computer':'player');
            continue;
        }
        const final=[...g.selectedCells],scores=g.getPlayData();
        expect(g.auto()).toBe(1);
        expect(g.playerSelect(g.getEmptyCells()[0] || '1:1')).toBe(1);
        expect(g.selectedCells).toEqual(final);
        expect(g.getPlayData()).toEqual(scores);
        const result={size,n,level,p:models[pModel].NAME,q:models[qModel].NAME,seed,plies:ply+1,winner:g.winner || 'draw',forcedWins,forcedDefenses};
        results.push(result);
        process.stdout.write(`Finished seeded game: ${JSON.stringify(result)}\n`);
        g.reset();
        expect(g.selectedCells).toEqual([]);
        expect(g.turn).toBe('player');
        expect(g.getCurrentPlayerCells()).toBe(g.blackCells);
        expect(Object.values(g.cellData).every(c => c.label==='' && !c.group.includes('win'))).toBe(true);
        return;
    }
    throw new Error(`Game did not terminate: ${size}/${n}/${level}/${seed}`);
},120000);
