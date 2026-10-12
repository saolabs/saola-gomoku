import CorrectFiveGame from "../core/CorrectFiveGame";
import BaseModel from "./base-model";

class C5_2025 extends BaseModel {
    // Thông tin cơ bản về model
    static NAME = 'C5_2025';
    static VERSION = '2.0.0';
    static AUTHOR = 'Le Ngoc Doan';
    static DESCRIPTION = 'AI Gomoku thiên phòng thủ, ưu tiên hạn chế cơ hội và đe dọa của đối thủ';
    static COPYRIGHT = 'Copyright 2025 Le Ngoc Doan';
    static LICENSE = 'MIT';
    static WEBSITE = 'https://example.com';
    static RULES = [
        'Hỗ trợ bàn tùy chỉnh và đoạn 4, 5 hoặc 6 quân',
        'Đoạn N thắng nếu hai ô sát đầu không có đối thủ',
        'Quân cùng màu ngoài đoạn và biên bàn không chặn thắng',
        'Chiến thuật và tìm kiếm dùng chung bộ luật của engine',
    ];

    // Các hằng số điểm số
    WINNING_SCORE = 1000;
    THREAT_SCORE = 100;
    DEFENSE_SCORE = 80;
    BORDER_PENALTY = -15;
    LEARNING_WEIGHT = 25;
    PATTERN_WEIGHT = 30;
    CENTER_WEIGHT = 20;

    // Dữ liệu học máy
    learningData = {
        winningPatterns: {}, // Các pattern dẫn đến thắng
        losingPatterns: {}, // Các pattern dẫn đến thua
        criticalMoves: {}, // Các nước đi quyết định
        gameHistory: [], // Lịch sử các ván đấu
        moveStatistics: {}, // Thống kê về các nước đi
    };

    // Trạng thái game hiện tại
    currentGameState = {
        moves: [],
        patterns: [],
        threats: [],
        defenses: [],
    };
    
    /**
     * @type {CorrectFiveGame}
     */
    game = null;
    
    constructor(game) {
        super();
        this.game = game;
        this.loadLearningData();
        this.setupEventListeners();
    }

    // Thiết lập các event listener
    setupEventListeners() {
        // // Lắng nghe sự kiện khởi tạo game
        // this.game.on('initing', (options) => {
        //     this.currentGameState = {
        //         moves: [],
        //         patterns: [],
        //         threats: [],
        //         defenses: [],
        //     };
        // });

        // // Lắng nghe sự kiện tạo bảng mới
        // this.game.on('creating', ({column, row, winningLineLength}) => {
        //     this.currentGameState = {
        //         moves: [],
        //         patterns: [],
        //         threats: [],
        //         defenses: [],
        //     };
        // });

        // // Lắng nghe sự kiện kết thúc game
        // this.game.on('gameOver', (winner) => {
        //     this.endGame(winner);
        // });
    }

    // Bắt đầu ván mới
    startGame() {
        this.currentGameState = {
            moves: [],
            patterns: [],
            threats: [],
            defenses: [],
        };
    }

    // Kết thúc ván và học từ kết quả
    endGame(winner) {
        if (this.currentGameState.moves.length === 0) return;

        // Phân tích ván đấu
        const gameData = {
            moves: this.currentGameState.moves,
            patterns: this.currentGameState.patterns,
            threats: this.currentGameState.threats,
            defenses: this.currentGameState.defenses,
            winner,
            timestamp: Date.now(),
            level: this.game.level,
            winningLineLength: this.game.winningLineLength
        };

        // Cập nhật dữ liệu học máy
        this.updateLearningData(gameData);

        // Lưu lịch sử game
        this.learningData.gameHistory.push(gameData);
        if (this.learningData.gameHistory.length > 200) {
            this.learningData.gameHistory.shift();
        }

        // Lưu dữ liệu học máy
        this.saveLearningData();
    }

