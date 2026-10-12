// Independent implementation of UCT (Kocsis & Szepesvari, 2006).
// No imports from the existing models, strategy, geometry or referee.
const geometryCache = new Map();
export function seededRandom(seed) {
    return () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
}

function geometry(size, target) {
    const key = `${size}/${target}`;
    if (geometryCache.has(key)) return geometryCache.get(key);
    const windows = [], membership = Array.from({length:size*size}, () => []);
    const index = (x,y) => x>=0 && y>=0 && x<size && y<size ? y*size+x : -1;
    for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
        for (const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]) {
            if (index(x+(target-1)*dx,y+(target-1)*dy)<0) continue;
            const cells = Array.from({length:target}, (_,k) => index(x+k*dx,y+k*dy));
            const id = windows.length;
            windows.push({cells, ends:[index(x-dx,y-dy),index(x+target*dx,y+target*dy)]});
            cells.forEach(c => membership[c].push(id));
        }
    }
    const result = {windows,membership};
    geometryCache.set(key,result);
    return result;
}

export class UCTBoard {
    constructor(size,target,mine=[],other=[]) {
        this.size=size; this.target=target;
        this.geometry=geometry(size,target);
        this.cells=new Uint8Array(size*size);
        this.counts=[null,new Uint8Array(this.geometry.windows.length),new Uint8Array(this.geometry.windows.length)];
        this.empty=size*size;
        for (const [side,list] of [[1,mine],[2,other]]) for (const coord of list) this.place(this.index(coord),side);
    }
    index(coord) {
        const [x,y]=coord.split(':').map(Number);
        if (!Number.isInteger(x)||!Number.isInteger(y)||x<1||y<1||x>this.size||y>this.size) throw new Error('Invalid coordinate');
        return (y-1)*this.size+x-1;
    }
    coord(i) { return `${i%this.size+1}:${Math.floor(i/this.size)+1}`; }
    clone() {
        const b=Object.create(UCTBoard.prototype);
        Object.assign(b,this);
        b.cells=this.cells.slice();
        b.counts=[null,this.counts[1].slice(),this.counts[2].slice()];
        return b;
    }
    place(i,side) {
        if (this.cells[i]!==0) throw new Error('Occupied cell');
        this.cells[i]=side; this.empty--;
        for (const w of this.geometry.membership[i]) this.counts[side][w]++;
    }
    remove(i,side) {
        this.cells[i]=0; this.empty++;
        for (const w of this.geometry.membership[i]) this.counts[side][w]--;
    }
    eligible(id,side) {
        const enemy=3-side, w=this.geometry.windows[id];
        return !this.counts[enemy][id] && w.ends.every(i => i<0 || this.cells[i]!==enemy);
    }
    won(side) {
        return this.geometry.windows.some((w,id) => this.counts[side][id]===this.target && this.eligible(id,side));
    }
    winsAfter(i,side) {
        return this.geometry.membership[i].some(id => this.counts[side][id]===this.target && this.eligible(id,side));
    }
    finishers(side) {
        const moves=new Set();
        this.geometry.windows.forEach((w,id) => {
            if (this.counts[side][id]===this.target-1 && this.eligible(id,side)) {
                moves.add(w.cells.find(c => !this.cells[c]));
            }
        });
        return [...moves];
    }
    legal() { return Array.from(this.cells.keys()).filter(i => !this.cells[i]); }
    // Derived from the rule: an opponent threat can be stopped in its gap OR
    // by occupying either endpoint. Test all legal moves to include both cases.
    actions(side) {
        const wins=this.finishers(side);
        if (wins.length) return wins;
        if (this.finishers(3-side).length) {
            let best=Infinity, defenses=[];
            for (const i of this.legal()) {
                this.place(i,side);
                const remaining=this.finishers(3-side).length;
                this.remove(i,side);
                if (remaining<best) { best=remaining; defenses=[i]; }
                else if (remaining===best) defenses.push(i);
            }
            return defenses;
        }
        if (this.empty===this.cells.length) {
            const lo=Math.floor((this.size-1)/2), hi=Math.ceil((this.size-1)/2);
            return [...new Set([lo*this.size+lo,lo*this.size+hi,hi*this.size+lo,hi*this.size+hi])];
        }
        const nearby=new Set();
        this.cells.forEach((v,i) => {
            if (!v) return;
            const x=i%this.size,y=Math.floor(i/this.size);
            for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
                if (x+dx<0||x+dx>=this.size||y+dy<0||y+dy>=this.size) continue;
                const c=(y+dy)*this.size+x+dx;
                if (!this.cells[c]) nearby.add(c);
            }
        });
        return [...nearby];
    }
    // Count incomplete rule-valid windows through this move. Each additional
    // friendly stone multiplies its sampling weight by four. This policy is
    // local to this model; it is not a learned table or the existing heuristic.
    weight(i,side) {
        let score=1;
        for (const id of this.geometry.membership[i]) {
            for (const s of [side,3-side]) if (this.eligible(id,s)) score+=4**this.counts[s][id];
        }
        return score;
    }
    sample(actions,side,random) {
        if (random()<0.15) return actions[Math.floor(random()*actions.length)];
        const weights=actions.map(i => this.weight(i,side));
        let value=random()*weights.reduce((a,b)=>a+b,0);
        for (let k=0;k<actions.length;k++) { value-=weights[k]; if (value<=0) return actions[k]; }
        return actions[actions.length-1];
    }
    estimate() {
        const scores=[0,0,0];
        this.geometry.windows.forEach((w,id) => {
            for (const s of [1,2]) if (this.eligible(id,s)) scores[s]+=4**this.counts[s][id]-1;
        });
        return .5+.2*(scores[1]-scores[2])/(scores[1]+scores[2]+1);
    }
}

