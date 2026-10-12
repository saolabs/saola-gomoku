import CorrectFiveGame from "../core/CorrectFiveGame";
import BaseModel from "./base-model";

class C5_Demo extends BaseModel {
    // thuoc tinh va phuong thuc static cua class 
    static NAME = 'C5_Demo';
    static VERSION = '2.0.0';
    static AUTHOR = 'Le Ngoc Doan';
    static DESCRIPTION = 'AI Gomoku thiên tấn công, ưu tiên phát triển đe dọa và đa dạng nước đi';
    static COPYRIGHT = 'Copyright 2024 Le Ngoc Doan';
    static LICENSE = 'MIT';
    static WEBSITE = 'https://example.com';
    static RULES = [
        'Hỗ trợ bàn tùy chỉnh và đoạn 4, 5 hoặc 6 quân',
        'Đoạn N thắng nếu hai ô sát đầu không có đối thủ',
        'Quân cùng màu ngoài đoạn và biên bàn không chặn thắng',
        'Chiến thuật và tìm kiếm dùng chung bộ luật của engine',
    ];
    static EXAMPLES = [
        'Khai cuộc: cùng người đặt X tại 8:8, O tại 9:8, X tại 8:9',
        'Bên thứ hai chọn Đen/Trắng hoặc đặt thêm O rồi X',
        'Sau chọn màu, người sở hữu O đánh tiếp',
    ];
    static PARAMETERS = [
        'level',
        'delayTime',
        'soundOn',
        'size',
    ];
    static RESULTS = [
        'Người chơi thắng',
        'Máy tính thắng',
        'Hòa',
    ];

    // thuoc tinh va phuong thuc rieng cua class
    currentGameMoves = [];
    WINNING_SCORE = 1000;
    THREAT_SCORE = 100;
    DEFENSE_SCORE = 50;
    BORDER_PENALTY = -10;
    LEARNING_WEIGHT = 20; // Tăng trọng số cho dữ liệu học
    learningData = null;
    /**
     * @type {CorrectFiveGame}
     */
    game = null;
    constructor(game) {
        super();
        this.game = game;
        this.loadLearningData();
    
    }


    // Tải dữ liệu học máy từ localStorage
    loadLearningData() {
        const data = localStorage.getItem(this.NAME + 'AILearning');
        this.learningData = data ? JSON.parse(data) : {
            winningMoves: {},  // Lưu các nước đi dẫn đến chiến thắng
            threatPatterns: {}, // Lưu các mẫu tấn công hiệu quả
            playerPatterns: {}, // Học từ cách chơi của người
            gameHistory: []     // Lịch sử các ván đấu
        };
    }

    reloadLearningData(){
        this.learningData = this.learningData ? this.learningData : this.loadLearningData();
    }
    // Lưu dữ liệu học máy
    saveLearningData() {
        localStorage.setItem(this.NAME + 'AILearning', JSON.stringify(this.learningData));
    }

    // Ghi nhận nước đi trong ván hiện tại
    recordMove(coord, player, boardState) {
        this.currentGameMoves.push({
            coord,
            player,
            boardState: this.getBoardState(),
            timestamp: Date.now()
        });
    }

    // Lấy trạng thái bàn cờ hiện tại
    getBoardState() {
        return {
            playerCells: [...this.game.playerCells],
            computerCells: [...this.game.computerCells],
            selectedCells: [...this.game.selectedCells]
        };
    }

    startGame(){
        this.currentGameMoves = [];
    }
    // Kết thúc ván và học từ kết quả
    // ham nay bat buoc phai khai bao
    endGame(winner) { // winner là người thắng, có thể là player hoặc computer
        if (this.currentGameMoves.length === 0) return;

        // Phân tích và học từ ván đấu
        const gameData = {
            moves: this.currentGameMoves,
            winner,
            timestamp: Date.now(),
            level: this.game.level,
            winningLineLength: this.game.winningLineLength
        };

        this.learningData.gameHistory.push(gameData);

        // Giới hạn lịch sử để tránh quá tải
        if (this.learningData.gameHistory.length > 10) {
            this.learningData.gameHistory.shift();
        }

        // Học từ các nước đi thắng
        if (winner) {
            const winningMoves = this.currentGameMoves.filter(move => move.player === winner);
            winningMoves.forEach(move => {
                const key = this.getPositionKey(move.coord);
                this.learningData.winningMoves[key] = (this.learningData.winningMoves[key] || 0) + 1;
            });
        }

        this.saveLearningData();
        this.currentGameMoves = [];
    }

    // Tạo key cho vị trí dựa trên pattern xung quanh
    getPositionKey(coord) {
        const pattern = this.getPatternAroundPosition(coord);
        return `${coord}|${pattern}`;
    }

