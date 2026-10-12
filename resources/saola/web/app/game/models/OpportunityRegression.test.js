import CorrectFiveGame from '../core/CorrectFiveGame';
import BOT_Origin from './BOT_Origin';
import C5_Demo from './C5-demo';
import C5_2025 from './C5-2025';

const configurations=[BOT_Origin,C5_Demo,C5_2025].flatMap(Model => [1,2,3].map(level => [Model.NAME,level,Model]));
function position(p,q,n=5) {
    const g=new CorrectFiveGame();
    jest.spyOn(g,'createSounds').mockImplementation(() => {});
    g.init({size:2,winningLineLength:n,soundOn:false});
    g.create();
    g.turn='computer';
    g.currentPlayer='computer';
    g.computerCells=p;
    g.playerCells=q;
    g.selectedCells=[...p,...q];
    return g;
}
afterEach(() => jest.restoreAllMocks());

test.each(configurations)('%s level %i blocks a future crossing fork before it becomes an immediate threat', (name,level,Model) => {
    const p=['10:10','12:10','9:12'];
    const q=['5:8','6:8','8:8','7:6','7:7','7:9'];
    const g=position(p,q);
    g.level=level;
    expect(g.getWinningMoves(p,q)).toEqual([]);
    expect(g.getWinningMoves(q,p)).toEqual([]);
    expect(g.hasUnstoppableThreat([...q,'7:8'],p)).toBe(true);
    const before=JSON.stringify(g.getBoardState());
    const moves=new Model(g).suggest(p);
    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) {
        expect(g.checkCellAvailable(move)).toBe(true);
        if (move!=='7:8') expect(g.hasUnstoppableThreat([...q,'7:8'],[...p,move])).toBe(false);
    }
    expect(JSON.stringify(g.getBoardState())).toBe(before);
},30000);

test.each(configurations)('%s level %i chooses a defense that also builds its own next-turn opportunity', (name,level,Model) => {
    for (const n of [4,5,6]) {
        const q=Array.from({length:n},(_,i) => `${5+i}:8`).filter(c => c!=='7:8');
        const p=Array.from({length:n-2},(_,i) => `7:${10-n+i}`);
        const g=position(p,q,n);
        g.level=level;
        expect(g.getWinningMoves(p,q)).toEqual([]);
        expect(g.getWinningMoves(q,p)).toContain('7:8');
        expect(g.getDefensiveMoves(p,q)).toContain('7:8');
        const moves=new Model(g).suggest(p);
        expect(moves).toEqual(['7:8']);
        expect(g.getWinningMoves(q,[...p,'7:8'])).toEqual([]);
        expect(g.getWinningMoves([...p,'7:8'],q).length).toBeGreaterThan(0);
    }
},30000);

test.each([1,2,3])('BOT_Origin level %i restores original heuristic rollouts without repeated or live-board moves', level => {
    const p=['8:8','9:8','8:9'],q=['6:6','7:6','6:7'];
    const g=position(p,q);
    g.level=level;
    let seed=9000+level;
    jest.spyOn(Math,'random').mockImplementation(() => {
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        return seed/4294967296;
    });
    const model=new BOT_Origin(g);
    const original=model.getSuggestWithoutReviews.bind(model);
    let simulatedPositions=0;
    jest.spyOn(model,'getSuggestWithoutReviews').mockImplementation((mine,other,depth) => {
        const moves=original(mine,other,depth);
        for (const move of moves) {
            expect(mine).not.toContain(move);
            expect(other).not.toContain(move);
            expect(g.isValidCoordinate(move)).toBe(true);
        }
        if (mine.length+other.length>p.length+q.length) simulatedPositions++;
        return moves;
    });
    const heuristic=jest.spyOn(BOT_Origin.prototype,'getHeuristicMoves');
    const simulate=jest.spyOn(model,'simulateMove');
    const before=JSON.stringify(g.getBoardState());
    const moves=model.suggest(p);
    expect(moves.length).toBeGreaterThan(0);
    expect(heuristic).toHaveBeenCalled();
    expect(simulate).toHaveBeenCalled();
    expect(simulatedPositions).toBeGreaterThan(0);
    for (const move of moves) expect(g.checkCellAvailable(move)).toBe(true);
    expect(JSON.stringify(g.getBoardState())).toBe(before);
},30000);

test('poor original rollout scores cannot reopen unsafe random candidates', () => {
    const g=position(['8:8'],['7:7']);
    const model=new BOT_Origin(g);
    jest.spyOn(model,'simulateMove').mockReturnValue({'8:9':0,'9:8':-5});
    const random=jest.spyOn(model,'getRandomMoves').mockReturnValue(['1:1']);
    expect(model.getTopReviewMoves(['8:8','8:7','7:8'],['7:7'],['8:9','9:8'])).toEqual(['8:9','9:8']);
    expect(random).not.toHaveBeenCalled();
});

test.each([5,10,15,20,25,30])('ordinary autoplay on %ix board has multiple legal opening choices', size => {
    const g=position([],[]);
    g.init({size:[5,10,15,20,25,30].indexOf(size),winningLineLength:size===5?4:5,soundOn:false});
    g.create();
    const moves=new BOT_Origin(g).suggest([]);
    expect(moves.length).toBeGreaterThanOrEqual(9);
    expect(new Set(moves).size).toBe(moves.length);
    for (const move of moves) expect(g.checkCellAvailable(move)).toBe(true);
});

