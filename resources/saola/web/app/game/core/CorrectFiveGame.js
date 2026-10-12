import LS from './LS';
import { EventDispatcher } from '../common/event-service';
import AIContainer from './AIContainer';
import BOT_Origin from '../models/BOT_Origin';
import { dualLoop, testLoopPerformance } from './utils';
import { analyzePosition, findStrategicMoves } from './GomokuStrategy';
const isNumber = (value) => {
    return typeof value === 'number' && !isNaN(value);
}
const getType = (obj) => {
    var t = 'null';
    if (typeof obj === 'object') {
        if (obj === null) {
            t = 'null';
        } else if (obj.constructor === FormData) {
            t = 'formdata';
        } else if (obj.constructor === Array) {
            t = 'array';
        } else if (obj.constructor === Object) {
            t = 'object';
        } else if (obj.constructor === Number) {
            t = 'number';
        } else {
            t = 'object';
        }
    } else {
        t = typeof obj;
    }
    return t;
};

/**
 * Class Caro - Xử lý logic trò chơi Cờ Caro
 * Quản lý trạng thái game, luật chơi, và AI
 */
class CorrectFiveGame extends EventDispatcher {
    // Các thuộc tính cơ bản của game
    /**
     * @type {AIContainer}
     */
    AIContainer = null;
    /**
     * Agent người chơi
     * @type {{model: string, instance: BOT_Origin}}
     */
    playerAgent = {
        model: null,
        instance: null
    };
    /**
     * Agent máy tính
     * @type {{model: string, instance: BOT_Origin}}
     */
    computerAgent = {
        model: null,
        instance: null
    };
    playerAgentModel = BOT_Origin.NAME;
    computerAgentModel = BOT_Origin.NAME;
    /**
     * Selector cho DOM
     * @type {string}
     */
    selector = ""; // Selector cho DOM

    column = 0; // Số cột của bảng
    row = 0; // Số hàng của bảng
    totalCell = 0; // Tổng số ô trên bảng
    winningLineLength = 5; // Đoạn N quân; chỉ quân đối thủ ở hai đầu đoạn mới chặn thắng.
    rulesVersion = 'caro-blocked-custom-v3';
    rulesMode = 'custom';
    openingRule = 'standard';
    openingPhase = 'complete';
    openingCount = 0;
    blackCells = [];
    whiteCells = [];
    colors = {};
    drawOffer = null;
    winner = null;
    level = 1; // Cấp độ AI (1-3)
    turn = 'player'; // Lượt chơi hiện tại (player/computer)
    gameStatus = 'ready'; // Trạng thái game (ready/playing/win/lose/stop)

    // Thêm chế độ chơi 2 người
    gameMode = 'ai'; // Chế độ chơi: 'ai' (chơi với AI), 'twoPlayer' (chơi 2 người)
    player1Name = 'Player 1'; // Tên người chơi 1
    player2Name = 'Player 2'; // Tên người chơi 2
    currentPlayer = 'player1'; // Người chơi hiện tại: 'player1' hoặc 'player2'
    player1Cells = []; // Các ô người chơi 1 đã đánh
    player2Cells = []; // Các ô người chơi 2 đã đánh

    // Dữ liệu điểm số
    playData = {
        player_count: 0,
        computer_count: 0,
        player1_count: 0, // Số trận thắng của người chơi 1
        player2_count: 0  // Số trận thắng của người chơi 2
    };

    // Các kích thước bảng có thể chọn
    sizes = [5, 10, 15, 20, 25, 30];
    size = 2; // Kích thước mặc định (15x15)

    // Các mảng lưu trữ trạng thái game
    computerCells = []; // Các ô máy tính đã đánh
    playerCells = []; // Các ô người chơi đã đánh
    selectedCells = []; // Tất cả các ô đã đánh
    lines = []; // Danh sách các dãy ô có thể thắng
    borderCells = []; // Các ô ở biên
    autoPlay = false; // Chế độ tự động chơi
    arrFuncData = null; // Dữ liệu phụ trợ
    fatherLines = []; // Lưu trữ các dãy ô cha
    motherLines = []; // Lưu trữ các dãy ô mẹ

    // Các thuộc tính phụ trợ
    delayTime = 1000; // Thời gian delay của AI
    sounds = {}; // Các âm thanh trong game
    soundOn = true; // Bật/tắt âm thanh
    data = {}; // Dữ liệu phụ trợ
    table = []; // Ma trận bảng chơi
    cellData = {}; // Dữ liệu của từng ô
    /**
     * Map các dãy ô
     * @type {{[cell: string]: number[]}}
     */
    lineMap = [{}, {}, {}]; // Map các dãy ô
    lineCached = {}
    emptyCells = []; // Danh sách các ô trống
    init_list = [
        'selector',
        'column',
        'row',
        'winningLineLength',
        'openingRule',
        'level',
        'delayTime',
        'soundOn',
        'size',
        'playerAgentModel',
        'computerAgentModel'
    ]; // Danh sách các thuộc tính có thể khởi tạo
    storageKey = 'connect-five-game';
    showLog = false;
    constructor(args) {
        super();
        // Constructor có thể để trống hoặc chỉ chứa logic khởi tạo phức tạp
        this.AIContainer = new AIContainer(this);
        if (args) {
            this.init(args);
        } else {
            this.setPlayerAgentModel(this.playerAgentModel);
            this.setComputerAgentModel(this.computerAgentModel);
        }
    }

    setStorageKey(key) {
        this.storageKey = key;
    }

    getStorageKey() {
        return this.storageKey;
    }

    /**
     * Khởi tạo game với các tham số đầu vào
     * @param {Object} options - Các tham số khởi tạo
     */
    init(options) {
        this.emit('initing', options);
        if (!options || typeof options === 'undefined') return;
        for (const key in options) {
            const d = options[key];
            if (this.init_list.indexOf(key) >= 0) {
                const t = getType(d);
                const t2 = (typeof (this[key]) !== 'undefined') ? getType(this[key]) : "string";
                if ((t === 'array' && t2 === 'array') || (t === 'object' && t2 === 'object')) {
                    for (const k in d) {
                        const v = d[k];
                        this[key][k] = v;
                    }
                } else {
                    this[key] = d;
                }
            } else {
                this.data[key] = d;
            }
        }
        this.configureBoard(this.size, this.winningLineLength);
        this.level = [1, 2, 3].includes(this.level) ? this.level : 1;
        LS.set(this.storageKey, {
            ...options, size: this.size, column: this.column, row: this.row,
            winningLineLength: this.winningLineLength,
            openingRule: this.openingRule,
            soundOn: this.soundOn, rulesVersion: this.rulesVersion,
        });
        this.setPlayerAgentModel(this.playerAgentModel);
        this.setComputerAgentModel(this.computerAgentModel);
        this.emit('inited');
    }

