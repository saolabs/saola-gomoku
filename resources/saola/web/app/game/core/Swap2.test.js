import CorrectFiveGame from './CorrectFiveGame';

function game(mode = 'ai') {
    const g = new CorrectFiveGame();
    g.soundOn = false;
    jest.spyOn(g, 'createSounds').mockImplementation(() => {});
    g.setGameMode(mode);
    g.init({openingRule:'swap2',soundOn:false});
    g.create();
    return g;
}

afterEach(() => jest.restoreAllMocks());

test.each(['ai', 'twoPlayer'])('the first participant places all black-white-black stones in %s', mode => {
    const g = game(mode);
    const first = g.getFirstActor();
    const second = g.getSecondActor();
    expect(g.resolveOpeningChoice('black')).toBe(2);
    expect(g.playerSelect('8:8')).toBe(5);
    expect(g.cellData['8:8'].label).toBe('x');
    expect(g.turn).toBe(first);
    expect(g.playerSelect('9:8')).toBe(5);
    expect(g.cellData['9:8'].label).toBe('o');
    expect(g.turn).toBe(first);
    expect(g.playerSelect('8:9')).toBe(5);
    expect(g.turn).toBe(second);
    expect(g.openingPhase).toBe('chooseSecond');
    expect(g.choose('1:1')).toBe(2);
    expect(g.selectedCells).toHaveLength(3);
});

test.each(['black', 'white'])('second participant chooses %s; white moves next with correct ownership', color => {
    const g = game();
    ['8:8', '9:8', '8:9'].forEach(cell => g.playerSelect(cell));
    expect(g.resolveOpeningChoice(color)).toBe(5);
    expect(g.colors.computer).toBe(color);
    expect(g.getCurrentColor()).toBe('white');
    expect(g.turn).toBe(color === 'white' ? 'computer' : 'player');
    expect(g.playerCells).toEqual(color === 'black' ? ['9:8'] : ['8:8', '8:9']);
    expect(g.auto()).toBe(5);
    expect(g.cellData[g.selectedCells[3]].label).toBe('o');
    expect(g.getCurrentColor()).toBe('black');
});

test.each(['black', 'white'])('Swap2 extension lets the first participant finally choose %s', choice => {
    const g = game('twoPlayer');
    ['8:8', '9:8', '8:9'].forEach(cell => g.playerSelect(cell));
    expect(g.resolveOpeningChoice('extend')).toBe(5);
    expect(g.turn).toBe('player2');
    expect(g.playerSelect('9:9')).toBe(5);
    expect(g.cellData['9:9'].label).toBe('o');
    expect(g.turn).toBe('player2');
    expect(g.playerSelect('7:8')).toBe(5);
    expect(g.cellData['7:8'].label).toBe('x');
    expect(g.turn).toBe('player1');
    expect(g.openingPhase).toBe('chooseFirst');
    expect(g.resolveOpeningChoice('extend')).toBe(4);
    expect(g.resolveOpeningChoice(choice)).toBe(5);
    expect(g.colors.player1).toBe(choice);
    expect(g.player1Cells).toHaveLength(choice === 'black' ? 3 : 2);
    expect(g.getCurrentColor()).toBe('white');
    const actor = g.turn;
    expect(g.playerSelect('10:10')).toBe(5);
    expect(g.cellData['10:10'].label).toBe('o');
    expect(g.turn).not.toBe(actor);
});

test('automatic opening progresses without a manual color decision', () => {
    const g = game();
    for (let i = 0; i < 4; i++) expect(g.auto()).toBe(5);
    expect(g.openingPhase).toBe('complete');
    expect(g.selectedCells).toHaveLength(3);
    expect(g.colors.player).not.toBe(g.colors.computer);
    expect(g.getCurrentColor()).toBe('white');
});

test('seeded autoplay varies opening shape and the following game rather than replaying a script', () => {
    const random = jest.spyOn(Math, 'random');
    const openings = new Set(), shapes = new Set(), games = new Set();
    for (let sample = 1; sample <= 20; sample++) {
        let seed = sample * 12345;
        random.mockImplementation(() => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
        });
        const g = game();
        g.level = 1;
        for (let i = 0; i < 4; i++) expect(g.auto()).toBe(5);
        const opening = [...g.selectedCells];
        expect(new Set(opening).size).toBe(3);
        expect(g.blackCells).toHaveLength(2);
        expect(g.whiteCells).toHaveLength(1);
        openings.add(opening.join(','));
        const [ax, ay] = opening[0].split(':').map(Number);
        shapes.add(opening.map(cell => {
            const [x, y] = cell.split(':').map(Number);
            return `${x-ax}:${y-ay}`;
        }).join(','));
        for (let i = 0; i < 7; i++) expect(g.auto()).toBe(5);
        games.add(g.selectedCells.join(','));
    }
    expect(openings.size).toBeGreaterThanOrEqual(15);
    expect(shapes.size).toBeGreaterThanOrEqual(15);
    expect(games.size).toBeGreaterThanOrEqual(15);
});

test('resignation awards the opposing participant and rejects further moves', () => {
    const g = game('twoPlayer');
    expect(g.resign()).toBe(5);
    expect(g.winner).toBe('player2');
    expect(g.gameStatus).toBe('win');
    expect(g.playerSelect('8:8')).toBe(1);
});

test('a draw agreement needs completed opening and the other participant response', () => {
    const g = game();
    expect(g.offerDraw()).toBe(1);
    for (let i = 0; i < 4; i++) g.auto();
    expect(g.offerDraw()).toBe(5);
    const offerer = g.turn;
    expect(g.respondDraw(true, offerer)).toBe(2);
    const other = offerer === 'player' ? 'computer' : 'player';
    expect(g.respondDraw(false, other)).toBe(5);
    expect(g.gameStatus).toBe('playing');
    g.offerDraw();
    expect(g.respondDraw(true, other)).toBe(5);
    expect(g.gameStatus).toBe('draw');
});

test.each(['black', 'white'])('normal play after the second participant chooses %s awards the correct white owner', color => {
    const g = game('twoPlayer');
    ['8:8', '9:8', '8:9'].forEach(cell => g.playerSelect(cell));
    g.resolveOpeningChoice(color);
    const whiteOwner = g.turn;
    const sequence = ['11:12', '10:13', '12:12', '11:13', '13:12', '13:13', '14:12', '1:1', '15:12'];
    for (const cell of sequence) expect(g.playerSelect(cell)).toBe(5);
    expect(g.gameStatus).toBe('win');
    expect(g.winner).toBe(whiteOwner);
    expect(g.colors[g.winner]).toBe('white');
    expect(g.cellData['15:12'].label).toBe('o');
    expect(g.cellData['15:12'].group).toContain('win');
    expect(g.playerSelect('2:1')).toBe(1);
});
