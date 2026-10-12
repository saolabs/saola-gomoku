import CorrectFiveGame from "./CorrectFiveGame";
import AIContainer from "./AIContainer";

// Keep the same live game when webpack replaces the rules or bot modules.
export function refreshGameImplementation(game) {
    Object.setPrototypeOf(game, CorrectFiveGame.prototype);
    if (!game.init_list.includes('openingRule')) game.init_list.push('openingRule');
    game.AIContainer = new AIContainer(game);
    game.playerAgent = { model: null, instance: null };
    game.computerAgent = { model: null, instance: null };
    game.setPlayerAgentModel(game.playerAgentModel);
    game.setComputerAgentModel(game.computerAgentModel);
    // Recover the earliest winner when upgrading the mistaken exact-N rule.
    if (['caro-blocked-swap2-v2', 'caro-blocked-custom-v2'].includes(game.rulesVersion)) {
        game.configureBoard(game.size, game.winningLineLength);
        game.reconcileWindowWinner();
        game.emit('turnChanged');
    } else if (!['caro-blocked-swap2-v3', 'caro-blocked-custom-v3'].includes(game.rulesVersion)) {
        const autoPlay = game.autoPlay;
        game.init({ size: game.size, winningLineLength: game.winningLineLength, level: game.level, soundOn: game.soundOn,
            openingRule: game.openingRule === 'swap2' ? 'swap2' : 'standard' });
        game.create();
        game.gameStart();
        game.autoPlay = autoPlay;
        game.emit('turnChanged');
    }
    game.rulesMode = game.rulesVersion === 'caro-blocked-custom-v3' ? 'custom' : 'swap2';
}

export const Caro = (module.hot && module.hot.data && module.hot.data.game) || new CorrectFiveGame();

if (module.hot) {
    if (module.hot.data && module.hot.data.game) refreshGameImplementation(Caro);
    module.hot.accept(["./CorrectFiveGame", "./AIContainer"], () => {
        refreshGameImplementation(Caro);
    });
    module.hot.dispose(data => { data.game = Caro; });
}

export default Caro;