    configureBoard(size, winningLineLength) {
        this.size = Number.isInteger(size) && size >= 0 && size < this.sizes.length ? size : 2;
        this.column = this.row = this.sizes[this.size];
        this.winningLineLength = [4, 5, 6].includes(winningLineLength) && winningLineLength <= this.column ? winningLineLength : 5;
        this.openingRule = this.openingRule === 'swap2' && this.column === 15 && this.winningLineLength === 5 ? 'swap2' : 'standard';
        this.rulesMode = this.openingRule === 'swap2' ? 'swap2' : 'custom';
        this.rulesVersion = this.rulesMode === 'swap2' ? 'caro-blocked-swap2-v3' : 'caro-blocked-custom-v3';
    }

    /**
     * Tạo bảng chơi mới
     * @param {number} column - Số cột
     * @param {number} row - Số hàng
     * @param {number} winningLineLength - Số ô cần để thắng
     */
    create(column, row, winningLineLength) {
        const requestedSize = column === row && this.sizes.includes(column) ? this.sizes.indexOf(column) : this.size;
        this.configureBoard(requestedSize, winningLineLength === undefined ? this.winningLineLength : winningLineLength);
        column = this.column;
        row = this.row;
        winningLineLength = this.winningLineLength;
        this.emit('creating', {column, row, winningLineLength});
        this.resetAll();
        this.winningLineLength = winningLineLength;
        this.column = column;
        this.row = row;
        this.totalCell = column * row;
        // Build the visible board together with the winning-line geometry.
        this.createLineList(column, row, winningLineLength, true, 0);
        this.lines[1] = this.createLineList(column, row, winningLineLength + 1, false, 1);
        this.lines[2] = this.createLineList(column, row, winningLineLength + 2, false, 2);
        this.emptyCells = Object.keys(this.cellData);
        this.createFatherLine();
        this.playData = this.getPlayData();
        this.updateRule(winningLineLength);
        this.createSounds();
        this.emit('created');
    }

    gameStart() {
        this.emit('starting');
        // Load dữ liệu học máy khi bắt đầu game mới
        if (this.playerAgent.instance) {
            this.playerAgent.instance.startGame();
        }
        if (this.computerAgent.instance) {
            this.computerAgent.instance.startGame();
        }
        this.emit('started');
    }

    gameOver() {
        this.emit('overing');
        // Lưu dữ liệu học máy khi kết thúc game
        const winner = this.winner || (this.gameStatus === 'win' ? 'player' :
            this.gameStatus === 'lose' ? 'computer' : null);
        if (this.playerAgent.instance) {
            this.playerAgent.instance.endGame(winner);
        }
        if (this.computerAgent.instance) {
            this.computerAgent.instance.endGame(winner);
        }
        this.emit('over', {winner});
    }

    createSounds() {
        const soundData = {
            win: './sounds/win.wav',
            shoot: './sounds/shoot.mp3',
            lose: './sounds/lose.mp3',
            full: './sounds/full-cell.wav',
            rule: './sounds/rule-' + this.winningLineLength + '.mp3',
            fail: './sounds/fail.mp3',
            success: './sounds/success.mp3',
            bad: './sounds/bad.mp3',
            wrong: './sounds/wrong.mp3',
        };

        soundData['rule' + this.winningLineLength] = './sounds/rule-' + this.winningLineLength + '.mp3';
        for (const sound in soundData) {
            const path = soundData[sound];
            const audio = new Audio(path);
            audio.setAttribute('crossorigin', 'anonymous');
            this.sounds[sound] = audio;
        }
    }

    playSound(name) {
        if (typeof this.sounds[name] !== 'undefined') {
            if (this.soundOn) {
                this.sounds[name].play();
            }
        }
    }

    getGameStyleSheet() {
        const w = this.sizes[this.size];
        const h = this.sizes[this.size];
        const s = h > w ? h : w;
        const k = s <= 15 ? 0.65 : (s <= 25 ? 0.52 : 0.38);
        const cs = parseInt(600 / s) - 2;
        const fs = parseInt(cs * k);
        return {
            width: cs + 'px',
            height: cs + 'px',
            fontSise: fs + 'px'
        };
    }

    /**
     * Cập nhật luật chơi
     * @param {number} winningLineLength - Số ô cần để thắng
     */
    updateRule(winningLineLength) {
        const col = document.getElementsByClassName('cell-of-line');
        if (col.length) {
            for (let i = 0; i < col.length; i++) {
                col[i].innerHTML = winningLineLength;
            }
        }
    }

