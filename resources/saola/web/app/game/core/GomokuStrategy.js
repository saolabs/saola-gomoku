// Pure position analysis: simulated positions never read the live board occupancy.
const weightFor = (count, target) => count === 0 ? 0 : count === target ? 10000000 :
    target - count === 1 ? 18000 : target - count === 2 ? 180 : target - count === 3 ? 18 : 2;
const geometryCache = new WeakMap();
const cellIndex = (cell, columns) => {
    const [x, y] = cell.split(':').map(Number);
    return (y - 1) * columns + x - 1;
};

function geometryFor(game) {
    if (!geometryCache.has(game.lines[0])) {
        geometryCache.set(game.lines[0], game.lines[0].map(line => ({
            line,
            indices: line.map(cell => cellIndex(cell, game.column)),
            endpoints: game.getLineEndpoints(line).map(cell => game.isValidCoordinate(cell) ? cellIndex(cell, game.column) : -1),
        })));
    }
    return geometryCache.get(game.lines[0]);
}

export function analyzePosition(game, cells, opponents) {
    const board = new Uint8Array(game.column * game.row);
    cells.forEach(cell => { board[cellIndex(cell, game.column)] = 1; });
    opponents.forEach(cell => { board[cellIndex(cell, game.column)] = 2; });
    const winningMoves = new Set();
    const blockingMoves = new Set();
    const forkCandidates = new Set();
    const opportunities = new Map();
    let score = 0;
    for (const { line, indices, endpoints: [before, after] } of geometryFor(game)) {
        // Match the referee: only an opponent at an N-window endpoint blocks it.
        // Friendly stones outside the window are allowed.
        if (board[before] === 2 || board[after] === 2) continue;
        let count = 0;
        let blocked = false;
        const empty = [];
        for (let i = 0; i < line.length; i++) {
            if (board[indices[i]] === 2) { blocked = true; break; }
            if (board[indices[i]] === 1) count++;
            else empty.push(line[i]);
        }
        if (blocked) continue;
        const weight = weightFor(count, game.winningLineLength);
        score += weight;
        if (empty.length === 1) {
            winningMoves.add(empty[0]);
            blockingMoves.add(empty[0]);
            for (const endpoint of game.getLineEndpoints(line)) {
                if (game.isValidCoordinate(endpoint) && !cells.includes(endpoint) && !opponents.includes(endpoint)) {
                    blockingMoves.add(endpoint);
                }
            }
        }
        if (empty.length === 2) empty.forEach(cell => forkCandidates.add(cell));
        if (count >= 2 && empty.length) {
            for (const cell of empty) {
                opportunities.set(cell, (opportunities.get(cell) || 0) + weight);
            }
        }
    }
    return { score, winningMoves: [...winningMoves], blockingMoves: [...blockingMoves], forkCandidates: [...forkCandidates], opportunities };
}

export function candidateMoves(game, cells, opponents) {
    const occupied = new Set([...cells, ...opponents]);
    if (!occupied.size) {
        const openings = [];
        for (let x=Math.floor((game.column+1)/2)-1;x<=Math.ceil((game.column+1)/2)+1;x++) {
            for (let y=Math.floor((game.row+1)/2)-1;y<=Math.ceil((game.row+1)/2)+1;y++) {
                const cell=`${x}:${y}`;
                if (game.isValidCoordinate(cell)) openings.push(cell);
            }
        }
        return openings;
    }
    const candidates = new Set();
    for (const cell of occupied) {
        const [x, y] = cell.split(':').map(Number);
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                const move = `${x + dx}:${y + dy}`;
                if (game.isValidCoordinate(move) && !occupied.has(move)) candidates.add(move);
            }
        }
    }
    return [...candidates];
}

export const STRATEGY_PROFILES = {
    balanced: { defense: 1.15, initiative: 1, variety: 1 },
    attacking: { defense: 1, initiative: 1.3, variety: 1.5 },
    defensive: { defense: 1.3, initiative: .85, variety: .7 },
};

// Return alternatives close to the best evaluation. Tactical wins/losses belong
// to a separate score band: variety must never mix them with quiet positions.
function comparableMoves(ranked, scoreKey, level, profile) {
    const best = ranked[0][scoreKey];
    const tactical = Math.abs(best) >= 1000000;
    const tolerance = tactical ? 0 : Math.min(180, Math.max(24, Math.abs(best) * .03)) *
        profile.variety * (level <= 1 ? 2 : 1);
    return ranked.filter(item => best - item[scoreKey] <= tolerance &&
        (tactical || Math.abs(item[scoreKey]) < 1000000))
        .slice(0, level <= 1 ? 8 : 5).map(item => item.move);
}

function rankCandidates(game, cells, opponents, analyze, profile, moves = candidateMoves(game,cells,opponents)) {
    const offense = analyze(cells, opponents);
    const defense = analyze(opponents, cells);
    return moves.map(move => {
        const next = [...cells, move];
        const attack = analyze(next, opponents);
        const defend = analyze(opponents, next);
        const [x, y] = move.split(':').map(Number);
        const center = 16 - Math.abs(x - (game.column + 1) / 2) - Math.abs(y - (game.row + 1) / 2);
        return {
            move,
            attack,
            score: attack.score - profile.defense * defend.score +
                profile.initiative * (offense.opportunities.get(move) || 0) +
                profile.defense * (defense.opportunities.get(move) || 0) + center,
        };
    }).sort((a, b) => b.score - a.score);
}

