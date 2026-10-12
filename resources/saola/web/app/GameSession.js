import CorrectFiveGame from './game/core/CorrectFiveGame';
import LS from './game/core/LS';
import { analyzePosition } from './game/core/GomokuStrategy';

const active = game => ['ready', 'playing'].includes(game.gameStatus);
const errors = ['AI chưa tìm được nước đi. Hãy thử gợi ý hoặc tạo ván mới.', 'Ván đã kết thúc.', 'Chưa đến lượt của bạn.', 'Đang bật tự động.', 'Ô hoặc lựa chọn không hợp lệ.'];

/** UI adapter only. All rules, moves, scoring and bot searches belong to the imported engine. */
export class GameSession {
  constructor(onChange, { delay = 350, restartDelay = 2400 } = {}) {
    this.onChange = onChange;
    this.delay = delay;
    this.restartDelay = restartDelay;
    this.timer = null;
    this.hintTimer = null;
    this.paused = false;
    this.message = '';
    this.hints = [];
    this.game = new CorrectFiveGame();
    this.game.setGameMode('ai', 'Người 1', 'Người 2');
    this.game.setStorageKey('saola-gomoku-options');
    let saved = {};
    try { saved = LS.get(this.game.getStorageKey()) || {}; } catch { /* discard invalid options */ }
    const models = this.game.getAIModels();
    const options = { size: 2, level: 1, winningLineLength: 5, openingRule: 'standard', soundOn: true, ...saved };
    for (const key of ['playerAgentModel', 'computerAgentModel']) {
      if (options[key] && !models[options[key]]) delete options[key];
    }
    this.game.init(options);
    this.game.create();
    this.game.gameStart();
  }

  humanTurn() {
    return active(this.game) && !this.game.autoPlay && (this.game.gameMode === 'twoPlayer' || this.game.turn === 'player');
  }

  snapshot() {
    const g = this.game;
    const d = g.getData();
    const first = g.gameMode === 'ai' ? 'Bạn' : g.player1Name;
    const second = g.gameMode === 'ai' ? 'Máy' : g.player2Name;
    const actor = g.turn === g.getFirstActor() ? first : second;
    const ended = !active(g);
    const waiting = this.timer !== null && !ended;
    const mark = d.currentColor === 'black' ? 'X' : 'O';
    let headline = waiting ? `${actor} đang suy nghĩ…` : `Lượt của ${actor}`;
    if (ended) headline = d.status === 'draw' ? 'Ván cờ hòa' : `${d.winner === g.getFirstActor() ? first : second} chiến thắng!`;
    let instruction = `Đặt quân ${mark} vào một ô trống.`;
    if (d.opening.phase === 'placeThree') instruction = `Swap2 · Đặt 3 quân X → O → X (${d.opening.count}/3). Tiếp theo: ${mark}.`;
    if (d.opening.phase === 'placeTwo') instruction = `Swap2 · Đặt thêm O → X (${d.opening.count}/2). Tiếp theo: ${mark}.`;
    if (d.opening.needsChoice) instruction = 'Swap2 · Chọn màu của bạn để tiếp tục.';
    if (ended) instruction = 'Tạo ván mới để chơi tiếp.';
    const last = g.selectedCells.at(-1);
    const allowed = this.humanTurn() && !d.opening.needsChoice;
    const cells = Object.entries(g.cellData).map(([coord, cell]) => ({
      coord, label: cell.label.toUpperCase(),
      group: `cell ${cell.group} ${coord === last ? 'last' : ''} ${this.hints.includes(coord) ? 'hint' : ''}`,
      disabled: !allowed || !!cell.label,
      aria: `Cột ${cell.position.x}, hàng ${cell.position.y}${cell.label ? ', quân ' + cell.label : ', ô trống'}`,
    }));
    // Engine inserts cellData row by row; explicit sort keeps the adapter independent of that order.
    cells.sort((a, b) => {
      const [ax, ay] = a.coord.split(':').map(Number), [bx, by] = b.coord.split(':').map(Number);
      return ay - by || ax - bx;
    });
    const counters = d.playData;
    return {
      ...d, cells, headline, instruction, first, second, ended, waiting,
      canAct: this.humanTurn(), canChoose: this.humanTurn() && d.opening.needsChoice,
      canExtend: this.humanTurn() && d.opening.canExtend,
      canDraw: this.humanTurn() && d.opening.phase === 'complete' && !d.drawOffer,
      hasDrawOffer: !!d.drawOffer && d.gameMode === 'twoPlayer',
      message: this.message, moves: g.selectedCells.length, last: last || '—',
      boardStyle: `grid-template-columns: repeat(${g.column}, minmax(0, 1fr)); --cells: ${g.column}`,
      firstMark: d.colors[g.getFirstActor()] === 'white' ? 'O' : 'X',
      secondMark: d.colors[g.getSecondActor()] === 'black' ? 'X' : 'O',
      firstScore: g.gameMode === 'ai' ? counters.player_count : counters.player1_count,
      secondScore: g.gameMode === 'ai' ? counters.computer_count : counters.player2_count,
      models: Object.values(g.getAIModels()).map(m => ({ name: m.name, description: m.description })),
    };
  }