    /**
     * Tạo danh sách các dãy ô có thể thắng
     * @param {number} column - Số cột
     * @param {number} row - Số hàng
     * @param {number} winningLineLength - Số ô cần để thắng
     * @param {boolean} isLine - Có phải là dãy chính không
     * @param {number} lineType - Loại dãy ô
     * @returns {Array} Danh sách các dãy ô
     */
    createLineList(column, row, winningLineLength, isLine, lineType = 0) {
        if (!column || !row || !winningLineLength) {
            return [];
        }
        column = column || this.sizes[this.size];
        row = row || this.sizes[this.size];

        const lines = [];
        const table = [];

        try {
            for (let i = 1; i <= row; i++) {
                for (let j = 1; j <= column; j++) {
                    const coord = `${j}:${i}`;
                    if (isLine) {
                        this.cellData[coord] = {
                            label: '',
                            group: '',
                            position: {
                                x: j,
                                y: i
                            }
                        };
                        if (typeof table[i-1] === 'undefined') {
                            table[i-1] = [];
                        }
                        if (table[i-1].indexOf(coord) === -1) {
                            table[i-1].push(coord);
                        }
                    }
                    
                    // line chính

                    let w = false,
                        h = false;

                    if (column - j >= winningLineLength - 1) {
                        w = true;
                        const line = [];
                        for (let k = 0; k < winningLineLength; k++) {
                            line.push(`${j + k}:${i}`);
                        }

                        lines.push(line);
                        if (isNumber(lineType)) {
                            let lineIndex = lines.length - 1;
                            line.forEach(cell => {
                                if (typeof this.lineMap[lineType][cell] === 'undefined') {
                                    this.lineMap[lineType][cell] = [];
                                }
                                if (this.lineMap[lineType][cell].indexOf(lineIndex) === -1) {
                                    this.lineMap[lineType][cell].push(lineIndex);
                                }
                            });
                        }
                    }

                    if (row - i >= winningLineLength - 1) {
                        h = true;
                        const l = [];
                        for (let k = 0; k < winningLineLength; k++) {
                            l.push(`${j}:${i + k}`);
                        }
                        lines.push(l);
                        if (isNumber(lineType)) {
                            let lineIndex = lines.length - 1;
                            l.forEach(cell => {
                                if (typeof this.lineMap[lineType][cell] === 'undefined') {
                                    this.lineMap[lineType][cell] = [];
                                }
                                if (this.lineMap[lineType][cell].indexOf(lineIndex) === -1) {
                                    this.lineMap[lineType][cell].push(lineIndex);
                                }
                            });
                        }
                    }

                    if (w && h) {
                        const l = [];
                        for (let k = 0; k < winningLineLength; k++) {
                            l.push(`${j + k}:${i + k}`);
                        }
                        lines.push(l);
                        if (isNumber(lineType)) {
                            let lineIndex = lines.length - 1;
                            l.forEach(cell => {
                                if (typeof this.lineMap[lineType][cell] === 'undefined') {
                                    this.lineMap[lineType][cell] = [];
                                }
                                if (this.lineMap[lineType][cell].indexOf(lineIndex) === -1) {
                                    this.lineMap[lineType][cell].push(lineIndex);
                                }
                            });
                        }
                    }

                    if (j >= winningLineLength && row - i >= winningLineLength - 1) {
                        const l = [];
                        for (let k = 0; k < winningLineLength; k++) {
                            l.push(`${j - k}:${i + k}`);
                        }
                        lines.push(l);
                        if (isNumber(lineType)) {
                            let lineIndex = lines.length - 1;
                            l.forEach(cell => {
                                if (typeof this.lineMap[lineType][cell] === 'undefined') {
                                    this.lineMap[lineType][cell] = [];
                                }
                                if (this.lineMap[lineType][cell].indexOf(lineIndex) === -1) {
                                    this.lineMap[lineType][cell].push(lineIndex);
                                }
                            });
                        }
                    }

                    if (isLine && (i === 1 || i === row || j === 1 || j === column) && this.borderCells.indexOf(coord) === -1) {
                        this.borderCells.push(coord);
                    }

                }
            }


            if (isLine === true) {
                this.lines[0] = lines;
                this.table = table;
            }
        } catch (error) {
            console.error('Error in createLineList:', error);
            return [];
        }

        return lines;
    }

    createFatherLine() {
        this.fatherLines = this.lines[0].map((line, index) => this.getFatherLineByLineIndex(index));
    }

    /**
     * Lấy danh sách các model AI
     * @returns {{[name:string]:{name: string, version: string, author: string, description: string, rules: string[], examples: string[], parameters: string[], results: string[], author: string, copyright: string, license: string, website: string, model: BaseModel, instance: BaseModel}}} Danh sách các model AI
     */
    getAIModels() {
        return this.AIContainer.getModels();
    }

    /**
     * Thiết lập model AI
     * @param {string} name - Tên model AI
     */
    setPlayerAgentModel(name) {
        const AIModeInstance = this.AIContainer.getModelInstance(name);
        if (AIModeInstance) {
            this.playerAgent.model = name;
            this.playerAgent.instance = AIModeInstance;
        }
    }

    setComputerAgentModel(name) {
        const AIModeInstance = this.AIContainer.getModelInstance(name);
        if (AIModeInstance) {
            this.computerAgent.model = name;
            this.computerAgent.instance = AIModeInstance;
        }
    }

    arrMatch(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        const a1 = arr1.sort();
        const a2 = arr2.sort();
        for (let i = 0; i < a1.length; i++) {
            if (a1[i] !== a2[i]) return false;
        }
        return true;
    }

    arrMergeUnique(arr1, arr2) {
        const a1 = arr1.slice(0);
        const a2 = arr2.slice(0);
        const result = [];
        for (const x of a1) {
            if (result.indexOf(x) === -1) {
                result.push(x);
            }
        }
        for (const y of a2) {
            if (result.indexOf(y) === -1) {
                result.push(y);
            }
        }
        return result;
    }
    uniqueArray(arr) {
        return [...new Set(arr)];
    }
    arrHasValue(arr, value) {
        const set = new Set(arr);
        return set.has(value);
    }
    arrRemove(arr, item) {
        const index = arr.indexOf(item);
        if (index !== -1) {
            arr.splice(index, 1);
        }
        return arr;
    }


    checkAvailableForList(type, lineIndex, cellList) {
        const line = this.lines[type][lineIndex];
        if (!line) return false;
        let result = true;
        dualLoop(line, (cell, index, stop, side) => {
            if (this.selectedCells.indexOf(cell) !== -1 && cellList.indexOf(cell) === -1) {
                result = false;
                return stop();
            }
        });
        return result;
    }

    /**
     * Lấy danh sách các dãy ô đã được cache
     * @param {number} type - Loại dãy ô
     * @param {string[]} cellList - Danh sách các ô
     * @param {number} cellNumber - Số ô cần để thắng
     * @returns {string[]} Danh sách các dãy ô
     */
    getCachedLines(type, cellList, cellNumber) {
        // Kiểm tra đầu vào
        if (!this.lines || !this.lines[type] || !cellList || !cellList.length) {
            return [];
        }

        // Tạo key cho cache
        const firstKey = `${type}|${cellList.join(',')}`;
        const finalKey = `${type}|${cellNumber}|${cellList.join(',')}`;

        // Kiểm tra cache
        if (this.lineCached[finalKey]) {
            return this.lineCached[finalKey];
        }

        // Khởi tạo biến
        const allLines = [];
        const rightLines = [];
        const leftLines = [];
        const rightCells = [];
        const leftCells = [...cellList];

        // Xử lý từ trái sang phải
        while (leftCells.length > 0) {
            const cell = leftCells.pop();
            rightCells.unshift(cell);

            // Xử lý bên phải
            const rightKey = `${type}|${rightCells.join(',')}`;
            if (this.lineCached[rightKey]) {
                dualLoop(this.lineCached[rightKey], (lineIndex) => {
                    if (!rightLines.includes(lineIndex)) {
                        rightLines.push(lineIndex);
                    }
                });
            } else {
                this.lineCached[rightKey] = [];
                const rightLine = this.lineMap[type][cell];
                if (rightLine) {
                    dualLoop(rightLine, (lineIndex) => {
                        if (!rightLines.includes(lineIndex)) {
                            rightLines.push(lineIndex);
                        }
                    });
                    this.lineCached[rightKey] = rightLines;
                }
            }

            // Xử lý bên trái
            const leftKey = `${type}|${leftCells.join(',')}`;
            if (this.lineCached[leftKey]) {
                dualLoop(this.lineCached[leftKey], (lineIndex) => {
                    if (!leftLines.includes(lineIndex)) {
                        leftLines.push(lineIndex);
                    }
                });
                break;
            }
        }

        // Kết hợp kết quả
        if (leftLines.length) {
            allLines.push(...leftLines);
        }
        if (rightLines.length) {
            dualLoop(rightLines, (lineIndex) => {
                if (!allLines.includes(lineIndex)) {
                    allLines.push(lineIndex);
                }
            });
        }

        // Lưu cache cho key đầu tiên
        this.lineCached[firstKey] = allLines;

        // Lọc theo số ô cần thiết
        const finalLines = [];
        for (const lineIndex of allLines) {
            const line = this.lines[type][lineIndex];
            let count = 0;
            dualLoop(line, (cell) => {
                if (cellList.includes(cell)) count++;
            });
            if (count === cellNumber) {
                finalLines.push(lineIndex);
            }
        }

        // Lưu cache cho key cuối cùng
        this.lineCached[finalKey] = finalLines;

        return finalLines;
    }