    // Cập nhật dữ liệu học máy từ một ván đấu
    updateLearningData(gameData) {
        const { moves, patterns, winner } = gameData;

        // Cập nhật thống kê nước đi
        moves.forEach(move => {
            const key = this.getPositionKey(move.coord);
            if (!this.learningData.moveStatistics[key]) {
                this.learningData.moveStatistics[key] = {
                    wins: 0,
                    losses: 0,
                    total: 0
                };
            }
            this.learningData.moveStatistics[key].total++;
            if (move.player === winner) {
                this.learningData.moveStatistics[key].wins++;
            } else {
                this.learningData.moveStatistics[key].losses++;
            }
        });

        // Cập nhật pattern thắng/thua
        patterns.forEach(pattern => {
            const key = this.getPatternKey(pattern);
            if (pattern.result === 'win') {
                this.learningData.winningPatterns[key] = 
                    (this.learningData.winningPatterns[key] || 0) + 1;
            } else if (pattern.result === 'lose') {
                this.learningData.losingPatterns[key] = 
                    (this.learningData.losingPatterns[key] || 0) + 1;
            }
        });

        // Xác định và lưu các nước đi quyết định
        const criticalMoves = this.identifyCriticalMoves(gameData);
        criticalMoves.forEach(move => {
            const key = this.getPositionKey(move);
            this.learningData.criticalMoves[key] = 
                (this.learningData.criticalMoves[key] || 0) + 1;
        });
    }

    // Xác định các nước đi quyết định trong ván đấu
    identifyCriticalMoves(gameData) {
        const criticalMoves = [];
        const { moves, winner } = gameData;

        // Xem xét 3 nước đi cuối cùng trước khi thắng
        if (winner) {
            const winningMoves = moves.filter(move => move.player === winner);
            const lastMoves = winningMoves.slice(-3);
            lastMoves.forEach(move => criticalMoves.push(move.coord));
        }

        // Xem xét các nước đi tạo ra nhiều đường tấn công
        moves.forEach(move => {
            if (move.threats && move.threats.length >= 2) {
                criticalMoves.push(move.coord);
            }
        });

        // Xem xét các nước phòng thủ quan trọng
        moves.forEach(move => {
            if (move.defenseValue && move.defenseValue >= this.DEFENSE_SCORE) {
                criticalMoves.push(move.coord);
            }
        });

        return [...new Set(criticalMoves)];
    }

    // Đề xuất nước đi thông minh
    suggest(myCellList) {
        const cells = myCellList || this.game.getCurrentPlayerCells();
        return this.game.getStrategicMoves(cells, this.game.getCompetitorCells(), this.game.level, 'defensive');
    }

    // Tìm nước đi tấn công thông minh
    findSmartAttackMoves(myCellList, competitorCellList) {
        const moves = [];
        
        // Tìm các pattern có thể phát triển thành thắng
        const patterns = this.findThreateningPatterns(myCellList);
        
        // Phân tích và chọn các pattern tốt nhất
        const goodPatterns = patterns.filter(pattern => {
            // Kiểm tra xem pattern có thể phát triển không bị chặn
            const developmentPotential = this.evaluatePatternDevelopment(pattern, competitorCellList);
            return developmentPotential >= this.THREAT_SCORE;
        });

        // Tìm điểm giao của các pattern tốt
        const intersections = this.findPatternIntersections(goodPatterns);
        moves.push(...intersections);

        // Tìm các nước đi tạo nhiều đường tấn công
        const multiThreatMoves = this.findMultiThreatMoves(myCellList, competitorCellList);
        moves.push(...multiThreatMoves);

        // Tìm các nước đi có thể phát triển trong tương lai
        const developmentMoves = this.findDevelopmentMoves(myCellList, competitorCellList);
        moves.push(...developmentMoves);

        return [...new Set(moves)];
    }

    // Tìm nước đi phòng thủ chủ động
    findActiveDefenseMoves(myCellList, competitorCellList) {
        const moves = [];
        
        // Phân tích các mối đe dọa từ đối thủ
        const threats = this.analyzeThreats(competitorCellList, myCellList);
        
        // Sắp xếp các mối đe dọa theo mức độ nguy hiểm
        threats.sort((a, b) => b.dangerLevel - a.dangerLevel);

        // Xử lý từng mối đe dọa
        threats.forEach(threat => {
            // Tìm các nước đi chặn hiệu quả
            const blockingMoves = this.findEffectiveBlocks(threat, myCellList);
            
            // Đánh giá và chọn nước đi tốt nhất
            const bestMoves = blockingMoves.filter(move => {
                const effectiveScore = this.evaluateBlockingEffectiveness(move, threat);
                return effectiveScore >= this.DEFENSE_SCORE;
            });

            moves.push(...bestMoves);
        });

        // Tìm các vị trí phòng thủ chiến lược
        const strategicDefense = this.findStrategicDefensePositions(competitorCellList);
        moves.push(...strategicDefense);

        return [...new Set(moves)];
    }