  publish() { this.onChange(this.snapshot()); }
  cancel() {
    clearTimeout(this.timer); clearTimeout(this.hintTimer);
    this.timer = this.hintTimer = null;
    this.hints = [];
  }
  pause() { this.paused = true; this.cancel(); }
  resume() { this.paused = false; this.plan(); this.publish(); }
  destroy() { this.pause(); this.onChange = () => {}; }

  plan() {
    clearTimeout(this.timer); this.timer = null;
    if (this.paused) return;
    if (!active(this.game)) {
      if (this.game.autoPlay) this.timer = setTimeout(() => {
        this.timer = null;
        this.game.clear(); this.game.gameStart(); this.message = ''; this.hints = [];
        this.plan(); this.publish();
      }, this.restartDelay);
      return;
    }
    if (!this.game.autoPlay && (this.game.gameMode !== 'ai' || this.game.turn !== 'computer')) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.paused || !active(this.game)) return;
      if (!this.game.autoPlay && (this.game.gameMode !== 'ai' || this.game.turn !== 'computer')) return;
      this.complete(this.game.auto());
    }, this.delay);
  }

  complete(result) {
    this.hints = [];
    if (result !== 5) {
      this.message = errors[result] || errors[0];
      // Pause automation on failure so a broken AI cannot loop forever.
      this.game.autoPlay = false;
      clearTimeout(this.timer); this.timer = null;
    } else {
      this.message = '';
      if (!active(this.game)) this.game.playSound(this.game.gameStatus === 'draw' ? 'full' : this.game.gameStatus === 'lose' ? 'lose' : 'win');
      this.plan();
    }
    this.publish();
    return result;
  }

  select(coord) {
    if (!this.humanTurn()) return;
    return this.complete(this.game.playerSelect(coord));
  }
  openingChoice(choice) {
    if (!this.humanTurn()) return;
    return this.complete(this.game.resolveOpeningChoice(choice));
  }
  reset() {
    this.cancel(); this.message = '';
    this.game.reset(); this.game.gameStart();
    this.plan(); this.publish();
  }
  configure(options) {
    this.cancel(); this.message = '';
    this.game.setGameMode(options.gameMode === 'twoPlayer' ? 'twoPlayer' : 'ai', options.player1Name.trim() || 'Người 1', options.player2Name.trim() || 'Người 2');
    this.game.init({ size: Number(options.size), level: Number(options.level), winningLineLength: Number(options.winningLineLength), openingRule: options.openingRule, playerAgentModel: options.playerAgentModel, computerAgentModel: options.computerAgentModel, soundOn: this.game.soundOn });
    this.game.create(); this.game.gameStart(); this.plan(); this.publish();
  }
  toggleAuto() {
    if (this.game.gameMode !== 'ai') return;
    this.game.autoPlay = !this.game.autoPlay;
    this.message = ''; this.hints = [];
    this.plan(); this.publish();
  }
  hint() {
    if (!this.humanTurn()) return;
    clearTimeout(this.hintTimer);
    this.hints = this.game.suggest().filter(coord => this.game.checkCellAvailable(coord));
    this.message = this.hints.length ? 'Các ô màu xanh lá là nước đi được bot đề xuất.' : 'Hãy chọn màu để tiếp tục khai cuộc.';
    this.publish();
    this.hintTimer = setTimeout(() => { this.hints = []; this.message = ''; this.hintTimer = null; this.publish(); }, 2200);
  }
  resign() {
    if (!this.humanTurn()) return;
    this.cancel(); return this.complete(this.game.resign());
  }
  offerDraw() {
    if (!this.humanTurn() || this.game.offerDraw() !== 5) return;
    if (this.game.gameMode === 'ai') {
      const g = this.game;
      const mine = analyzePosition(g, g.computerCells, g.playerCells).score;
      const other = analyzePosition(g, g.playerCells, g.computerCells).score;
      const accept = Math.abs(mine - other) < 30;
      this.respondDraw(accept);
      if (!accept) { this.message = 'Máy từ chối đề nghị hòa. Ván tiếp tục.'; this.publish(); }
    } else this.publish();
  }
  respondDraw(accept) {
    if (this.game.autoPlay || !this.game.drawOffer) return;
    const actor = this.game.drawOffer === this.game.getFirstActor() ? this.game.getSecondActor() : this.game.getFirstActor();
    return this.complete(this.game.respondDraw(accept, actor));
  }
  toggleSound() {
    this.game.soundOn = !this.game.soundOn;
    LS.set(this.game.getStorageKey(), { ...LS.get(this.game.getStorageKey()), soundOn: this.game.soundOn });
    this.publish();
  }
  resetScores() {
    for (const key of ['player_count', 'computer_count', 'player1_count', 'player2_count']) this.game.updateCount(key, 0);
    this.publish();
  }
}