    getLinesByList2(type, cellList, cellNumber, checkAvailable) {
        const allLines = this.getCachedLines(type, cellList, cellNumber);
        if (checkAvailable) {
            let lineList2 = [];

            dualLoop(allLines, (lineIndex) => {
                if (this.checkAvailableForList(type, lineIndex, cellList)) {
                    lineList2.push(lineIndex);
                }
            });
            return lineList2;
        }
        else {
            return allLines;
        }
    }

    getLinesByList(type, cellList, cellNumber, checkAvailable) {
        if (!this.lines || !this.lines[type]) return [];
        const linelist = [];
        const stones = new Set(cellList);
        const occupied = checkAvailable ? new Set(this.selectedCells) : null;
        const visited = new Set();
        // Keep first-encounter order, but inspect every line only once, including
        // rejected lines. Membership must not scan the entire simulated board.
        dualLoop(cellList, cell => {
            dualLoop(this.lineMap[type][cell] || [], lineIndex => {
                if (visited.has(lineIndex)) return;
                visited.add(lineIndex);
                const line = this.lines[type][lineIndex];
                let count = 0;
                let blocked = false;
                for (const c of line) {
                    if (stones.has(c)) count++;
                    else if (occupied?.has(c)) blocked = true;
                }
                if (count === cellNumber && !blocked) linelist.push(lineIndex);
            });
        });
        if (this.showLog && this.turn === 'player') console.log('player getLinesByList count', linelist.length, type, cellList.length, checkAvailable, cellNumber);
        return linelist;
    }

    getLinesByListWithLimit(type, cellList, min, max, checkAvailable) {
        const lines = [];
        if (!this.lines || !this.lines[type]) {
            return lines;
        }
        const linelist = this.lines[type];
        for (let i = 0; i < linelist.length; i++) {
            let c = 0;
            const l = linelist[i];
            for (let j = 0; j < l.length; j++) {
                if (cellList.indexOf(l[j]) !== -1) c++;
            }
            if (c >= min && c <= max) {
                if (checkAvailable) {
                    if (this.checkAvailableForList(type, i, cellList)) lines.push(i);
                } else {
                    lines.push(i);
                }
            }
        }

        dualLoop(linelist, (line, lineIndex, stop) => {
            let c = 0;
            dualLoop(line, (cell) => {
                if (cellList.indexOf(cell) !== -1) c++;
            });
            if (c >= min && c <= max) {
                if (checkAvailable) {
                    if (this.checkAvailableForList(type, lineIndex, cellList)) lines.push(lineIndex);
                } else {
                    lines.push(lineIndex);
                }
            }
        });
        return lines;
    }

    getLinesForCells(type, lines, cells) {
        const list = [];
        dualLoop(lines, (lineIndex) => {
            const hi = lines[lineIndex];
            if (this.checkAvailableForList(type, lineIndex, cells)) list.push(hi);
        });
        return list;
    }

    /**
     * Reset game về trạng thái ban đầu
     */
    reset() {
        this.gameStatus = 'ready';
        
        // Reset theo chế độ chơi
        if (this.gameMode === 'twoPlayer') {
            this.currentPlayer = 'player1';
            this.turn = 'player1';
            this.player1Cells = [];
            this.player2Cells = [];
        } else {
            this.turn = 'player';
            this.currentPlayer = 'player';
            this.playerCells = [];
            this.computerCells = [];
        }
        
        this.playerCells = [];
        this.computerCells = [];
        this.player1Cells = [];
        this.player2Cells = [];
        this.autoPlay = false;
        this.openingPhase = this.rulesMode === 'custom' ? 'complete' : 'placeThree';
        this.openingCount = 0;
        this.blackCells = [];
        this.whiteCells = [];
        this.colors = {};
        if (this.rulesMode === 'custom') {
            const first = this.getFirstActor(), second = this.getSecondActor();
            this.colors = { [first]: 'black', [second]: 'white' };
            this.playerCells = this.player1Cells = this.blackCells;
            this.computerCells = this.player2Cells = this.whiteCells;
        }
        this.drawOffer = null;
        this.winner = null;
        this.selectedCells = [];
        this.emptyCells = Object.keys(this.cellData);
        this.lineCached = {};
        this.resetCell();
        
        // Reset dữ liệu học máy cho ván mới
        if (this.AI) {
            this.AI.currentGameMoves = [];
        }
    }

    /**
     * Reset hoàn toàn game
     */
    resetAll() {
        this.reset();
        this.lines = [];
        this.lineMap = [{}, {}, {}];
        this.cellData = {};
        this.emptyCells = [];
        this.borderCells = [];
    }

    /**
     * Reset dữ liệu các ô
     */
    resetCell() {
        Object.keys(this.cellData).forEach(index => {
            this.cellData[index]['label'] = '';
            this.cellData[index]['group'] = '';
        });
    }
    clear() {
        const autoPlay = this.autoPlay;
        this.reset();
        this.autoPlay = autoPlay;
    }