    // Đánh giá điểm của một nước đi
    evaluateMove(cell, myCells, isUrgent = false) {
        let score = 0;
        
        // Kiểm tra chiến thắng
        const tempCells = [...myCells, cell];
        if (this.checkWinner(tempCells)) {
            score += this.WINNING_SCORE;
            if (isUrgent) score *= 1.2;
        }

        // Đánh giá vị trí chiến lược
        score += this.evaluatePosition(cell) * this.CENTER_WEIGHT;
        
        // Đánh giá mối đe dọa
        score += this.evaluateThreats(cell, tempCells) * this.THREAT_SCORE;
        
        // Đánh giá khả năng phòng thủ
        score += this.evaluateDefense(cell, tempCells) * this.DEFENSE_SCORE;
        
        // Đánh giá pattern
        score += this.evaluatePatterns(cell, tempCells) * this.PATTERN_WEIGHT;
        
        // Sử dụng dữ liệu đã học
        score += this.evaluateLearningData(cell) * this.LEARNING_WEIGHT;

        // Điều chỉnh theo level
        score *= (this.game.level / 3);

        // Giảm điểm cho các ô biên nếu không khẩn cấp
        if (!isUrgent && this.game.isBorderCell(cell)) {
            score += this.BORDER_PENALTY;
        }

        // Thêm yếu tố ngẫu nhiên nhỏ để tránh trùng lặp
        const randomFactor = 0.95 + Math.random() * 0.1;
        score *= randomFactor;

        return score;
    }

    // Thêm phương thức findPatternsContainingCell
    findPatternsContainingCell(cell, cellList) {
        const patterns = [];
        const lines = this.game.getLinesByList(0, cellList, this.game.winningLineLength - 2);
        
        for (const lineIndex of lines) {
            const line = this.game.lines[0][lineIndex];
            
            // Kiểm tra xem ô có nằm trong dãy không
            if (line.includes(cell)) {
                const myCellsInLine = line.filter(c => cellList.includes(c));
                const emptyCells = this.getEmptyCells(line);
                
                // Chỉ thêm pattern nếu có đủ quân và ô trống
                if (myCellsInLine.length >= this.game.winningLineLength - 2 && emptyCells.length > 0) {
                    patterns.push({
                        line,
                        myCells: myCellsInLine,
                        emptyCells,
                        threatLevel: this.calculateThreatLevel(myCellsInLine.length, emptyCells.length, 0)
                    });
                }
            }
        }
        
        return patterns;
    }

    // Thêm phương thức evaluatePatterns
    evaluatePatterns(cell, cellList) {
        let score = 0;
        const patterns = this.findPatternsContainingCell(cell, cellList);

        patterns.forEach(pattern => {
            // Kiểm tra pattern trong dữ liệu học máy
            const patternKey = this.getPatternKey(pattern);
            if (this.learningData.winningPatterns[patternKey]) {
                score += this.learningData.winningPatterns[patternKey];
            }
            if (this.learningData.losingPatterns[patternKey]) {
                score -= this.learningData.losingPatterns[patternKey];
            }

            // Đánh giá khả năng phát triển của pattern
            score += this.evaluatePatternDevelopment(pattern, this.game.computerCells);
        });

        return score;
    }

    // Đánh giá dữ liệu học máy
    evaluateLearningData(cell) {
        let score = 0;
        const key = this.getPositionKey(cell);

        // Xem xét thống kê nước đi
        if (this.learningData.moveStatistics[key]) {
            const stats = this.learningData.moveStatistics[key];
            if (stats.total > 0) {
                const winRate = stats.wins / stats.total;
                score += winRate * 50;
            }
        }

        // Xem xét các nước đi quyết định
        if (this.learningData.criticalMoves[key]) {
            score += this.learningData.criticalMoves[key] * 10;
        }

        return score;
    }

    // Phân tích các mối đe dọa
    analyzeThreats(cellList, competitorCellList) {
        const threats = [];
        const lines = this.game.getLinesByList(0, cellList, this.game.winningLineLength - 1, true);

        lines.forEach(lineIndex => {
            const line = this.game.lines[0][lineIndex];
            const threat = this.analyzeThreatPattern(line, cellList, competitorCellList);
            if (threat) {
                threats.push(threat);
            }
        });

        return threats;
    }