export function searchUCT(board,{iterations=128,depth=24,random=Math.random}={}) {
    const root={move:null,side:1,visits:0,reward:0,children:[],untried:board.actions(1)};
    if (!root.untried.length) return {move:null,iterations:0,children:[]};
    if (board.finishers(1).length || root.untried.length===1) return {move:root.untried[Math.floor(random()*root.untried.length)],iterations:0,children:[]};
    for (let trial=0;trial<iterations;trial++) {
        const b=board.clone(),path=[root];
        let node=root,ply=0,result=null;
        while (ply<depth && b.empty) {
            if (node.untried.length) {
                const move=b.sample(node.untried,node.side,random);
                node.untried.splice(node.untried.indexOf(move),1);
                b.place(move,node.side); ply++;
                const child={move,side:3-node.side,visits:0,reward:0,children:[],untried:[]};
                node.children.push(child); path.push(child);
                if (b.winsAfter(move,node.side)) result=node.side===1?1:0;
                else if (b.empty) child.untried=b.actions(child.side);
                node=child;
                break;
            }
            if (!node.children.length) break;
            const player=node.side;
            node=node.children.reduce((best,c) => {
                const score=n => (player===1?n.reward/n.visits:1-n.reward/n.visits)+Math.sqrt(2*Math.log(path[path.length-1].visits)/n.visits);
                return !best||score(c)>score(best)?c:best;
            },null);
            b.place(node.move,player); ply++; path.push(node);
            if (b.winsAfter(node.move,player)) { result=player===1?1:0; break; }
        }
        let side=node.side;
        while (result===null && ply<depth && b.empty) {
            const actions=b.actions(side);
            if (!actions.length) break;
            const move=b.sample(actions,side,random);
            b.place(move,side); ply++;
            if (b.winsAfter(move,side)) result=side===1?1:0;
            side=3-side;
        }
        if (result===null) result=b.empty ? b.estimate() : .5;
        path.forEach(n => { n.visits++; n.reward+=result; });
    }
    const best=root.children.reduce((a,b) => !a||b.visits>a.visits||(b.visits===a.visits&&b.reward/b.visits>a.reward/a.visits)?b:a,null);
    return {move:best.move,iterations,children:root.children.map(({move,visits,reward})=>({move,visits,reward}))};
}

export default class UCT_Independent {
    static NAME='UCT_Independent';
    static VERSION='1.0.0';
    static AUTHOR='Codex';
    static DESCRIPTION='UCT độc lập: cây Monte Carlo, bàn số và kiểm tra luật riêng; không học từ BOT_Origin.';
    static RULES=['Đoạn N cùng màu thắng khi hai đầu không có đối thủ; biên và quân cùng màu được phép.'];
    static EXAMPLES=['Chọn UCT_Independent làm một agent rồi bật Tự động để đấu bot.'];
    static PARAMETERS=['level','size','winningLineLength'];
    static RESULTS=['Thắng','Thua','Hòa'];
    static LICENSE='MIT';
    static WEBSITE='https://sites.ualberta.ca/~szepesva/papers/ecml06.pdf';
    constructor(game) { this.game=game; this.random=()=>Math.random(); this.lastSearch=null; }
    startGame() { this.lastSearch=null; }
    endGame() {}
    suggest(mine) {
        const g=this.game;
        const b=new UCTBoard(g.sizes[g.size],g.winningLineLength,mine,g.getCompetitorCells());
        const level=Math.max(1,Math.min(3,g.level||1));
        this.lastSearch=searchUCT(b,{iterations:[128,256,512][level-1],depth:[24,32,40][level-1],random:this.random});
        return this.lastSearch.move===null ? [] : [b.coord(this.lastSearch.move)];
    }
}