    /**
     * Lấy dữ liệu hiện tại của game
     * @returns {Object} Dữ liệu game
     */
    getData() {
        return {
            status: this.gameStatus,
            column: this.column,
            row: this.row,
            rulesVersion: this.rulesVersion,
            rulesMode: this.rulesMode,
            openingRule: this.openingRule,
            opening: this.getOpeningData(),
            colors: { ...this.colors },
            currentColor: this.getCurrentColor(),
            drawOffer: this.drawOffer,
            winner: this.winner,
            table: this.table,
            line: this.winningLineLength,
            size: this.size,
            cellData: this.cellData,
            turn: this.turn,
            currentPlayer: this.currentPlayer,
            gameMode: this.gameMode,
            player1Name: this.player1Name,
            player2Name: this.player2Name,
            autoPlay: this.autoPlay,
            level: this.level,
            soundOn: this.soundOn,
            delayTime: this.delayTime,
            playData: this.getPlayData(),
            AiModels: this.getAIModels(),
            playerAgentModel: this.playerAgentModel,
            computerAgentModel: this.computerAgentModel
        };
    }

    /**
     * Thiết lập chế độ chơi
     * @param {string} mode - Chế độ chơi: 'ai' hoặc 'twoPlayer'
     * @param {string} player1Name - Tên người chơi 1
     * @param {string} player2Name - Tên người chơi 2
     */
    setGameMode(mode, player1Name = 'Player 1', player2Name = 'Player 2') {
        this.gameMode = mode;
        this.player1Name = player1Name;
        this.player2Name = player2Name;
        
        if (mode === 'twoPlayer') {
            this.currentPlayer = 'player1';
            this.turn = 'player1';
            // Reset các ô đã đánh
            this.player1Cells = [];
            this.player2Cells = [];
        } else {
            this.turn = 'player';
            this.currentPlayer = 'player';
        }
        
        this.emit('gameModeChanged', { mode, player1Name, player2Name });
    }

    /**
     * Lấy tên người chơi hiện tại
     * @returns {string} Tên người chơi hiện tại
     */
    getCurrentPlayerName() {
        if (this.gameMode === 'twoPlayer') {
            return this.currentPlayer === 'player1' ? this.player1Name : this.player2Name;
        }
        return this.turn === 'player' ? 'Player' : 'Computer';
    }

    /**
     * Lấy danh sách ô của người chơi hiện tại
     * @returns {Array} Danh sách ô đã đánh
     */
    getCurrentPlayerCells() {
        if (this.gameMode === 'twoPlayer') {
            return this.currentPlayer === 'player1' ? this.player1Cells : this.player2Cells;
        }
        return this.turn === 'player' ? this.playerCells : this.computerCells;
    }

    /**
     * Lấy danh sách ô của đối thủ
     * @returns {Array} Danh sách ô đã đánh của đối thủ
     */
    getCompetitorCells() {
        if (this.gameMode === 'twoPlayer') {
            return this.currentPlayer === 'player1' ? this.player2Cells : this.player1Cells;
        }
        return this.turn === 'player' ? this.computerCells : this.playerCells;
    }

    /**
     * Chuyển lượt chơi
     */
    switchTurn() {
        if (this.openingPhase !== 'complete') return;
        this.turn = this.turn === this.getFirstActor() ? this.getSecondActor() : this.getFirstActor();
        this.currentPlayer = this.turn;
        this.drawOffer = null;
        this.emit('turnChanged', { currentPlayer: this.currentPlayer, turn: this.turn });
    }

    /**
     * Xử lý lượt chơi của người chơi (cả 2 chế độ)
     * @param {string} coord - Tọa độ ô được chọn (x:y)
     * @returns {number} Kết quả xử lý (1-5)
     */
    playerSelect(coord) {
        if (this.gameStatus !== 'ready' && this.gameStatus !== 'playing') return 1;
        
        // Kiểm tra lượt chơi
        if (this.gameMode === 'twoPlayer') {
            if (this.turn !== this.currentPlayer) return 2;
        } else {
            if (this.turn !== "player") return 2;
        }
        
        if (this.autoPlay) return 3;
        if (!this.checkCellAvailable(coord)) return 4;
        
        if (this.openingPhase !== 'complete') return this.placeOpeningStone(coord);
        const c = this.choose(coord);
        if (c === 5) {
            // Kiểm tra người thắng
            const currentCells = this.getCurrentPlayerCells();
            const competitorCells = this.getCompetitorCells();
            
            if (this.checkWinner(currentCells, competitorCells, 'win')) {
                this.gameStatus = 'win';
                this.winner = this.turn;
                
                // Cập nhật điểm số
                if (this.gameMode === 'twoPlayer') {
                    if (this.currentPlayer === 'player1') {
                        this.incCount('player1_count');
                    } else {
                        this.incCount('player2_count');
                    }
                } else {
                    this.incCount('player_count');
                }
                
                this.gameOver();
            }
            else if (this.checkFullCell()) {
                this.gameStatus = 'draw';
                this.gameOver();
            } else {
                // Chuyển lượt nếu game chưa kết thúc
                this.switchTurn();
            }
        }
        return c;
    }

    /**
     * Xử lý lượt chơi tự động (AI hoặc tự động)
     * @returns {number} Kết quả xử lý (0-1)
     */
    auto() {
        if (this.gameStatus !== 'ready' && this.gameStatus !== 'playing') return 1;
        if (this.openingPhase !== 'complete') {
            if (this.getOpeningData().needsChoice) return this.resolveOpeningChoice(this.getOpeningDecision());
            return this.placeOpeningStone(this.getOpeningMove());
        }
        try {
            const cc = this.turn === 'computer';
            const myList = this.getCurrentPlayerCells();
            const competitorList = this.getCompetitorCells();
            const suggestions = this.suggest(myList);
            const legal = (suggestions || []).filter(coord => this.checkCellAvailable(coord));
            if (!legal.length) return 0;
            const coord = legal[Math.floor(Math.random() * legal.length)];
            const c = this.choose(coord);
            if (c !== 5) return c;
            if (this.checkWinner(this.getCurrentPlayerCells(), competitorList, 'win')) {
                this.gameStatus = cc ? 'lose' : 'win';
                this.winner = this.turn;
                this.incCount(this.gameMode === 'twoPlayer' ? this.turn + '_count' : cc ? 'computer_count' : 'player_count');
                this.gameOver();
            } else if (this.checkFullCell()) {
                this.gameOver();
            } else {
                this.switchTurn();
            }
            return c;
        } catch (error) {
            console.warn(error);
            return 0;
        }
    }