    // Phân tích pattern đe dọa
    analyzeThreatPattern(line, cellList, competitorCellList) {
        const cells = line.filter(cell => cellList.includes(cell));
        const emptyCells = line.filter(cell => 
            !cellList.includes(cell) && !competitorCellList.includes(cell));
        const blockedCells = line.filter(cell => competitorCellList.includes(cell));

        if (cells.length >= this.game.winningLineLength - 2 && emptyCells.length > 0) {
            return {
                pattern: line,
                cells,
                emptyCells,
                blockedCells,
                dangerLevel: this.calculateThreatLevel(cells.length, emptyCells.length, blockedCells.length)
            };
        }

        return null;
    }

    // Tính toán mức độ nguy hiểm của đe dọa
    calculateThreatLevel(cellCount, emptyCount, blockedCount) {
        let level = 0;

        // Càng nhiều quân liên tiếp càng nguy hiểm
        level += cellCount * 20;

        // Càng ít ô trống càng nguy hiểm
        level += (5 - emptyCount) * 15;

        // Càng ít bị chặn càng nguy hiểm
        level -= blockedCount * 10;

        // Điều chỉnh theo số quân cần để thắng
        level *= (4 / this.game.winningLineLength);

        return Math.max(0, level);
    }

    // Tìm các nước đi tạo nhiều đường tấn công
    findMultiThreatMoves(myCellList, competitorCellList) {
        const moves = [];
        const availableCells = this.game.getEmptyCells();

        availableCells.forEach(cell => {
            const tempList = [...myCellList, cell];
            const threats = this.countPotentialThreats(tempList, competitorCellList);
            
            if (threats >= 2) { // Nếu tạo được từ 2 đường tấn công trở lên
                moves.push(cell);
            }
        });

        return moves;
    }

    // Đếm số đường tấn công tiềm năng
    countPotentialThreats(cellList, competitorCellList) {
        let count = 0;
        const lines = this.game.getLinesByList(0, cellList, this.game.winningLineLength - 2, true);

        lines.forEach(lineIndex => {
            const line = this.game.lines[0][lineIndex];
            // Kiểm tra xem đường này có thể phát triển thành thắng không
            if (this.canDevelopIntoWin(line, cellList, competitorCellList)) {
                count++;
            }
        });

        return count;
    }

    // Kiểm tra khả năng phát triển thành thắng
    canDevelopIntoWin(line, cellList, competitorCellList) {
        const myCells = line.filter(cell => cellList.includes(cell));
        const blockedCells = line.filter(cell => competitorCellList.includes(cell));
        const emptyCells = line.filter(cell => 
            !cellList.includes(cell) && !competitorCellList.includes(cell));

        // Nếu đã bị chặn quá nhiều, không thể thắng
        if (blockedCells.length > 1) return false;

        // Nếu có đủ ô trống để phát triển
        return (myCells.length + emptyCells.length) >= this.game.winningLineLength;
    }

    // Tạo key cho pattern
    getPatternKey(pattern) {
        // Lấy tất cả các ô trong pattern và sắp xếp chúng
        const allCells = [...pattern.myCells, ...pattern.emptyCells].sort();
        return allCells.join('|');
    }

    // Tạo key cho vị trí
    getPositionKey(coord) {
        return `${coord}|${this.game.winningLineLength}|${this.game.level}`;
    }

    // Lưu dữ liệu học máy
    saveLearningData() {
        try {
            localStorage.setItem('C5_2025_learning_data', JSON.stringify(this.learningData));
        } catch (error) {
            console.error('Failed to save learning data:', error);
        }
    }

    // Tải dữ liệu học máy
    loadLearningData() {
        try {
            const data = localStorage.getItem('C5_2025_learning_data');
            if (data) {
                this.learningData = JSON.parse(data);
            }
        } catch (error) {
            console.error('Failed to load learning data:', error);
            this.learningData = {
                winningPatterns: {},
                losingPatterns: {},
                criticalMoves: {},
                gameHistory: [],
                moveStatistics: {},
            };
        }
    }

    findWinningMoves(myCells, competitorCells = this.game.getCompetitorCells()) {
        return this.game.getWinningMoves(myCells, competitorCells);
    }

    checkWinner(cells, competitorCells = this.game.getCompetitorCells(), type = 'win') {
        return type === 'win' && this.game.checkWinner(cells, competitorCells);
    }

    // Thêm phương thức getEmptyCells
    getEmptyCells(line) {
        return line.filter(cell => 
            !this.game.playerCells.includes(cell) && 
            !this.game.computerCells.includes(cell)
        );
    }