test('restored intersections include every shared empty square, deduplicate indices and ignore invalid lines', () => {
    const g=position(['6:8'],[]);
    const model=new BOT_Origin(g);
    const first=g.lines[0].findIndex(line => line.join(',')==='4:8,5:8,6:8,7:8,8:8');
    const second=g.lines[0].findIndex(line => line.join(',')==='5:8,6:8,7:8,8:8,9:8');
    const vertical=g.lines[0].findIndex(line => line.join(',')==='6:6,6:7,6:8,6:9,6:10');
    expect(first).toBeGreaterThan(0);
    expect(model.findIntersection(0,[first,first])).toEqual([]);
    expect(model.findIntersection(0,[second,first,vertical,first,-1,99999]).sort()).toEqual(['5:8','7:8','8:8']);
});

test.each([1,2,3])('original rollout level %i ranks a real late win above a real late loss', level => {
    const p=['1:1','2:1','2:14'],q=['1:8'],g=position(p,q),model=new BOT_Origin(g);
    g.level=level;
    const rounds=level*3;
    const scatteredP=['8:2','10:2','12:2','8:4','10:4','12:4','8:6','10:6','12:6'];
    const scatteredQ=['14:2','14:4','14:6','14:10','14:12','14:14','14:8','12:10','12:12'];
    const winningP=[...scatteredP.slice(0,rounds-2),'4:1','5:1'];
    const losingQ=[...scatteredQ.slice(0,rounds-3),'2:8','3:8','4:8','5:8'];
    const finished={};
    const referee=g.checkWinner.bind(g);
    jest.spyOn(g,'checkWinner').mockImplementation((mine,other) => {
        const won=referee(mine,other);
        if (won) finished[mine.includes('1:8')?'loss':'win']=[...mine];
        return won;
    });
    // Supply legal continuations to isolate terminal scoring from the policy.
    jest.spyOn(model,'getSuggestWithoutReviews').mockImplementation((mine,other) => {
        const defending=mine.includes('1:8');
        const bad=mine.includes('10:10') || other.includes('10:10');
        const next=defending ? (bad?losingQ:scatteredQ)[mine.length-1] :
            (bad?scatteredP:winningP)[mine.length-p.length-1];
        expect(next).toBeDefined();
        expect([...mine,...other]).not.toContain(next);
        return [next];
    });
    jest.spyOn(BOT_Origin.prototype,'getImportantMoves').mockReturnValue(['15:15']);
    const before=JSON.stringify(g.getBoardState());
    const scores=model.simulateMove(p,q,['10:10','3:1'],rounds);
    expect(referee(finished.win,finished.loss)).toBe(true);
    expect(referee(finished.loss,finished.win)).toBe(true);
    expect(scores['3:1']).toBeGreaterThan(scores['10:10']);
    expect(model.getTopReviewMoves(p,q,['10:10','3:1'])).toEqual(['3:1']);
    expect(JSON.stringify(g.getBoardState())).toBe(before);
});

test('equal quiet rollout scores of 100 keep every equivalent candidate', () => {
    const p=['1:1','2:1','3:1'],q=['1:8','2:8','3:8'],g=position(p,q),model=new BOT_Origin(g);
    jest.spyOn(model,'simulateMove').mockReturnValue({'8:9':100,'9:8':100});
    expect(model.getTopReviewMoves(p,q,['8:9','9:8'])).toEqual(['8:9','9:8']);
});

test('level 3 original heuristic reads the game difficulty and uses normal free windows', () => {
    const p=['5:8','6:8','8:8'],g=position(p,[]),model=new BOT_Origin(g);
    g.level=3;
    expect(model.getImportantMoves(p,[],2,3).sort()).toEqual(['4:8','7:8','9:8']);
});

test('original adjacency checks receive a coordinate rather than a stone count', () => {
    const p=['5:8','6:8','8:8'],g=position(p,[]),model=new BOT_Origin(g);
    g.level=2;
    const near=jest.spyOn(g,'checkNearBy');
    model.getImportantMoves(p,[],2,0);
    expect(near).toHaveBeenCalled();
    for (const [,index,mine,cell] of near.mock.calls) {
        expect(g.isValidCoordinate(cell)).toBe(true);
        expect(mine).toEqual(p);
        expect(g.lines[1][index]).toContain(cell);
    }
});

test('zero-round rollout still returns finite scores for every legal candidate', () => {
    const p=['8:8','9:8','8:9'],q=['6:6','7:6','6:7'],g=position(p,q),model=new BOT_Origin(g);
    const scores=model.simulateMove(p,q,['9:9','10:8'],0);
    expect(Object.keys(scores).sort()).toEqual(['10:8','9:9']);
    expect(Object.values(scores).every(Number.isFinite)).toBe(true);
});

test('original level 2 normal-window heuristic retains the real gap after extension', () => {
    const p=['5:8','6:8','7:8','9:8'],g=position(p,[]),model=new BOT_Origin(g);
    g.level=2;
    expect(model.getImportantMoves(p,[],1,3).sort()).toEqual(['10:8','4:8','8:8']);
});

test('original border-window heuristic retains its winning gap', () => {
    const p=['1:1','2:1','4:1','5:1'],g=position(p,[]),model=new BOT_Origin(g);
    const moves=model.getImportantMoves(p,[],1,3);
    expect(moves).toContain('3:1');
    for (const move of moves) expect(g.checkCellAvailable(move)).toBe(true);
    expect(g.checkWinner([...p,'3:1'],[])).toBe(true);
});