    /**
     * Chọn và đánh một ô
     * @param {string} coord - Tọa độ ô được chọn
     * @returns {number} Kết quả xử lý (1-5)
     */
    choose(coord) {
        if (this.gameStatus !== 'ready' && this.gameStatus !== 'playing') return 1;
        if (!this.checkCellAvailable(coord)) return 4;
        if (this.openingPhase !== 'complete') return this.placeOpeningStone(coord);
        this.drawOffer = null;
        // Cập nhật danh sách ô đã đánh theo chế độ chơi
        if (this.gameMode === 'twoPlayer') {
            if (this.currentPlayer === 'player1') {
                this.player1Cells.push(coord);
            } else {
                this.player2Cells.push(coord);
            }
        } else {
            if (this.turn === 'player') {
                this.playerCells.push(coord);
            } else {
                this.computerCells.push(coord);
            }
        }

        this.selectedCells.push(coord);
        this.emptyCells = this.arrRemove(this.emptyCells, coord);
        const c = this.tick(coord);
        
        this.cellData[coord]['label'] = c;
        this.cellData[coord]['group'] = c.toLocaleLowerCase();
        let [x, y] = coord.split(':').map(Number);

        this.emit('choose', {coord, position:{x,y}, turn: this.turn, currentPlayer: this.currentPlayer});
        this.emit('pick', {coord, position:{x,y}, turn: this.turn, currentPlayer: this.currentPlayer});
        return 5;
    }

    tick() {
        const charc = this.getCurrentColor() === 'black' ? 'x' : 'o';
        if (this.soundOn) this.playSound('shoot');
        return charc;
    }

    /**
     * Kiểm tra người thắng
     * @param {Array} myCellList - Danh sách ô của người chơi hiện tại
     * @returns {boolean} Có thắng hay không
     */
    checkWinner(myCellList, competitorCellList = [], mark = '') {
        const opponents = new Set(competitorCellList);
        const lineIndices = this.getLinesByList(0, myCellList, this.winningLineLength);
        for (const lineIndex of lineIndices) {
            const line = this.lines[0][lineIndex];
            if (line.some(cell => opponents.has(cell))) continue;
            const [before, after] = this.getLineEndpoints(line);
            // Evaluate this N-cell window. Friendly stones outside it do not block.
            // An opponent at either endpoint blocks a win; board edges do not.
            if (opponents.has(before) || opponents.has(after)) continue;
            if (mark) this.addLineGroup(0, lineIndex, mark);
            return true;
        }
        return false;
    }

    // Upgrade the exact-N rule without discarding a live game's move order.
    reconcileWindowWinner() {
        if (this.openingPhase !== 'complete') return false;
        const first = this.getFirstActor(), second = this.getSecondActor();
        const firstCells = this.gameMode === 'twoPlayer' ? this.player1Cells : this.playerCells;
        const secondCells = this.gameMode === 'twoPlayer' ? this.player2Cells : this.computerCells;
        const firstSet = new Set(firstCells), secondSet = new Set(secondCells);
        const prefixes = { [first]: [], [second]: [] };
        for (let i = 0; i < this.selectedCells.length; i++) {
            const coord = this.selectedCells[i];
            const actor = firstSet.has(coord) ? first : secondSet.has(coord) ? second : null;
            if (!actor) continue;
            const other = actor === first ? second : first;
            prefixes[actor].push(coord);
            if (!this.checkWinner(prefixes[actor], prefixes[other])) continue;
            const previousWinner = ['win', 'lose'].includes(this.gameStatus) ? this.winner : null;
            if (previousWinner !== actor) {
                if (previousWinner) {
                    const key = previousWinner + '_count';
                    this.updateCount(key, Math.max(0, (this.getPlayData()[key] || 0) - 1));
                }
                this.incCount(actor + '_count');
            }
            this.selectedCells.splice(i + 1);
            const kept = new Set(this.selectedCells);
            for (const cells of new Set([this.blackCells, this.whiteCells, this.playerCells,
                this.computerCells, this.player1Cells, this.player2Cells])) {
                const valid = cells.filter(cell => kept.has(cell));
                cells.splice(0, cells.length, ...valid);
            }
            for (const [cell, data] of Object.entries(this.cellData)) {
                if (!kept.has(cell)) data.label = '';
                data.group = data.label;
            }
            this.emptyCells = Object.keys(this.cellData).filter(cell => !kept.has(cell));
            this.lineCached = {};
            this.winner = this.turn = this.currentPlayer = actor;
            this.gameStatus = actor === 'computer' ? 'lose' : 'win';
            this.autoPlay = false;
            this.drawOffer = null;
            this.checkWinner(prefixes[actor], prefixes[other], 'win');
            this.emit('turnChanged');
            return true;
        }
        return false;
    }

    getLineEndpoints(line) {
        const [x, y] = line[0].split(':').map(Number);
        const [nextX, nextY] = line[1].split(':').map(Number);
        const [lastX, lastY] = line[line.length - 1].split(':').map(Number);
        const dx = nextX - x;
        const dy = nextY - y;
        return [`${x - dx}:${y - dy}`, `${lastX + dx}:${lastY + dy}`];
    }

    // Các nước thắng ngay, dùng cùng luật với trọng tài và không sửa trạng thái bàn.
    getWinningMoves(cells, opponents) {
        return analyzePosition(this, cells, opponents).winningMoves;
    }

    getTacticalMoves(cells, opponents) {
        const winningMoves = this.getWinningMoves(cells, opponents);
        if (winningMoves.length) return winningMoves;
        return this.getDefensiveMoves(cells, opponents);
    }

    // Consider gaps AND endpoints, then verify every remaining opponent threat.
    getDefensiveMoves(cells, opponents) {
        const threats = analyzePosition(this, opponents, cells);
        if (!threats.winningMoves.length) return [];
        let fewestThreats = Infinity;
        let bestMoves = [];
        for (const move of threats.blockingMoves) {
            const remaining = this.getWinningMoves(opponents, [...cells, move]).length;
            if (remaining < fewestThreats) {
                fewestThreats = remaining;
                bestMoves = [move];
            } else if (remaining === fewestThreats) bestMoves.push(move);
        }
        return bestMoves;
    }

    hasUnstoppableThreat(cells, opponents) {
        if (this.getWinningMoves(opponents, cells).length) return false;
        const replies = this.getDefensiveMoves(opponents, cells);
        return replies.length > 0 && replies.every(reply =>
            this.getWinningMoves(cells, [...opponents, reply]).length > 0);
    }

    getStrategicMoves(cells, opponents, level = this.level, style = 'balanced', extraCandidates = []) {
        return findStrategicMoves(this, cells, opponents, level, style, extraCandidates);
    }

    getFirstActor() { return this.gameMode === 'twoPlayer' ? 'player1' : 'player'; }
    getSecondActor() { return this.gameMode === 'twoPlayer' ? 'player2' : 'computer'; }

    setActor(actor) {
        this.turn = this.currentPlayer = actor;
        this.emit('turnChanged', { turn: actor, currentPlayer: actor });
    }

