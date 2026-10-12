import CorrectFiveGame from './CorrectFiveGame';
import { refreshGameImplementation } from './Caro';

test.each(['ai','twoPlayer'])('v2 migration corrects the earliest longer-chain winner in %s without double-counting', mode => {
    localStorage.clear();
    const game = new CorrectFiveGame();
    jest.spyOn(game,'createSounds').mockImplementation(() => {});
    game.setGameMode(mode);
    game.init({size:2,winningLineLength:5,openingRule:'standard',soundOn:false});
    game.create();
    const history = ['5:4','11:7','6:5','11:8','8:7','11:9','9:8','11:10','10:9','1:1','7:6','11:11'];
    for (const cell of history) {
        game.choose(cell);
        game.switchTurn();
    }
    const wrongWinner = game.getSecondActor();
    game.winner = wrongWinner;
    game.gameStatus = mode === 'ai' ? 'lose' : 'win';
    game.incCount(wrongWinner+'_count');
    game.checkWinner(game.whiteCells,game.blackCells,'win');
    game.rulesVersion = 'caro-blocked-custom-v2';
    const table = game.table;
    refreshGameImplementation(game);
    expect(game.table).toBe(table);
    expect(game.rulesVersion).toBe('caro-blocked-custom-v3');
    expect(game.winner).toBe(game.getFirstActor());
    expect(game.gameStatus).toBe('win');
    expect(game.selectedCells).toEqual(history.slice(0,11));
    expect(game.cellData['11:11'].label).toBe('');
    expect(game.getPlayData()[wrongWinner+'_count']).toBe(0);
    expect(game.getPlayData()[game.winner+'_count']).toBe(1);
    expect(Object.values(game.cellData).filter(c=>c.group.includes('win'))).toHaveLength(5);
    expect(game.blackCells).toBe(mode === 'ai' ? game.playerCells : game.player1Cells);
    refreshGameImplementation(game);
    expect(game.getPlayData()[game.winner+'_count']).toBe(1);
    jest.restoreAllMocks();
});

test('v2 migration preserves a still-playing game with no winning window', () => {
    const game = new CorrectFiveGame();
    jest.spyOn(game,'createSounds').mockImplementation(() => {});
    game.create();
    game.playerSelect('8:8');
    game.rulesVersion = 'caro-blocked-custom-v2';
    game.autoPlay = true;
    refreshGameImplementation(game);
    expect(game.selectedCells).toEqual(['8:8']);
    expect(game.turn).toBe('computer');
    expect(game.winner).toBeNull();
    expect(game.autoPlay).toBe(true);
    jest.restoreAllMocks();
});

test('hot replacement preserves the live board, turn, autoplay and event subscriptions', () => {
    class PreviousGame extends CorrectFiveGame {
        checkWinner() { return false; }
    }
    const game = new PreviousGame();
    game.soundOn = false;
    jest.spyOn(game, 'createSounds').mockImplementation(() => {});
    game.create(15, 15, 5);
    game.gameStart();
    game.openingPhase = 'complete';
    game.colors = { player: 'black', computer: 'white' };
    ['5:8', '6:8', '7:8', '8:8', '9:8'].forEach(cell => game.choose(cell));
    game.autoPlay = true;
    game.turn = 'computer';
    const table = game.table;
    const cellData = game.cellData;
    const selected = [...game.selectedCells];
    const previousBot = game.AIContainer.getModelInstance(game.playerAgentModel);
    const listener = jest.fn();
    game.on('turnChanged', listener);

    refreshGameImplementation(game);

    expect(game.table).toBe(table);
    expect(game.cellData).toBe(cellData);
    expect(game.selectedCells).toEqual(selected);
    expect(game.turn).toBe('computer');
    expect(game.autoPlay).toBe(true);
    expect(game.winningLineLength).toBe(5);
    expect(game.checkWinner(selected, [])).toBe(true);
    expect(game.playerAgent.instance).not.toBe(previousBot);
    expect(game.playerAgent.instance.game).toBe(game);
    expect(game.computerAgent.instance.game).toBe(game);
    game.emit('turnChanged');
    expect(listener).toHaveBeenCalledTimes(1);
    jest.restoreAllMocks();
});

test('hot replacement migrates a previous rule and preserves size, target and autoplay', () => {
    const game = new CorrectFiveGame();
    game.soundOn = false;
    jest.spyOn(game, 'createSounds').mockImplementation(() => {});
    game.create();
    game.choose('8:8');
    game.rulesVersion = 'gomoku-rif-v1';
    game.winningLineLength = 4;
    game.autoPlay = true;
    refreshGameImplementation(game);
    expect(game.rulesVersion).toBe('caro-blocked-custom-v3');
    expect(game.winningLineLength).toBe(4);
    expect(game.openingPhase).toBe('complete');
    expect(game.selectedCells).toEqual([]);
    expect(game.autoPlay).toBe(true);
    jest.restoreAllMocks();
});

test('hot replacement of the automatic Swap2 version starts ordinary play without inheriting swapped ownership', () => {
    const game = new CorrectFiveGame();
    jest.spyOn(game, 'createSounds').mockImplementation(() => {});
    game.init({size:2,winningLineLength:5,openingRule:'swap2',soundOn:false});
    game.create();
    ['8:8','9:8','8:9'].forEach(cell => game.playerSelect(cell));
    game.resolveOpeningChoice('black');
    expect(game.colors.player).toBe('white');
    // These fields were absent on the older live singleton, including its whitelist.
    delete game.openingRule;
    game.init_list = game.init_list.filter(key => key !== 'openingRule');
    game.rulesVersion = 'caro-blocked-swap2-v1';
    refreshGameImplementation(game);
    expect(game.openingRule).toBe('standard');
    expect(game.selectedCells).toEqual([]);
    expect(game.colors).toEqual({player:'black',computer:'white'});
    expect(game.turn).toBe('player');
    expect(game.playerSelect('8:8')).toBe(5);
    expect(game.cellData['8:8'].label).toBe('x');
    jest.restoreAllMocks();
});