    // Lấy pattern xung quanh một vị trí
    getPatternAroundPosition(coord) {
        const [x, y] = coord.split(':').map(Number);
        const pattern = [];
        
        // Kiểm tra 8 hướng xung quanh
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                const checkCoord = `${x + i}:${y + j}`;
                if (this.game.playerCells.includes(checkCoord)) {
                    pattern.push('P');
                } else if (this.game.computerCells.includes(checkCoord)) {
                    pattern.push('C');
                } else if (this.game.isValidCoordinate(checkCoord)) {
                    pattern.push('E');
                } else {
                    pattern.push('X');
                }
            }
        }
        return pattern.join('');
    }

    /**
     * Hàm đưa ra gợi ý thông minh dựa trên AI
     * @param {array} myCellList danh sách ô đã đánh
     * @returns {array} danh sách ô gợi ý
     */
    suggest(myCellList) {
        const cells = myCellList || this.game.getCurrentPlayerCells();
        return this.game.getStrategicMoves(cells, this.game.getCompetitorCells(), this.game.level, 'attacking');
    }

    // Đánh giá và xếp hạng các nước đi
    rankMoves(moves, myCellList, isUrgent = false) {
        const rankedMoves = moves.map(move => ({
            move,
            score: this.evaluateMove(move, myCellList, isUrgent)
        }));

        // Sắp xếp theo điểm số
        rankedMoves.sort((a, b) => b.score - a.score);

        // Trả về các nước đi tốt nhất dựa trên level
        const numMoves = Math.max(1, Math.ceil(rankedMoves.length / (4 - this.game.level)));
        return rankedMoves.slice(0, numMoves).map(rm => rm.move);
    }

    // Tìm nước đi chiến lược
    findStrategicMoves(myCellList, competitorCellList) {
        const moves = [];
        const patterns = this.findThreateningPatterns(myCellList);
        
        // Nếu là nước đi đầu tiên, thêm các vị trí chiến lược khác nhau
        if (myCellList.length === 0) {
            const centerX = Math.floor(this.game.column / 2);
            const centerY = Math.floor(this.game.row / 2);
            
            // Thêm vị trí trung tâm
            moves.push(`${centerX}:${centerY}`);
            
            // Thêm các vị trí xung quanh trung tâm với khoảng cách khác nhau
            const distances = [1, 2, 3];
            for (const distance of distances) {
                for (let i = -distance; i <= distance; i++) {
                    for (let j = -distance; j <= distance; j++) {
                        if (Math.abs(i) === distance || Math.abs(j) === distance) {
                            const x = centerX + i;
                            const y = centerY + j;
                            if (this.game.isValidCoordinate(`${x}:${y}`)) {
                                moves.push(`${x}:${y}`);
                            }
                        }
                    }
                }
            }
            
            // Thêm một số vị trí ngẫu nhiên xa trung tâm
            const randomPositions = 5;
            for (let i = 0; i < randomPositions; i++) {
                const x = Math.floor(Math.random() * this.game.column);
                const y = Math.floor(Math.random() * this.game.row);
                const cell = `${x}:${y}`;
                if (this.game.isValidCoordinate(cell) && !moves.includes(cell)) {
                    moves.push(cell);
                }
            }
            
            return moves;
        }

        // Tìm các điểm giao của các pattern có thể thắng
        const winningPatterns = patterns.filter(pattern => this.canDevelopIntoWinningLine(pattern));
        const intersections = this.findPatternIntersections(winningPatterns);
        
        // Ưu tiên các điểm giao
        for (const intersection of intersections) {
            if (this.game.checkCellAvailable(intersection)) {
                moves.push(intersection);
            }
        }

        // Tìm các vị trí tạo nhiều đường tấn công
        for (const pattern of patterns) {
            const potentialMoves = this.findMovesForPattern(pattern);
            moves.push(...potentialMoves);
        }

        // Tìm các vị trí chặn đường phát triển của đối thủ
        const competitorPatterns = this.findThreateningPatterns(competitorCellList);
        const competitorIntersections = this.findPatternIntersections(competitorPatterns);
        
        // Ưu tiên chặn điểm giao
        for (const intersection of competitorIntersections) {
            if (this.game.checkCellAvailable(intersection)) {
                moves.push(intersection);
            }
        }

        // Tìm các nước đi chặn
        for (const pattern of competitorPatterns) {
            const blockingMoves = this.findBlockingMoves(pattern);
            moves.push(...blockingMoves);
        }

        // Thêm các nước đi ngẫu nhiên xung quanh các quân đã đánh
        if (moves.length < 5) {
            const randomMoves = this.findRandomMoves(myCellList);
            moves.push(...randomMoves);
        }

        return [...new Set(moves)];
    }

    // Tìm các nước đi ngẫu nhiên xung quanh các quân đã đánh
    findRandomMoves(cellList) {
        const moves = [];
        const directions = [
            [-1,-1], [-1,0], [-1,1],
            [0,-1],          [0,1],
            [1,-1],  [1,0],  [1,1]
        ];

        for (const cell of cellList) {
            const [x, y] = cell.split(':').map(Number);
            for (const [dx, dy] of directions) {
                const newX = x + dx;
                const newY = y + dy;
                const newCell = `${newX}:${newY}`;
                
                if (this.game.isValidCoordinate(newCell) && 
                    this.game.checkCellAvailable(newCell) &&
                    Math.random() < 0.3) { // 30% xác suất thêm mỗi nước đi
                    moves.push(newCell);
                }
            }
        }

        return moves;
    }

    // Tìm tất cả các điểm giao giữa các pattern
    findPatternIntersections(patterns) {
        const intersections = new Set();
        
        for (let i = 0; i < patterns.length; i++) {
            for (let j = i + 1; j < patterns.length; j++) {
                const commonPoints = this.findCommonEmptyPoints(patterns[i], patterns[j]);
                commonPoints.forEach(point => intersections.add(point));
            }
        }
        
        return Array.from(intersections);
    }

    // Tìm các điểm trống chung giữa hai đường
    findCommonEmptyPoints(line1, line2) {
        const commonPoints = [];
        
        for (const cell of line1) {
            if (line2.includes(cell) && this.game.checkCellAvailable(cell)) {
                commonPoints.push(cell);
            }
        }
        
        return commonPoints;
    }

    // Tìm các pattern đe dọa
    findThreateningPatterns(cellList) {
        const patterns = [];
        const lines = this.game.getLinesByList(0, cellList, this.game.winningLineLength - 2, true);
        
        for (const lineIndex of lines) {
            const line = this.game.lines[0][lineIndex];
            if (this.isThreateningPattern(line, cellList)) {
                patterns.push(line);
            }
        }
        
        return patterns;
    }

    // Kiểm tra một pattern có đe dọa không
    isThreateningPattern(line, cellList) {
        const emptyCells = line.filter(cell => this.game.checkCellAvailable(cell));
        const occupiedCells = line.filter(cell => cellList.includes(cell));
        
        // Pattern đe dọa khi có ít nhất 2 quân và 2 ô trống liền kề
        return occupiedCells.length >= 2 && emptyCells.length >= 2 && this.areCellsConnected(occupiedCells);
    }

    // Kiểm tra các quân có liền kề nhau không
    areCellsConnected(cells) {
        if (cells.length < 2) return true;
        
        cells.sort((a, b) => {
            const [ax, ay] = a.split(':').map(Number);
            const [bx, by] = b.split(':').map(Number);
            return ax === bx ? ay - by : ax - bx;
        });

        for (let i = 1; i < cells.length; i++) {
            const [prevX, prevY] = cells[i-1].split(':').map(Number);
            const [currX, currY] = cells[i].split(':').map(Number);
            
            if (Math.abs(currX - prevX) > 1 || Math.abs(currY - prevY) > 1) {
                return false;
            }
        }
        
        return true;
    }

    // Tìm các nước đi tốt nhất từ dữ liệu đã học
    findBestLearnedMoves(myCellList) {
        const availableMoves = [];
        
        // Lọc các nước đi có trong dữ liệu học
        Object.keys(this.learningData.winningMoves).forEach(key => {
            const [coord] = key.split('|');
            if (this.game.checkCellAvailable(coord)) {
                const score = this.learningData.winningMoves[key];
                availableMoves.push({ coord, score });
            }
        });

        if (availableMoves.length === 0) return null;

        // Sắp xếp theo điểm số
        availableMoves.sort((a, b) => b.score - a.score);
        return availableMoves.slice(0, 3).map(m => m.coord);
    }

    /**
     * Kiểm tra người thắng
     * @param {Array} myCellList - Danh sách ô của người chơi hiện tại
     * @param {Array} competitorCellList - Danh sách ô của đối thủ
     * @returns {boolean} Có thắng hay không
     */
    checkWinner(myCellList, competitorCellList = this.game.getCompetitorCells()) {
        return this.game.checkWinner(myCellList, competitorCellList);
    }

    /**
     * Đánh giá điểm của một nước đi
     * @param {string} cell ô cần đánh giá
     * @param {array} cellList danh sách ô đã đánh
     * @param {boolean} isUrgent nước đi khẩn cấp
     * @returns {number} điểm đánh giá
     */
    evaluateMove(cell, cellList, isUrgent = false) {
        let score = 0;
        
        // Kiểm tra chiến thắng
        const tempList = [...cellList, cell];
        const competitorCellList = this.game.turn === 'computer' ? 
            this.game.playerCells : this.game.computerCells;
        if (this.checkWinner(tempList, competitorCellList)) {
            score += this.WINNING_SCORE;
        }

        // Đánh giá vị trí chiến lược
        score += this.evaluatePosition(cell);
        
        // Đánh giá mối đe dọa
        score += this.evaluateThreats(cell, tempList);
        
        // Học từ kinh nghiệm với trọng số cao hơn
        const key = this.getPositionKey(cell);
        if (this.learningData.winningMoves[key]) {
            score += this.learningData.winningMoves[key] * this.LEARNING_WEIGHT;
        }

        // Thêm yếu tố ngẫu nhiên vào điểm số (giảm ảnh hưởng)
        const randomFactor = 0.9 + Math.random() * 0.2; // Random từ 0.9 đến 1.1
        score *= randomFactor;

        // Điều chỉnh theo level
        score *= (this.game.level / 3);

        // Giảm điểm cho các ô biên nếu không khẩn cấp
        if (!isUrgent && this.game.isBorderCell(cell)) {
            score += this.BORDER_PENALTY;
        }

        return score;
    }

    // Đánh giá vị trí chiến lược
    evaluatePosition(cell) {
        let score = 0;
        const [x, y] = cell.split(':').map(Number);
        
        // Ưu tiên vị trí trung tâm
        const centerX = Math.floor(this.game.column / 2);
        const centerY = Math.floor(this.game.row / 2);
        const distanceFromCenter = Math.abs(x - centerX) + Math.abs(y - centerY);
        score -= distanceFromCenter * 2;

        // Đánh giá khả năng phát triển
        const developmentPotential = this.evaluateDevelopmentPotential(cell);
        score += developmentPotential * 5;

        return score;
    }

    // Đánh giá khả năng phát triển từ một vị trí
    evaluateDevelopmentPotential(cell) {
        let potential = 0;
        const [x, y] = cell.split(':').map(Number);
        
        // Kiểm tra 8 hướng
        const directions = [
            [-1,-1], [-1,0], [-1,1],
            [0,-1],          [0,1],
            [1,-1],  [1,0],  [1,1]
        ];

        for (const [dx, dy] of directions) {
            let count = 0;
            // Kiểm tra 4 ô liên tiếp theo hướng
            for (let i = 1; i <= this.game.winningLineLength; i++) {
                const newX = x + dx * i;
                const newY = y + dy * i;
                const coord = `${newX}:${newY}`;
                
                if (!this.game.isValidCoordinate(coord)) break;
                if (!this.game.checkCellAvailable(coord)) break;
                count++;
            }
            potential += count;
        }

        return potential;
    }

    // Đánh giá các mối đe dọa
    evaluateThreats(cell, cellList) {
        let score = 0;
        const competitorCells = this.game.turn === 'computer' ? 
            this.game.playerCells : this.game.computerCells;
        
        // Đánh giá các đường có thể thắng
        const winningLines = this.game.getLinesByList(0, cellList, this.game.winningLineLength - 1, true);
        score += winningLines.length * this.THREAT_SCORE;

        // Tìm các điểm giao của các đường thắng
        const winningIntersections = this.findWinningLineIntersections(winningLines);
        if (winningIntersections.includes(cell)) {
            score += this.WINNING_SCORE * 2; // Tăng điểm cho điểm giao của đường thắng
        }

        // Đánh giá các pattern đe dọa
        const threateningPatterns = this.findThreateningPatterns(competitorCells);
        const intersectingThreats = this.findIntersectingThreats(threateningPatterns);
        
        // Tăng điểm cho các mối đe dọa giao nhau
        for (const intersection of intersectingThreats) {
            if (intersection.point === cell) {
                const threatLevel = this.evaluateIntersectionThreat(intersection, competitorCells);
                score += threatLevel * 3; // Tăng gấp 3 lần điểm cho điểm giao
            }
        }

        // Đánh giá từng pattern riêng lẻ
        for (const pattern of threateningPatterns) {
            const threatLevel = this.evaluatePatternThreat(pattern, competitorCells);
            score += threatLevel;
        }

        return score;
    }

    // Tìm các điểm giao của các đường thắng
    findWinningLineIntersections(winningLineIndices) {
        const intersections = new Set();
        
        for (let i = 0; i < winningLineIndices.length; i++) {
            const line1 = this.game.lines[0][winningLineIndices[i]];
            for (let j = i + 1; j < winningLineIndices.length; j++) {
                const line2 = this.game.lines[0][winningLineIndices[j]];
                
                // Tìm các điểm giao giữa hai đường
                const commonPoints = this.findCommonEmptyPoints(line1, line2);
                commonPoints.forEach(point => intersections.add(point));
            }
        }
        
        return Array.from(intersections);
    }

    // Đánh giá mức độ nguy hiểm của điểm giao
    evaluateIntersectionThreat(intersection, competitorCells) {
        let threatLevel = 0;
        const { point, patterns } = intersection;

        // Đánh giá từng pattern tại điểm giao
        for (const pattern of patterns) {
            const patternThreat = this.evaluatePatternThreat(pattern, competitorCells);
            threatLevel += patternThreat;

            // Kiểm tra xem pattern có khả năng thắng không
            if (this.canDevelopIntoWinningLine(pattern)) {
                threatLevel *= 2; // Tăng mức độ nguy hiểm nếu pattern có thể thắng
            }
        }

        // Tăng điểm cho điểm giao vì nó ảnh hưởng đến nhiều pattern
        threatLevel *= 3;

        // Kiểm tra xem điểm giao có nằm trên đường thắng tiềm năng không
        const potentialWinningLines = this.findPotentialWinningLines(point);
        if (potentialWinningLines.length > 0) {
            threatLevel *= 2;
        }

        return threatLevel;
    }

    // Tìm các đường có khả năng thắng đi qua một điểm
    findPotentialWinningLines(point) {
        const lines = [];
        const allLines = this.game.lines[0];
        
        for (let i = 0; i < allLines.length; i++) {
            const line = allLines[i];
            if (line.includes(point)) {
                // Kiểm tra xem đường này có khả năng thắng không
                if (this.canDevelopIntoWinningLine(line)) {
                    lines.push(line);
                }
            }
        }
        
        return lines;
    }

    // Tìm các điểm giao nhau giữa các pattern đe dọa
    findIntersectingThreats(patterns) {
        const intersections = [];
        
        for (let i = 0; i < patterns.length; i++) {
            for (let j = i + 1; j < patterns.length; j++) {
                const intersection = this.findPatternIntersection(patterns[i], patterns[j]);
                if (intersection) {
                    intersections.push({
                        point: intersection,
                        patterns: [patterns[i], patterns[j]]
                    });
                }
            }
        }
        
        return intersections;
    }

    // Tìm điểm giao nhau giữa hai pattern
    findPatternIntersection(pattern1, pattern2) {
        for (const cell of pattern1) {
            if (pattern2.includes(cell)) {
                return cell;
            }
        }
        return null;
    }

    // Kiểm tra xem một pattern có bị chặn không
    isPatternBlocked(pattern) {
        if (!pattern || pattern.length === 0) return true;

        const startCell = pattern[0];
        const endCell = pattern[pattern.length - 1];
        
        // Kiểm tra xem hai đầu pattern có bị chặn không
        const isStartBlocked = this.isCellBlocked(startCell);
        const isEndBlocked = this.isCellBlocked(endCell);
        
        // Nếu cả hai đầu đều bị chặn, pattern bị chặn
        if (isStartBlocked && isEndBlocked) return true;

        // Nếu pattern nằm ở biên và đầu còn lại bị chặn
        if (this.isPatternAtBorder(pattern)) {
            if (isStartBlocked || isEndBlocked) return true;
        }

        // Kiểm tra xem pattern có bị chặn ở giữa không
        const middleCells = pattern.slice(1, -1);
        const isMiddleBlocked = middleCells.some(cell => this.isCellBlocked(cell));
        if (isMiddleBlocked) return true;

        return false;
    }

    // Kiểm tra xem một ô có bị chặn không
    isCellBlocked(cell) {
        const competitorCells = this.game.turn === 'computer' ? 
            this.game.playerCells : this.game.computerCells;
        return competitorCells.includes(cell);
    }

    // Kiểm tra xem một pattern có nằm ở biên không
    isPatternAtBorder(pattern) {
        return pattern.some(cell => this.game.isBorderCell(cell));
    }

    // Kiểm tra xem một ô có bị chặn hiệu quả không
    isEffectivelyBlocked(cell, pattern) {
        // Kiểm tra xem ô có bị đối thủ chiếm không
        if (this.isCellBlocked(cell)) {
            return true;
        }

        // Kiểm tra xem ô có nằm ở biên không
        if (this.game.isBorderCell(cell)) {
            // Lấy hàng cha của pattern
            const fatherLine = this.getFatherLineForPattern(pattern);
            if (!fatherLine) return false;

            // Kiểm tra xem có thể phát triển qua biên không
            const borderIndex = fatherLine.indexOf(cell);
            if (borderIndex === 0 || borderIndex === fatherLine.length - 1) {
                return true;
            }
        }

        return false;
    }

    // Kiểm tra xem một pattern đã bị chặn hiệu quả chưa
    isPatternEffectivelyBlocked(pattern) {
        if (!pattern || pattern.length === 0) return true;

        const startCell = pattern[0];
        const endCell = pattern[pattern.length - 1];
        
        // Kiểm tra xem hai đầu pattern có bị chặn không
        const isStartBlocked = this.isCellBlocked(startCell);
        const isEndBlocked = this.isCellBlocked(endCell);
        
        // Nếu cả hai đầu đều bị chặn, pattern bị chặn
        if (isStartBlocked && isEndBlocked) return true;

        // Nếu pattern nằm ở biên và đầu còn lại bị chặn
        if (this.isPatternAtBorder(pattern)) {
            if (isStartBlocked || isEndBlocked) return true;
        }

        // Kiểm tra xem pattern có bị chặn ở giữa không
        const middleCells = pattern.slice(1, -1);
        const isMiddleBlocked = middleCells.some(cell => this.isCellBlocked(cell));
        if (isMiddleBlocked) return true;

        return false;
    }

    // Lấy hàng cha của một đường
    getFatherLine(index) {
        const line = this.game.lines[0][index];
        if (!line) return null;

        const startCell = line[0];
        const endCell = line[line.length - 1];
        const [startX, startY] = startCell.split(':').map(Number);
        const [endX, endY] = endCell.split(':').map(Number);

        // Xác định hướng của đường
        const dx = endX - startX;
        const dy = endY - startY;
        const length = Math.max(Math.abs(dx), Math.abs(dy));

        // Tính toán vector đơn vị
        const ux = dx / length;
        const uy = dy / length;

        // Tạo hàng cha bằng cách mở rộng đường hiện tại
        const fatherLine = [];
        let x = startX;
        let y = startY;

        // Thêm các ô phía trước
        while (this.isValidCoordinate(`${x-ux}:${y-uy}`)) {
            x -= ux;
            y -= uy;
            fatherLine.unshift(`${Math.round(x)}:${Math.round(y)}`);
        }

        // Thêm đường hiện tại
        fatherLine.push(...line);

        // Thêm các ô phía sau
        x = endX;
        y = endY;
        while (this.isValidCoordinate(`${x+ux}:${y+uy}`)) {
            x += ux;
            y += uy;
            fatherLine.push(`${Math.round(x)}:${Math.round(y)}`);
        }

        return fatherLine;
    }

    // Kiểm tra xem một tọa độ có hợp lệ không
    isValidCoordinate(coord) {
        return this.game.isValidCoordinate(coord);
    }

    // Kiểm tra xem một pattern có thể phát triển thành đường thắng không
    canDevelopIntoWinningLine(pattern) {
        // Lấy hàng cha của pattern
        const fatherLine = this.getFatherLineForPattern(pattern);
        if (!fatherLine) return false;

        // Đếm số ô trống và số ô của ta trong hàng cha
        let emptyCount = 0;
        let myCount = 0;
        const competitorCells = this.game.turn === 'computer' ? 
            this.game.playerCells : this.game.computerCells;

        for (const cell of fatherLine) {
            if (this.game.checkCellAvailable(cell)) {
                emptyCount++;
            } else if (!competitorCells.includes(cell)) {
                myCount++;
            }
        }

        // Kiểm tra xem có đủ ô để phát triển thành đường thắng không
        return (emptyCount + myCount) >= this.game.winningLineLength;
    }

    // Lấy hàng cha cho một pattern
    getFatherLineForPattern(pattern) {
        if (!pattern || pattern.length === 0) return null;

        const startCell = pattern[0];
        const endCell = pattern[pattern.length - 1];
        const [startX, startY] = startCell.split(':').map(Number);
        const [endX, endY] = endCell.split(':').map(Number);

        // Xác định hướng của pattern
        const dx = endX - startX;
        const dy = endY - startY;
        const length = Math.max(Math.abs(dx), Math.abs(dy));

        // Tính toán vector đơn vị
        const ux = dx / length;
        const uy = dy / length;

        // Tạo hàng cha bằng cách mở rộng pattern
        const fatherLine = [];
        let x = startX;
        let y = startY;

        // Thêm các ô phía trước
        while (this.isValidCoordinate(`${x-ux}:${y-uy}`)) {
            x -= ux;
            y -= uy;
            fatherLine.unshift(`${Math.round(x)}:${Math.round(y)}`);
        }

        // Thêm pattern hiện tại
        fatherLine.push(...pattern);

        // Thêm các ô phía sau
        x = endX;
        y = endY;
        while (this.isValidCoordinate(`${x+ux}:${y+uy}`)) {
            x += ux;
            y += uy;
            fatherLine.push(`${Math.round(x)}:${Math.round(y)}`);
        }

        return fatherLine;
    }

    // Kiểm tra xem một hàng có chứa pattern không
    containsPattern(line, pattern) {
        if (!line || !pattern || line.length < pattern.length) return false;
        
        const patternStr = pattern.join(',');
        const lineStr = line.join(',');
        return lineStr.includes(patternStr);
    }

    /**
     * Tìm các nước đi có thể dẫn đến chiến thắng
     * @param {array} cellList danh sách ô đã đánh
     * @returns {array} danh sách ô có thể thắng
     */
    findWinningMoves(cellList, competitorCellList = this.game.getCompetitorCells()) {
        return this.game.getWinningMoves(cellList, competitorCellList);
    }

    /**
     * Tìm các nước đi tấn công
     * @param {array} cellList danh sách ô đã đánh
     * @returns {array} danh sách ô tấn công
     */
    findAttackMoves(cellList) {
        var moves = [];
        var lines = this.game.getLinesByList(0, cellList, this.game.winningLineLength - 2, true);
        
        for (var i = 0; i < lines.length; i++) {
            var line = this.game.lines[0][lines[i]];
            var emptyCells = [];
            
            for (var j = 0; j < line.length; j++) {
                if (this.game.checkCellAvailable(line[j])) {
                    emptyCells.push(line[j]);
                }
            }
            
            if (emptyCells.length >= 2) {
                moves = moves.concat(emptyCells);
            }
        }
        return moves;
    }

    /**
     * Tìm các nước đi phòng thủ
     * @param {array} cellList danh sách ô đã đánh
     * @returns {array} danh sách ô phòng thủ
     */
    findDefenseMoves(cellList) {
        const moves = [];
        // Tìm các đường có thể thắng của đối thủ
        const lines = this.game.getLinesByList(0, cellList, this.game.winningLineLength - 1, true);
        
        for (const lineIndex of lines) {
            const line = this.game.lines[0][lineIndex];
            // Đếm số quân của đối thủ trong đường
            let opponentCount = 0;
            let emptyCells = [];
            
            for (const cell of line) {
                if (cellList.includes(cell)) {
                    opponentCount++;
                } else if (this.game.checkCellAvailable(cell)) {
                    emptyCells.push(cell);
                }
            }
            
            // Nếu đường có ít nhất 2 quân của đối thủ và có ô trống
            if (opponentCount >= 2 && emptyCells.length > 0) {
                moves.push(...emptyCells);
            }
        }
        
        return [...new Set(moves)];
    }

    // Tìm các nước đi chặn quan trọng
    findCriticalBlockingMoves(pattern) {
        const moves = [];
        const fatherLine = this.getFatherLineForPattern(pattern);
        if (!fatherLine) return moves;

        // Tìm các ô trống trong hàng cha có thể dẫn đến chiến thắng
        for (const cell of fatherLine) {
            if (!this.game.checkCellAvailable(cell)) continue;

            // Kiểm tra xem nước đi này có ngăn chặn chiến thắng không
            const tempList = [...this.game.computerCells, cell];
            if (this.checkWinner(tempList)) {
                moves.push(cell);
            }
        }

        return moves;
    }

    // Tìm các nước đi chặn hiệu quả
    findEffectiveBlockingMoves(pattern) {
        const moves = [];
        const fatherLine = this.getFatherLineForPattern(pattern);
        if (!fatherLine) return moves;

        // Tìm các ô trống có thể chặn hiệu quả
        for (const cell of fatherLine) {
            if (!this.game.checkCellAvailable(cell)) continue;

            // Kiểm tra xem nước đi này có hiệu quả không
            if (this.isEffectiveBlockingMove(cell, pattern)) {
                moves.push(cell);
            }
        }

        return moves;
    }

    // Tìm các nước đi chặn cho một pattern
    findBlockingMoves(pattern) {
        const moves = [];
        if (!pattern || pattern.length === 0) return moves;

        // Đếm số quân của đối thủ trong pattern
        const competitorCells = this.game.turn === 'computer' ? 
            this.game.playerCells : this.game.computerCells;
        const opponentCount = pattern.filter(cell => competitorCells.includes(cell)).length;

        // Nếu pattern có ít nhất 2 quân của đối thủ
        if (opponentCount >= 2) {
            // Tìm các ô trống trong pattern
            const emptyCells = pattern.filter(cell => this.game.checkCellAvailable(cell));
            
            // Nếu có ô trống, thêm vào danh sách nước đi chặn
            if (emptyCells.length > 0) {
                moves.push(...emptyCells);
            }
        }

        // Tìm các ô trống ở hai đầu pattern
        const startCell = pattern[0];
        const endCell = pattern[pattern.length - 1];
        
        // Kiểm tra và thêm các ô trống ở hai đầu
        if (this.game.checkCellAvailable(startCell)) {
            moves.push(startCell);
        }
        if (this.game.checkCellAvailable(endCell)) {
            moves.push(endCell);
        }

        // Nếu pattern gần thắng (có 4 quân), ưu tiên chặn
        if (opponentCount >= this.game.winningLineLength - 1) {
            const fatherLine = this.getFatherLineForPattern(pattern);
            if (fatherLine) {
                for (const cell of fatherLine) {
                    if (this.game.checkCellAvailable(cell)) {
                        moves.push(cell);
                    }
                }
            }
        }

        return [...new Set(moves)];
    }

    // Kiểm tra xem một nước đi chặn có thừa không
    isRedundantBlock(cell, pattern) {
        // Kiểm tra xem ô đã bị chặn chưa
        if (this.isCellBlocked(cell)) return true;

        // Kiểm tra xem pattern đã bị chặn ở đầu kia chưa
        const startCell = pattern[0];
        const endCell = pattern[pattern.length - 1];
        if (cell === startCell && this.isCellBlocked(endCell)) return true;
        if (cell === endCell && this.isCellBlocked(startCell)) return true;

        // Kiểm tra xem có nước đi chặn hiệu quả hơn không
        const fatherLine = this.getFatherLineForPattern(pattern);
        if (!fatherLine) return false;

        // Tìm các nước đi chặn khác trong hàng cha
        const otherBlockingMoves = fatherLine.filter(c => 
            c !== cell && 
            this.game.checkCellAvailable(c) && 
            this.isEffectiveBlockingMove(c, pattern)
        );

        // Nếu có nước đi chặn khác hiệu quả hơn, nước đi này thừa
        return otherBlockingMoves.some(otherMove => 
            this.isBetterBlockingMove(otherMove, cell, pattern)
        );
    }

    // Kiểm tra xem một nước đi có hiệu quả không
    isEffectiveMove(move, pattern) {
        // Kiểm tra xem nước đi có nằm trong hàng cha không
        const fatherLine = this.getFatherLineForPattern(pattern);
        if (!fatherLine) return false;

        // Kiểm tra xem nước đi có tạo được đường thắng không
        const tempList = [...this.game.computerCells, move];
        if (this.checkWinner(tempList)) return true;

        // Kiểm tra xem nước đi có tạo được đường tấn công không
        if (this.isThreateningPattern(pattern, tempList)) {
            // Kiểm tra xem đường tấn công có bị chặn không
            const isBlocked = this.isPatternBlocked(pattern, tempList);
            if (!isBlocked) return true;
        }

        return false;
    }

    // Kiểm tra xem một nước đi chặn có hiệu quả không
    isEffectiveBlockingMove(move, pattern) {
        // Kiểm tra xem nước đi có nằm trong hàng cha không
        const fatherLine = this.getFatherLineForPattern(pattern);
        if (!fatherLine) return false;

        // Kiểm tra xem nước đi có ngăn chặn được đường thắng không
        const competitorCells = this.game.turn === 'computer' ? 
            this.game.playerCells : this.game.computerCells;
        const tempList = [...competitorCells, move];

        // Nếu nước đi này ngăn chặn được chiến thắng
        if (this.checkWinner(tempList)) {
            // Kiểm tra xem có nước đi khác đã chặn hiệu quả chưa
            const otherBlockingMoves = this.findExistingBlockingMoves(pattern);
            if (otherBlockingMoves.length === 0) {
                return true;
            }

            // Nếu đã có nước chặn khác, chỉ chặn nếu nước này tốt hơn
            return this.isBetterBlockingMove(move, otherBlockingMoves[0], pattern);
        }

        return false;
    }

    // Tìm các nước đi chặn đã tồn tại
    findExistingBlockingMoves(pattern) {
        const moves = [];
        const fatherLine = this.getFatherLineForPattern(pattern);
        if (!fatherLine) return moves;

        // Kiểm tra các ô đã đánh của ta trong hàng cha
        const myCells = this.game.turn === 'computer' ? 
            this.game.computerCells : this.game.playerCells;

        for (const cell of fatherLine) {
            if (myCells.includes(cell)) {
                moves.push(cell);
            }
        }

        return moves;
    }

    // So sánh hai nước đi chặn
    isBetterBlockingMove(newMove, existingMove, pattern) {
        // Đánh giá vị trí của các nước đi
        const newMoveScore = this.evaluateBlockingPosition(newMove, pattern);
        const existingMoveScore = this.evaluateBlockingPosition(existingMove, pattern);

        return newMoveScore > existingMoveScore;
    }

    // Đánh giá vị trí của nước đi chặn
    evaluateBlockingPosition(move, pattern) {
        let score = 0;

        // Đánh giá khoảng cách đến trung tâm pattern
        const patternCenter = Math.floor(pattern.length / 2);
        const moveIndex = pattern.indexOf(move);
        if (moveIndex !== -1) {
            score += (pattern.length - Math.abs(moveIndex - patternCenter));
        }

        // Đánh giá số pattern bị chặn bởi nước đi này
        const blockedPatterns = this.countBlockedPatterns(move);
        score += blockedPatterns * 10;

        // Đánh giá khả năng phát triển sau nước đi này
        const developmentPotential = this.evaluateDevelopmentPotential(move);
        score += developmentPotential;

        return score;
    }

    // Đếm số pattern bị chặn bởi một nước đi
    countBlockedPatterns(move) {
        let count = 0;
        const competitorCells = this.game.turn === 'computer' ? 
            this.game.playerCells : this.game.computerCells;

        // Lấy tất cả các pattern có thể của đối thủ
        const patterns = this.findThreateningPatterns(competitorCells);

        // Đếm số pattern chứa nước đi này
        for (const pattern of patterns) {
            if (pattern.includes(move)) {
                count++;
            }
        }

        return count;
    }

    // Tìm các nước đi có thể cho một pattern
    findMovesForPattern(pattern) {
        const moves = [];
        const fatherLine = this.getFatherLineForPattern(pattern);
        if (!fatherLine) return moves;

        // Tìm các ô trống trong hàng cha
        for (const cell of fatherLine) {
            if (!this.game.checkCellAvailable(cell)) continue;

            // Kiểm tra xem nước đi này có hiệu quả không
            if (this.isEffectiveMove(cell, pattern)) {
                moves.push(cell);
            }
        }

        return moves;
    }

    // Đánh giá mức độ nguy hiểm của một pattern
    evaluatePatternThreat(pattern, competitorCells) {
        let threatLevel = 0;
        if (!pattern || pattern.length === 0) return threatLevel;

        // Đếm số quân của đối thủ trong pattern
        const opponentCount = pattern.filter(cell => competitorCells.includes(cell)).length;
        
        // Đánh giá dựa trên số quân
        if (opponentCount >= this.game.winningLineLength - 1) {
            // Pattern gần thắng
            threatLevel += this.THREAT_SCORE * 2;
        } else if (opponentCount >= this.game.winningLineLength - 2) {
            // Pattern có tiềm năng
            threatLevel += this.THREAT_SCORE;
        }

        // Kiểm tra xem pattern có bị chặn không
        const isBlocked = this.isPatternBlocked(pattern);
        if (isBlocked) {
            threatLevel /= 2; // Giảm mức độ nguy hiểm nếu pattern bị chặn
        }

        // Kiểm tra xem pattern có nằm ở biên không
        if (this.isPatternAtBorder(pattern)) {
            threatLevel *= 0.8; // Giảm mức độ nguy hiểm nếu pattern nằm ở biên
        }

        // Kiểm tra xem pattern có thể phát triển thành đường thắng không
        if (this.canDevelopIntoWinningLine(pattern)) {
            threatLevel *= 2; // Tăng mức độ nguy hiểm nếu pattern có thể thắng
        }

        // Kiểm tra xem pattern có nằm gần các quân đã có không
        const nearbyOccupied = pattern.some((cell, index) => {
            if (index > 0 && competitorCells.includes(pattern[index - 1])) return true;
            if (index < pattern.length - 1 && competitorCells.includes(pattern[index + 1])) return true;
            return false;
        });

        if (nearbyOccupied) {
            threatLevel *= 1.2; // Tăng điểm nếu gần các quân đã có
        }

        return threatLevel;
    }
}

export default C5_Demo; 