    getCurrentColor() {
        if (this.openingPhase === 'placeThree') return ['black', 'white', 'black'][this.openingCount];
        if (this.openingPhase === 'placeTwo') return ['white', 'black'][this.openingCount];
        return this.colors[this.turn] || null;
    }

    getOpeningData() {
        return {
            phase: this.openingPhase,
            count: this.openingCount,
            actor: this.turn,
            actorName: this.getCurrentPlayerName(),
            color: this.getCurrentColor(),
            needsChoice: ['chooseSecond', 'chooseFirst'].includes(this.openingPhase),
            canExtend: this.openingPhase === 'chooseSecond',
        };
    }

    placeOpeningStone(coord) {
        if (!['ready', 'playing'].includes(this.gameStatus)) return 1;
        if (!['placeThree', 'placeTwo'].includes(this.openingPhase)) return 2;
        if (!this.checkCellAvailable(coord)) return 4;
        const color = this.getCurrentColor();
        (color === 'black' ? this.blackCells : this.whiteCells).push(coord);
        this.selectedCells.push(coord);
        this.emptyCells = this.emptyCells.filter(cell => cell !== coord);
        this.cellData[coord].label = color === 'black' ? 'x' : 'o';
        this.cellData[coord].group = this.cellData[coord].label;
        if (this.soundOn) this.playSound('shoot');
        const [x, y] = coord.split(':').map(Number);
        const event = { coord, position: { x, y }, turn: this.turn, currentPlayer: this.currentPlayer, color, opening: true };
        this.emit('choose', event);
        this.emit('pick', event);
        this.openingCount++;
        if (this.openingPhase === 'placeThree' && this.openingCount === 3) {
            this.openingPhase = 'chooseSecond';
            this.setActor(this.getSecondActor());
        } else if (this.openingPhase === 'placeTwo' && this.openingCount === 2) {
            this.openingPhase = 'chooseFirst';
            this.setActor(this.getFirstActor());
        } else this.emit('turnChanged', this.getOpeningData());
        return 5;
    }

    resolveOpeningChoice(choice) {
        if (!['ready', 'playing'].includes(this.gameStatus)) return 1;
        if (!this.getOpeningData().needsChoice) return 2;
        if (choice === 'extend' && this.openingPhase === 'chooseSecond') {
            this.openingPhase = 'placeTwo';
            this.openingCount = 0;
            this.emit('turnChanged', this.getOpeningData());
            return 5;
        }
        if (!['black', 'white'].includes(choice)) return 4;
        const chooser = this.turn;
        const other = chooser === this.getFirstActor() ? this.getSecondActor() : this.getFirstActor();
        this.colors = { [chooser]: choice, [other]: choice === 'black' ? 'white' : 'black' };
        const firstCells = this.colors[this.getFirstActor()] === 'black' ? this.blackCells : this.whiteCells;
        const secondCells = this.colors[this.getSecondActor()] === 'black' ? this.blackCells : this.whiteCells;
        if (this.gameMode === 'twoPlayer') {
            this.player1Cells = firstCells;
            this.player2Cells = secondCells;
        } else {
            this.playerCells = firstCells;
            this.computerCells = secondCells;
        }
        this.openingPhase = 'complete';
        this.gameStatus = 'playing';
        this.setActor(this.colors[this.getFirstActor()] === 'white' ? this.getFirstActor() : this.getSecondActor());
        return 5;
    }

    getOpeningMove() {
        // Swap2 permits free placements. Vary both location and shape around
        // the center rather than replaying one hard-coded B-W-B sequence.
        const anchor = this.selectedCells[0] || `${Math.ceil(this.column / 2)}:${Math.ceil(this.row / 2)}`;
        const [ax, ay] = anchor.split(':').map(Number);
        const radius = this.selectedCells.length ? 2 : 1;
        const empty = this.getEmptyCells();
        const nearby = empty.filter(cell => {
            const [x, y] = cell.split(':').map(Number);
            return Math.abs(x - ax) <= radius && Math.abs(y - ay) <= radius;
        });
        const choices = nearby.length ? nearby : empty;
        return choices[Math.floor(Math.random() * choices.length)];
    }

    getOpeningDecision() {
        const black = analyzePosition(this, this.blackCells, this.whiteCells).score;
        const white = analyzePosition(this, this.whiteCells, this.blackCells).score;
        return black > white ? 'black' : 'white';
    }

    resign() {
        if (!['ready', 'playing'].includes(this.gameStatus)) return 1;
        const winner = this.turn === this.getFirstActor() ? this.getSecondActor() : this.getFirstActor();
        this.gameStatus = this.gameMode === 'ai' && winner === 'computer' ? 'lose' : 'win';
        this.incCount(winner + '_count');
        this.winner = winner;
        this.gameOver();
        return 5;
    }

    offerDraw() {
        if (this.openingPhase !== 'complete' || !['ready', 'playing'].includes(this.gameStatus)) return 1;
        this.drawOffer = this.turn;
        return 5;
    }

    respondDraw(accept, actor) {
        if (!this.drawOffer || actor !== (this.drawOffer === this.getFirstActor() ? this.getSecondActor() : this.getFirstActor())) return 2;
        this.drawOffer = null;
        if (accept) {
            this.gameStatus = 'draw';
            this.gameOver();
        }
        return 5;
    }

    getEmptyCellList() {
        return this.emptyCells;
    }
    getEmptyCells(list, banlist) {
        const cells = list || this.emptyCells;
        const ban = banlist || [];
        const results = [];
        if (cells.length) {
            for (const x of cells) {
                if (ban.indexOf(x) === -1 && this.checkCellAvailable(x)) {
                    results.push(x);
                }
            }
        }
        return results;
    }

    suggest(myCellList) {
        if (this.openingPhase !== 'complete') return this.getOpeningData().needsChoice ? [] : [this.getOpeningMove()];
        const AIEngent = this.turn === 'computer' ? this.computerAgent.instance : this.playerAgent.instance;
        const suggest = AIEngent ? AIEngent.suggest(myCellList) : []//this.getSuggest(myCellList);
        if (suggest && !Array.isArray(suggest)) {
            return [suggest];
        }
        return suggest;
    }