    // Thêm phương thức rankMoves
    rankMoves(moves, myCells, isUrgent = false) {
        if (!moves || moves.length === 0) return null;

        // Đánh giá điểm cho mỗi nước đi
        const rankedMoves = moves.map(cell => ({
            cell,
            score: this.evaluateMove(cell, myCells, isUrgent)
        }));

        // Sắp xếp theo điểm số giảm dần
        rankedMoves.sort((a, b) => b.score - a.score);

        // Trả về nước đi có điểm cao nhất
        return rankedMoves[0].cell;
    }

    // Thêm phương thức evaluatePosition
    evaluatePosition(cell) {
        const [row, col] = cell.split(',').map(Number);
        const centerRow = Math.floor(this.game.rows / 2);
        const centerCol = Math.floor(this.game.cols / 2);
        
        // Tính khoảng cách từ ô đến trung tâm
        const rowDistance = Math.abs(row - centerRow);
        const colDistance = Math.abs(col - centerCol);
        
        // Càng gần trung tâm càng tốt
        return 1 - (rowDistance + colDistance) / (this.game.rows + this.game.cols);
    }

    // Thêm phương thức evaluateThreats
    evaluateThreats(cell, myCells) {
        let score = 0;
        const tempCells = [...myCells, cell];
        const lines = this.game.getLinesByList(0, tempCells, this.game.winningLineLength - 1);
        
        for (const lineIndex of lines) {
            const line = this.game.lines[0][lineIndex];
            const myCellsInLine = line.filter(cell => tempCells.includes(cell));
            
            if (myCellsInLine.length >= this.game.winningLineLength - 1) {
                score += 1;
            }
        }
        
        return score;
    }

    // Thêm phương thức evaluateDefense
    evaluateDefense(cell, myCells) {
        let score = 0;
        const competitorCells = this.game.turn === 'computer' ? 
            this.game.playerCells : this.game.computerCells;
        
        // Kiểm tra xem nước đi có chặn được đối thủ không
        const tempCompetitorCells = [...competitorCells, cell];
        if (this.checkWinner(tempCompetitorCells, this.game.getCurrentPlayerCells())) {
            score += 1;
        }
        
        return score;
    }

    // Thêm phương thức findStrategicMoves
    findStrategicMoves(myCells, competitorCells) {
        const moves = [];
        const availableCells = this.game.getEmptyCells();

        // Tìm các nước đi chiến lược
        for (const cell of availableCells) {
            const tempCells = [...myCells, cell];
            
            // Kiểm tra xem nước đi có tạo ra nhiều đường tấn công không
            const attackLines = this.countAttackLines(tempCells);
            
            // Kiểm tra xem nước đi có chặn được đối thủ không
            const defenseValue = this.evaluateDefense(cell, tempCells);
            
            // Kiểm tra xem nước đi có ở vị trí chiến lược không
            const positionValue = this.evaluatePosition(cell);
            
            // Nếu nước đi có nhiều giá trị chiến lược, thêm vào danh sách
            if (attackLines >= 2 || defenseValue > 0 || positionValue > 0.7) {
                moves.push(cell);
            }
        }

        return moves;
    }

    // Thêm phương thức countAttackLines
    countAttackLines(cells) {
        let count = 0;
        const lines = this.game.getLinesByList(0, cells, this.game.winningLineLength - 1);
        
        for (const lineIndex of lines) {
            const line = this.game.lines[0][lineIndex];
            const myCellsInLine = line.filter(cell => cells.includes(cell));
            
            if (myCellsInLine.length >= this.game.winningLineLength - 1) {
                count++;
            }
        }
        
        return count;
    }

    // Thêm phương thức findThreateningPatterns
    findThreateningPatterns(myCells) {
        const patterns = [];
        const lines = this.game.getLinesByList(0, myCells, this.game.winningLineLength - 2);
        
        for (const lineIndex of lines) {
            const line = this.game.lines[0][lineIndex];
            const myCellsInLine = line.filter(cell => myCells.includes(cell));
            const emptyCells = this.getEmptyCells(line);
            
            if (myCellsInLine.length >= this.game.winningLineLength - 2 && emptyCells.length > 0) {
                patterns.push({
                    line,
                    myCells: myCellsInLine,
                    emptyCells,
                    threatLevel: this.calculateThreatLevel(myCellsInLine.length, emptyCells.length, 0)
                });
            }
        }
        
        return patterns;
    }

