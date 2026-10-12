import UCT_Independent, {UCTBoard,searchUCT,seededRandom} from './UCT_Independent';
import CorrectFiveGame from '../core/CorrectFiveGame';

const sizes=[5,10,15,20,25,30];
const profiles=sizes.flatMap(size => [4,5,6].filter(n=>n<=size).map(n=>[size,n]));
// Separate oracle walks contiguous runs. It does not use UCT's window index.
function oracle(size,n,p,q) {
    const mine=new Set(p),enemy=new Set(q);
    for (const c of mine) {
        const [x,y]=c.split(':').map(Number);
        for (const [dx,dy] of [[1,0],[0,1],[1,1],[-1,1]]) {
            if (mine.has(`${x-dx}:${y-dy}`)) continue;
            let length=0;
            while(mine.has(`${x+length*dx}:${y+length*dy}`)) length++;
            for(let offset=0;offset+n<=length;offset++) {
                if(!enemy.has(`${x+(offset-1)*dx}:${y+(offset-1)*dy}`)&&
                   !enemy.has(`${x+(offset+n)*dx}:${y+(offset+n)*dy}`)) return true;
            }
        }
    }
    return false;
}
test.each(profiles)('independent rules board %i N=%i match run oracle in both colors', (size,n)=>{
    const random=seededRandom(size*100+n);
    for(let sample=0;sample<12;sample++) {
        const p=[],q=[];
        for(let y=1;y<=size;y++) for(let x=1;x<=size;x++) {
            if(random()<[.15,.4,.8][sample%3]) (random()<.5?p:q).push(`${x}:${y}`);
        }
        const b=new UCTBoard(size,n,p,q);
        expect(b.won(1)).toBe(oracle(size,n,p,q));
        expect(b.won(2)).toBe(oracle(size,n,q,p));
        for(const [s,mine,enemy] of [[1,p,q],[2,q,p]]) {
            if(b.won(s)) continue;
            const expected=b.legal().filter(i=>oracle(size,n,[...mine,b.coord(i)],enemy));
            expect(b.finishers(s).sort((a,b)=>a-b)).toEqual(expected);
        }
    }
});
test.each([4,5,6])('all endpoint colors, directions and overlines N=%i',n=>{
    for(const [dx,dy] of [[1,0],[0,1],[1,1],[-1,1]]) for(const length of [n,n+1,n+2]) {
        const c=k=>`${9+k*dx}:${3+k*dy}`;
        for(const left of [0,1,2]) for(const right of [0,1,2]) {
            const p=Array.from({length},(_,k)=>c(k)),q=[];
            if(left) (left===1?p:q).push(c(-1));
            if(right) (right===1?p:q).push(c(length));
            const b=new UCTBoard(20,n,p,q);
            expect(b.won(1)).toBe(oracle(20,n,p,q));
        }
    }
});
test('edge run and reported diagonal 5:4–9:8 win',()=>{
    expect(new UCTBoard(15,5,['5:4','6:5','7:6','8:7','9:8'],[]).won(1)).toBe(true);
    expect(new UCTBoard(5,5,['1:1','2:1','3:1','4:1','5:1'],[]).won(1)).toBe(true);
});
test('defense includes gap and either empty endpoint; inputs and counts stay unchanged',()=>{
    const b=new UCTBoard(10,5,['10:10'],['3:5','4:5','5:5','6:5']);
    const before=JSON.stringify([b.cells,b.counts,b.empty]);
    const actions=b.actions(1);
    expect(actions.map(i=>b.coord(i)).sort()).toEqual(['2:5','7:5']);
    expect(JSON.stringify([b.cells,b.counts,b.empty])).toBe(before);
    for(const i of actions) { const copy=b.clone();copy.place(i,1);expect(copy.finishers(2)).toEqual([]); }
});
test('own immediate win takes priority over enemy threat',()=>{
    const b=new UCTBoard(10,5,['3:3','4:3','5:3','6:3'],['3:7','4:7','5:7','6:7']);
    const result=searchUCT(b,{random:seededRandom(11)});
    expect(b.finishers(1)).toContain(result.move);
    expect(result.iterations).toBe(0);
});
test('UCT uses repeated tree visits and reproducible rewards without changing board',()=>{
    const b=new UCTBoard(5,4,['3:3'],['2:3']);
    const before=JSON.stringify([b.cells,b.counts,b.empty]);
    const a=searchUCT(b,{iterations:64,depth:12,random:seededRandom(710)});
    expect(a).toEqual(searchUCT(b,{iterations:64,depth:12,random:seededRandom(710)}));
    expect(a.children.reduce((s,c)=>s+c.visits,0)).toBe(64);
    expect(a.children.some(c=>c.visits>1)).toBe(true);
    expect(a.children.every(c=>c.reward>=0&&c.reward<=c.visits)).toBe(true);
    expect(b.cells[a.move]).toBe(0);
    expect(JSON.stringify([b.cells,b.counts,b.empty])).toBe(before);
});
test('model only reads public board configuration and opposing stones',()=>{
    const data={sizes,size:1,winningLineLength:5,level:1,getCompetitorCells:()=>['3:5','4:5','5:5','6:5']};
    const game=new Proxy(data,{get(target,key){if(!(key in target))throw new Error(`Forbidden engine access: ${key}`);return target[key];}});
    const bot=new UCT_Independent(game);bot.random=seededRandom(10);
    expect(['2:5','7:5']).toContain(bot.suggest(['10:10'])[0]);
});
test('registered model plays a complete legal game through the real engine',()=>{
    localStorage.clear();
    const g=new CorrectFiveGame();jest.spyOn(g,'createSounds').mockImplementation(()=>{});
    g.init({size:0,winningLineLength:4,soundOn:false,level:1});g.create();
    g.setPlayerAgentModel(UCT_Independent.NAME);g.setComputerAgentModel(UCT_Independent.NAME);
    const random=jest.spyOn(Math,'random').mockImplementation(seededRandom(822));
    for(let ply=0;ply<25;ply++) {
        const actor=g.turn;
        expect(g.auto()).toBe(5);
        expect(g.selectedCells).toHaveLength(ply+1);
        expect(new Set(g.selectedCells).size).toBe(ply+1);
        const winner=oracle(5,4,g.playerCells,g.computerCells)?'player':oracle(5,4,g.computerCells,g.playerCells)?'computer':null;
        expect(g.winner).toBe(winner);
        if(winner||g.gameStatus==='draw') {expect(winner===null||winner===actor).toBe(true);break;}
    }
    expect(['win','lose','draw']).toContain(g.gameStatus);
    random.mockRestore();jest.restoreAllMocks();
});