// Two winning squares can share an endpoint defense. Verify every gap/endpoint
// response, and allow a counter-win to take priority over defending a fork.
function unstoppable(mine,theirs,analyze) {
    if (analyze(theirs,mine).winningMoves.length) return false;
    const threats=analyze(mine,theirs);
    return threats.winningMoves.length>=2 && threats.blockingMoves.every(reply =>
        analyze(mine,[...theirs,reply]).winningMoves.length>0);
}

export function findStrategicMoves(game, cells, opponents, level = game.level, style = 'balanced', extraCandidates = []) {
    const wins = game.getWinningMoves(cells, opponents);
    if (wins.length) return wins;
    if (!cells.length && !opponents.length) return candidateMoves(game,cells,opponents);

    const profile = STRATEGY_PROFILES[style] || STRATEGY_PROFILES.balanced;
    const cache = new Map();
    const analyze = (mine, theirs) => {
        const key = `${[...mine].sort().join(',')}|${[...theirs].sort().join(',')}`;
        if (!cache.has(key)) cache.set(key, analyzePosition(game, mine, theirs));
        return cache.get(key);
    };
    const defenses=game.getDefensiveMoves(cells,opponents);
    const occupied=new Set([...cells,...opponents]);
    const candidates=[...new Set([...candidateMoves(game,cells,opponents),...extraCandidates])]
        .filter(move => game.isValidCoordinate(move) && !occupied.has(move));
    let ranked = rankCandidates(game, cells, opponents, analyze, profile,
        defenses.length ? defenses : candidates);
    if (!ranked.length) return [];
    // All defenses already minimize immediate losing threats. Prefer those which
    // also create our next opportunity or destroy more of the opponent's lines.
    if (defenses.length) return comparableMoves(ranked,'score',level,profile);
    // Endpoint defense can cancel several winning squares at once.
    const forks = ranked.filter(item => item.attack.winningMoves.length >= 2 &&
        unstoppable([...cells, item.move], opponents,analyze));
    if (forks.length) return forks.map(item => item.move);

    // A one-move fork is urgent even at level 1. Check it before randomness and
    // before the minimax shortlist can discard the only safe defensive move.
    const enemyForks=analyze(opponents,cells).forkCandidates.filter(move =>
        unstoppable([...opponents,move],cells,analyze));
    if (enemyForks.length) {
        for (const item of ranked) item.forkReplies=enemyForks.filter(reply => reply!==item.move &&
            unstoppable([...opponents,reply],[...cells,item.move],analyze)).length;
        const fewest=Math.min(...ranked.map(item => item.forkReplies));
        ranked=ranked.filter(item => item.forkReplies===fewest);
    }
    if (level <= 1) return comparableMoves(ranked, 'score', level, profile);

    // Bounded minimax over the strongest candidates, including every forced reply.
    const width = level >= 3 ? 12 : 6;
    const shortlist = ranked.slice(0, width);
    for (const item of shortlist) {
        const next = [...cells, item.move];
        const forcedReplies = game.getTacticalMoves(opponents, next);
        const replies = forcedReplies.length ? forcedReplies :
            rankCandidates(game, opponents, next, analyze, profile).slice(0, width).map(reply => reply.move);
        let worst = Infinity;
        for (const reply of replies) {
            const other = [...opponents, reply];
            const attack = analyze(next, other);
            const defense = analyze(other, next);
            let value = attack.score - profile.defense * defense.score;
            if (game.checkWinner(other, next)) value = -100000000;
            else if (attack.winningMoves.length) value = 10000000;
            else if (defense.winningMoves.length >= 2 && game.hasUnstoppableThreat(other, next)) value = -10000000;
            // Level 3 also searches a third ply; all tactical moves bypass pruning.
            else if (level >= 3) {
                const tactical = game.getTacticalMoves(next, other);
                const continuations = tactical.length ? tactical :
                    rankCandidates(game, next, other, analyze, profile).slice(0, 4).map(move => move.move);
                let best = -Infinity;
                for (const continuation of continuations) {
                    const future = [...next, continuation];
                    const a = analyze(future, other);
                    const d = analyze(other, future);
                    const futureValue = game.checkWinner(future, other) ? 10000000 :
                        d.winningMoves.length ? -10000000 :
                        a.winningMoves.length >= 2 && game.hasUnstoppableThreat(future, other) ? 5000000 : a.score - profile.defense * d.score;
                    best = Math.max(best, futureValue);
                }
                if (Number.isFinite(best)) value = best;
            }
            worst = Math.min(worst, value);
        }
        item.searchScore = Number.isFinite(worst) ? worst : item.score;
    }
    shortlist.sort((a, b) => b.searchScore - a.searchScore || b.score - a.score);
    return comparableMoves(shortlist, 'searchScore', level, profile);
}