    // Thêm phương thức evaluatePatternDevelopment
    evaluatePatternDevelopment(pattern, competitorCells) {
        let score = 0;
        const { myCells, emptyCells } = pattern;
        
        // Đánh giá số quân liên tiếp
        score += myCells.length * 20;
        
        // Đánh giá số ô trống có thể phát triển
        score += emptyCells.length * 15;
        
        // Kiểm tra xem có bị chặn bởi đối thủ không
        const blockedCells = pattern.line.filter(cell => competitorCells.includes(cell));
        score -= blockedCells.length * 10;
        
        // Điều chỉnh theo số quân cần để thắng
        score *= (4 / this.game.winningLineLength);
        
        return Math.max(0, score);
    }

    // Thêm phương thức findPatternIntersections
    findPatternIntersections(patterns) {
        const intersections = new Set();
        
        for (let i = 0; i < patterns.length; i++) {
            for (let j = i + 1; j < patterns.length; j++) {
                const pattern1 = patterns[i];
                const pattern2 = patterns[j];
                
                // Tìm các ô trống chung giữa hai pattern
                const commonEmptyCells = pattern1.emptyCells.filter(cell => 
                    pattern2.emptyCells.includes(cell)
                );
                
                commonEmptyCells.forEach(cell => intersections.add(cell));
            }
        }
        
        return Array.from(intersections);
    }

    // Thêm phương thức findDevelopmentMoves
    findDevelopmentMoves(myCells, competitorCells) {
        const moves = [];
        const availableCells = this.game.getEmptyCells();
        
        for (const cell of availableCells) {
            const tempCells = [...myCells, cell];
            const patterns = this.findThreateningPatterns(tempCells);
            
            // Đánh giá khả năng phát triển của mỗi pattern
            const developmentScore = patterns.reduce((score, pattern) => {
                return score + this.evaluatePatternDevelopment(pattern, competitorCells);
            }, 0);
            
            if (developmentScore >= this.THREAT_SCORE) {
                moves.push(cell);
            }
        }
        
        return moves;
    }

    // Thêm phương thức findStrategicDefensePositions
    findStrategicDefensePositions(competitorCells) {
        const moves = [];
        const availableCells = this.game.getEmptyCells();
        
        for (const cell of availableCells) {
            const tempCompetitorCells = [...competitorCells, cell];
            const patterns = this.findThreateningPatterns(tempCompetitorCells);
            
            // Nếu đối thủ có thể tạo nhiều pattern đe dọa từ vị trí này
            if (patterns.length >= 2) {
                moves.push(cell);
            }
        }
        
        return moves;
    }

    // Thêm phương thức findEffectiveBlocks
    findEffectiveBlocks(threat, myCells) {
        const moves = [];
        const { emptyCells, blockedCells } = threat;
        
        // Nếu có ít ô trống, ưu tiên chặn các ô trống
        if (emptyCells.length <= 2) {
            moves.push(...emptyCells);
        }
        
        // Nếu có ít ô bị chặn, tìm các ô phòng thủ chiến lược
        if (blockedCells.length <= 1) {
            const strategicMoves = this.findStrategicDefensePositions([...myCells, ...emptyCells]);
            moves.push(...strategicMoves);
        }
        
        return [...new Set(moves)];
    }

    // Thêm phương thức evaluateBlockingEffectiveness
    evaluateBlockingEffectiveness(move, threat) {
        let score = 0;
        const { emptyCells, blockedCells } = threat;
        
        // Đánh giá hiệu quả chặn
        if (emptyCells.includes(move)) {
            score += 50;
        }
        
        // Đánh giá vị trí chiến lược
        score += this.evaluatePosition(move) * 30;
        
        // Đánh giá khả năng phát triển sau khi chặn
        const developmentScore = this.evaluatePatternDevelopment(
            { line: threat.pattern, myCells: threat.cells, emptyCells: emptyCells.filter(cell => cell !== move) },
            []
        );
        score += developmentScore * 0.5;
        
        return score;
    }

    // Thêm phương thức findBestLearnedMoves
    findBestLearnedMoves(myCells) {
        const moves = [];
        const availableCells = this.game.getEmptyCells();
        
        for (const cell of availableCells) {
            const key = this.getPositionKey(cell);
            const stats = this.learningData.moveStatistics[key];
            
            if (stats && stats.total > 0) {
                const winRate = stats.wins / stats.total;
                if (winRate > 0.6) { // Chỉ chọn các nước đi có tỷ lệ thắng cao
                    moves.push(cell);
                }
            }
        }
        
        if (moves.length > 0) {
            return this.rankMoves(moves, myCells);
        }
        
        return null;
    }
}

export default C5_2025; 