    getLinesWithMidleCells(type, cells, cellNumber) {
        const lines = this.lines[type];
        const list = this.getLinesForCells(type, lines, cells);
        const lineLength = lines[0].length;
        const sc = Math.floor((lineLength - cellNumber) / 2);
        const line2s = [];
        dualLoop(list, (lineIndex) => {
            const h = list[lineIndex];
            const hg = lines[h];
            let c = 0;
            for (let j = sc; j < sc + cellNumber; j++) {
                if (cells.indexOf(hg[j]) !== -1) c++;
            }
            let c2 = 0;
            if (sc !== (lineLength - cellNumber) / 2)
                for (let j = sc + 1; j <= sc + cellNumber; j++) {
                    if (cells.indexOf(hg[j]) !== -1) c2++;
                }
            if (c === cellNumber || c2 === cellNumber) line2s.push(lineIndex);
        });
        return line2s;
    }

    getFatherLine(index) {
        // if (Object.prototype.hasOwnProperty.call(this.fatherLines, index)) {
        //     return this.fatherLines[index];
        // }
        return this.getFatherLineByLineIndex(index);
    }
    getFatherLineByLineIndex(index) {
        const line = this.lines[0][index];
        if (!line) return null;
        const [before, after] = this.getLineEndpoints(line);
        if (!this.isValidCoordinate(before) || !this.isValidCoordinate(after)) return null;
        return [before, ...line, after];
    }

    getMotherLine(index, cellNumber) {
        const line = this.lines[0][index];
        const lines = this.getLinesByList(2, line, cellNumber);
        if (lines.length === 0) return null;
        let result = null;
        dualLoop(lines, (lineIndex, index, stop) => {
            const fline = this.lines[2][lineIndex];
            if (line[0] !== fline[1] || line[line.length - 1] !== fline[fline.length - 2]) return;
            result = fline;
            stop();
        });
        return result;
    }

    /**
     * Kiểm tra xem một ô có thể đánh được không
     * @param {string} coord - Tọa độ ô cần kiểm tra
     * @returns {boolean} Kết quả kiểm tra
     */
    checkCellAvailable(coord) {
        return this.isValidCoordinate(coord) && !this.selectedCells.includes(coord);
    }

    findIntersection(type, lineList) {
        const lines = this.lines[type] || [];
        const occurrences = new Map();
        for (const index of new Set(lineList)) {
            for (const cell of new Set(lines[index] || [])) {
                occurrences.set(cell,(occurrences.get(cell) || 0)+1);
            }
        }
        return [...occurrences].filter(([cell,count]) => count>=2 && this.checkCellAvailable(cell)).map(([cell]) => cell);
    }

    inBorder(type, lineIndex) {
        const cells = this.lines[type][lineIndex];
        return cells.filter(c => this.borderCells.indexOf(c) !== -1).length;
    }

    isBorderCell(coord) {
        return (this.borderCells.indexOf(coord) !== -1);
    }

    checkNearBy(type, index, list, cell) {
        const line = this.lines[type][index];
        let s = 0;
        for (const o of line) {
            if (s === 0 && list.indexOf(o) !== -1) {
                s++;
            } else if (s > 0 && list.indexOf(o) === -1) {
                break;
            }
        }
        return (s === cell);
    }

    checkFullCell() {
        if (this.selectedCells.length >= this.totalCell) {
            this.gameStatus = 'draw';
            return true;
        }
        return false;
    }

    addLineGroup(type, index, group) {
        const line = this.lines[type][index];
        for (const cell of line) {
            this.addCellGroup(cell, group);
        }
    }

    addCellGroup(coord, group) {
        const gs = this.cellData[coord].group.split(' ');
        if (gs.indexOf(group) === -1) {
            gs.push(group);
            this.cellData[coord].group = gs.join(' ');
        }
    }

    removeCellGroup(coord, group) {
        const gs = this.cellData[coord].group.split(' ');
        const i = gs.indexOf(group);
        if (i !== -1) {
            gs.splice(i, 1);
            this.cellData[coord].group = gs.join(' ');
        }
    }

    /**
     * Tăng số lần thắng/thua
     * @param {string} item - Loại điểm cần tăng
     * @returns {number} Số điểm mới
     */
    incCount(item) {
        let number = parseInt(LS.get(item) || 0);
        number++;
        LS.set(item, number);
        return number;
    }

    /**
     * Cập nhật số lần thắng/thua
     * @param {string} item - Loại điểm cần cập nhật
     * @param {number} number - Số điểm mới
     */
    updateCount(item, number) {
        LS.set(item, number);
    }

    /**
     * Lấy dữ liệu điểm số
     * @returns {Object} Dữ liệu điểm số
     */
    getPlayData() {
        const player_count = parseInt(LS.get('player_count') || 0);
        const computer_count = parseInt(LS.get('computer_count') || 0);
        const player1_count = parseInt(LS.get('player1_count') || 0);
        const player2_count = parseInt(LS.get('player2_count') || 0);
        
        return {
            player_count: player_count,
            computer_count: computer_count,
            player1_count: player1_count,
            player2_count: player2_count
        };
    }

    /**
     * Reset lịch sử điểm số
     */
    resetHistory() {
        this.updateCount('player_count', 0);
        this.updateCount('computer_count', 0);
    }

    /**
     * Kiểm tra xem một tọa độ có hợp lệ không
     * @param {string} coord - Tọa độ cần kiểm tra (dạng "x:y")
     * @returns {boolean} True nếu tọa độ hợp lệ
     */
    isValidCoordinate(coord) {
        if (!coord || typeof coord !== 'string') return false;
        const parts = coord.split(':');
        if (parts.length !== 2) return false;
        const [x, y] = parts.map(Number);
        return Number.isInteger(x) && Number.isInteger(y) &&
            x >= 1 && x <= this.column && y >= 1 && y <= this.row;
    }

    // Thêm phương thức getBoardState
    getBoardState() {
        return {
            playerCells: [...this.playerCells],
            computerCells: [...this.computerCells],
            selectedCells: [...this.selectedCells],
            gameStatus: this.gameStatus,
            turn: this.turn
        };
    }
    test(data, callback) {
        testLoopPerformance(typeof data === 'object' && data !== null ? data : this.cellData, callback ? callback : (cell) => {
            let t = 0;
            for (let i = 0; i < 2000; i++) {
                t += i;

            }
            return t;
        });
    }
    testLoop(size) {
        const testArray = Array.from({ length: size }, (_, i) => i);
        const testObject = Object.fromEntries(testArray.map(i => [`key${i}`, i]));

        const callback = (item, index, stop, side) => {
            // if (index === 5000) stop(); // Dừng khi tới phần tử 5000
            let t = 0;
            for (let i = 0; i < 2000; i++) {
                t += i;
            }
            return t;
        };

        // Kiểm tra hiệu suất
        console.log("Testing with large array...");
        this.test(this.lines[0], callback);

        console.log("Testing with large object...");
        this.test(this.cellData, callback);

    }
}

export default CorrectFiveGame;
