import CorrectFiveGame from "../core/CorrectFiveGame";
import { dualLoop } from "../core/utils";
import BaseModel from "./base-model";

const ROLLOUT_WIN_SCORE = 1000000;

class BOT_Origin extends BaseModel {
    // Thông tin cơ bản về model
    static NAME = 'BOT_Origin';
    static VERSION = '3.0.0';
    static AUTHOR = 'Le Ngoc Doan';
    static DESCRIPTION = 'Thuật toán gốc: nước quan trọng, giao điểm và mô phỏng, có kiểm tra thắng/chặn';
    static COPYRIGHT = 'Copyright 2024 Le Ngoc Doan';
    static LICENSE = 'MIT';
    static WEBSITE = 'https://example.com';
    static RULES = [
        'Hỗ trợ bàn tùy chỉnh và đoạn 4, 5 hoặc 6 quân',
        'Đoạn N thắng nếu hai ô sát đầu không có đối thủ',
        'Quân cùng màu ngoài đoạn và biên bàn không chặn thắng',
        'Thắng/chặn trước, rồi tìm giao điểm và mô phỏng các ứng viên an toàn',
    ];

    // Tham chiếu đến game instance
    /**
     * @type {CorrectFiveGame}
     */
    game = null;

    showLog = false;

    constructor(game) {
        super();
        this.game = game;
    }

    /**
     * Gọi hàm getSuggest để lấy nước đi gợi ý
     * @param {array} myCellList Danh sách ô của người chơi hiện tại
     * @returns {array} Danh sách các ô gợi ý
     */
    suggest(myCellList) {
        if (!this.game) return [];
        const cells = myCellList || this.game.getCurrentPlayerCells();
        const opponents = this.game.getCompetitorCells();
        // Forced play uses the shared referee and ranks defenses by initiative.
        if (this.game.getTacticalMoves(cells,opponents).length || (!cells.length && !opponents.length)) {
            return this.game.getStrategicMoves(cells,opponents,this.game.level);
        }
        const legacy = this.getSuggestWithoutReviews(cells,opponents,this.game.level);
        // Preserve the original early-game exploration. With at most two stones
        // per side and N>=4, neither side can win immediately or create a true
        // crossing fork in one move; forcing play was already checked above.
        if (cells.length<=2 && opponents.length<=2) return legacy;
        const safe = this.game.getStrategicMoves(cells,opponents,this.game.level,'balanced',legacy);
        if (safe.length<=1) return safe;
        return this.getTopReviewMoves(cells,opponents,safe);
    }

    /**
     * Tìm các nước đi gợi ý
     * Thuật toán:
     * 1. Lấy danh sách các nước đi thông thường từ getSuggestWithoutReviews
     * 2. Đánh giá và chọn các nước đi tốt nhất từ getTopReviewMoves
     * @param {array} myCellList Danh sách ô của người chơi hiện tại
     * @returns {array} Danh sách các ô gợi ý
     */
    getSuggest(myCellList) {
        return this.suggest(myCellList);
    }

    /**
     * Lấy danh sách các nước đi đã được đánh giá
     * Thuật toán:
     * 1. Mô phỏng các nước đi và tính điểm
     * 2. Sắp xếp theo điểm giảm dần
     * 3. Xử lý các trường hợp đặc biệt
     * @param {array} myCellList Danh sách ô của người chơi
     * @param {array} competitorCellList Danh sách ô của đối thủ
     * @param {array} moveList Danh sách các nước đi cần đánh giá
     * @returns {array} Danh sách các ô được đánh giá cao
     */
    getTopReviewMoves(myCellList, competitorCellList, moveList) {
        if (!this.game || !moveList.length) return [];
        if (myCellList.length <= 2 && competitorCellList.length <= 2) {
            return moveList;
        }


        // Bước 1: Mô phỏng các nước đi và tính điểm
        const pointMap = this.simulateMove(myCellList, competitorCellList, moveList, this.game.level * 3);
        // if (this.showLog) console.log('pointMap', pointMap);
        // Bước 2: Sắp xếp theo điểm giảm dần
        let sortedArray = Object.entries(pointMap)
            .map(([key, value]) => ({ key, value }))
            .sort((a, b) => b.value - a.value);

        // console.log("Best Score", sortedArray[0].value);
        let bestScore = sortedArray[0].value;
        // Keep the referee/search's safe pool even when all rollout scores are
        // poor. A random fallback outside it can reintroduce an avoidable loss.
        if (this.showLog) console.log('Best Move', sortedArray[0].key, bestScore);

        // Bước 3: Xử lý các trường hợp đặc biệt
        // Trường hợp 1: Ván đầu tiên
        // Trường hợp 3: Chỉ có một nước đi hoặc nước đi tốt nhất
        if (sortedArray.length === 1) {
            if (this.showLog) console.log('TH 3', sortedArray);
            return [sortedArray[0].key];
        }
        // Trường hợp 4: Tất cả các nước đi có điểm bằng nhau
        if(sortedArray[0].value === sortedArray[sortedArray.length - 1].value){
            if (this.showLog) console.log('TH 4', sortedArray);
            return sortedArray.slice(0).map(item => item.key);
        }
        // Trường hợp 5: Lấy 10 nước đi tốt nhất
        let maxValue = sortedArray[0].value;
        let ln = 0;
        for (let i = 0; i < sortedArray.length; i++) {
            if (sortedArray[i].value < maxValue) {
                if(maxValue - sortedArray[i].value > 10){
                    ln = i;
                    break;
                }
                else if(sortedArray[0].value - sortedArray[i].value > 30){
                    ln = i;
                    break;
                }
                else if(sortedArray[0].value - sortedArray[i].value < 10 && i >= sortedArray.length / 3 * 2 ){
                    ln = i;
                    break;
                }
                maxValue = sortedArray[i].value;
            }
        }
        if(this.showLog) console.log('ln', ln);
        
        if(ln > 0){
            return sortedArray.slice(0, ln).map(item => item.key);
        }
        // Trường hợp 6: Lấy 4 nước đi tốt nhất
        else{
            if(this.showLog) console.log('TH 6');
            return sortedArray.slice(0).map(item => item.key);
        }
        
    }
    /**
     * Tìm các nước đi thông thường
     * Thuật toán:
     * 1. Tìm nước đi quan trọng theo từng cấp độ
     * 2. Tìm nước đi giao nhau
     * 3. Tìm nước đi ngẫu nhiên nếu không có nước đi nào
     * @param {array} myList Danh sách ô của người chơi
     * @param {array} competitorList Danh sách ô của đối thủ
     * @param {number} level Cấp độ khó
     * @returns {array} Danh sách các ô gợi ý
     */
    getSuggestWithoutReviews(myList, competitorList, level) {
        const position=this.forPosition(myList,competitorList);
        const moves=position.getHeuristicMoves(myList,competitorList,level);
        const legal=[...new Set(moves || [])].filter(cell => position.game.checkCellAvailable(cell));
        return legal.length ? legal : position.game.getEmptyCells();
    }

    // Share board geometry, but evaluate occupancy from this simulated position.
    forPosition(myList, competitorList) {
        const position = Object.create(this.game);
        position.selectedCells = [...myList, ...competitorList];
        const occupied = new Set(position.selectedCells);
        position.emptyCells = Object.keys(position.cellData)
            .filter(cell => !occupied.has(cell));
        const model = new BOT_Origin(position);
        model.showLog = this.showLog;
        return model;
    }

    getHeuristicMoves(myList, competitorList, level) {
        if (!this.game) return [];
        const tacticalMoves = this.game.getTacticalMoves(myList, competitorList);
        if (tacticalMoves.length) return tacticalMoves;
        const WINNING_LINE_LENGTH = this.game.winningLineLength;
        const suggestList = [];
        // if(this.showLog) {
        //     console.log('myList', myList);
        //     console.log('competitorList', competitorList);
        // }
        // Bước 1: Tìm nước đi quan trọng theo từng cấp độ
        let max = WINNING_LINE_LENGTH < 6?level: (level < 3? level: level + 1);
        for (let i = 1; i <= max; i++) {
            // Tìm nước đi quan trọng cho người chơi
            this.log('myImportantMoves', i, level);
            const myImportantMoves = this.getImportantMoves(myList, competitorList, i, level);
            if (myImportantMoves && myImportantMoves.length > 0) {
                // if (this.showLog) console.log('myImportantMoves', myImportantMoves);

                if(i === 1 || (WINNING_LINE_LENGTH === 4 && i < 3) || (WINNING_LINE_LENGTH === 5 && i < 3) || (WINNING_LINE_LENGTH === 6)){
                    return myImportantMoves;
                }
                
                myImportantMoves.forEach(move => {
                    if (suggestList.indexOf(move) === -1) {
                        suggestList.push(move);
                    }
                });
                // break;
            }
            this.log('competitorImportantMoves', i, level);
            // Tìm nước đi quan trọng cho đối thủ
            const competitorImportantMoves = this.getImportantMoves(competitorList, myList, i, level);
            if (competitorImportantMoves && competitorImportantMoves.length > 0) {
                // if (this.showLog) console.log('competitorImportantMoves', competitorImportantMoves);
                if(i === 1 || (WINNING_LINE_LENGTH === 4 && i < 3) || (WINNING_LINE_LENGTH === 5 && i < 3) || (WINNING_LINE_LENGTH === 6)){
                    return competitorImportantMoves;
                }
                competitorImportantMoves.forEach(move => {
                    if (suggestList.indexOf(move) === -1) {
                        suggestList.push(move);
                    }
                });
                // break;
            }
        }

        // Trả về nếu đã tìm thấy nước đi quan trọng ở độ khó thấp
        if (suggestList.length > 0 && ((WINNING_LINE_LENGTH === 4 && level < 3) || (WINNING_LINE_LENGTH === 5 && level < 3) || (WINNING_LINE_LENGTH === 6))) {
            return suggestList;
        }

        // Bước 2: Tìm nước đi giao nhau
        // Tìm nước đi giao nhau cho người chơi
        const intersectingMoves = this.getIntersectingMoves(myList, competitorList);
        if (intersectingMoves && intersectingMoves.length > 0) {
            // if (this.showLog) console.log('intersectingMoves', intersectingMoves);
            if (level > 1) return intersectingMoves;
            intersectingMoves.forEach(move => {
                if (suggestList.indexOf(move) === -1) {
                    suggestList.push(move);
                }
            });
        }

        // Tìm nước đi giao nhau cho đối thủ
        const competitorIntersectingMoves = this.getIntersectingMoves(competitorList, myList);
        if (competitorIntersectingMoves && competitorIntersectingMoves.length > 0) {
            // if (this.showLog) console.log('competitorIntersectingMoves', competitorIntersectingMoves);
            if (level > 1) return competitorIntersectingMoves;
            competitorIntersectingMoves.forEach(move => {
                if (suggestList.indexOf(move) === -1) {
                    suggestList.push(move);
                }
            });
        }

        // Trả về nếu đã tìm thấy nước đi
        if (suggestList.length > 0) return suggestList;

        // Bước 3: Tìm nước đi ngẫu nhiên nếu không có nước đi nào
        const myRandomMoves = this.getRandomMoves(myList, competitorList);
        if (myRandomMoves && myRandomMoves.length > 0) {
            // if (this.showLog) console.log('myRandomMoves', myRandomMoves);
            return myRandomMoves;
        }

        return suggestList;
    }


    /**
     * Tìm các nước đi quan trọng
     * Thuật toán:
     * 1. Tìm các đường có thể thắng
     * 2. Xử lý đường mở rộng
     * 3. Xử lý đường biên
     * 4. Xử lý đường thông thường
     * @param {array} myCellList Danh sách ô của người chơi
     * @param {array} competitorCellList Danh sách ô của đối thủ
     * @param {number} safeLevel Mức độ an toàn (1-3)
     * @param {number} priority Độ ưu tiên (0-1)
     * @returns {String[]} Danh sách các ô quan trọng
     */
    getImportantMoves(myCellList, competitorCellList, safeLevel = 1, priority = 0) {
        if (!this.game) return [];
        const game = this.game;
        // Danh sách các nước đi quan trọng cần trả về
        let importantMoves = [];
        // Số ô tối đa cần để thắng trừ đi mức độ an toàn
        // Ví dụ: nếu cần 5 ô để thắng và safeLevel = 1, thì maxHard = 4
        const maxHard = game.winningLineLength - safeLevel;
        // Lấy danh sách các đường có thể thắng
        // Đường thắng là một dãy các ô liên tiếp có thể tạo thành 5 ô
        const myLines = game.getLinesByList(0, myCellList, maxHard > 2?maxHard: 2, true);
        this.log('myLines', safeLevel, myLines);
        if (myLines.length === 0) return null;
        // Nếu có đường có thể thắng
        // Duyệt qua từng đường
        dualLoop(myLines, (currentLineIndex, index, stop) => {
            const currentLine = game.lines[0][currentLineIndex];
            // Kiểm tra xem đường có nằm ở biên không (0: không, 1: một đầu, 2: cả hai đầu)
            const isInBorder = game.inBorder(0, currentLineIndex);
            // Danh sách các ô bị cấm không được đánh
            const bannedCells = [];
            // Đường cha là đường mở rộng của đường hiện tại
            // Ví dụ: nếu đường hiện tại là 12345, đường cha là 0123456
            const fatherLine = game.getFatherLine(currentLineIndex);
            this.log('fatherLine', safeLevel, fatherLine);
            let shouldSkipLine = false;
            // Loại đường (0: đường thông thường, 1: đường mở rộng)
            let lineType = 1;

            // Xử lý đường cha (đường mở rộng)
            if (fatherLine) {
                // Kiểm tra xem đường có bị chặn ở đầu không
                const isStartBlocked = competitorCellList.indexOf(fatherLine[0]) !== -1;
                const isEndBlocked = competitorCellList.indexOf(fatherLine[fatherLine.length - 1]) !== -1;

                const isStartCheckedByMe = myCellList.indexOf(fatherLine[0]) !== -1;
                const isEndCheckedByMe = myCellList.indexOf(fatherLine[fatherLine.length - 1]) !== -1;

                // Nếu cả hai đầu đều bị chặn, bỏ qua đường này
                if (isStartBlocked && isEndBlocked) {
                    shouldSkipLine = true;
                    this.log('shouldSkipLine');
                } else if (isStartBlocked || isEndBlocked) {
                    // Nếu một trong hai đầu bị chặn
                    // Lấy danh sách các đường mở rộng thêm 2 ô
                    const extendedLines = game.getLinesByList(2, currentLine, game.winningLineLength);
                    let availableCount = 0;
                    this.log('extendedLines', extendedLines);
                    if (extendedLines.length) {
                        let shouldContinue = false;
                        dualLoop(extendedLines, (extendedLineIndex, exIndex, stopChild) => {
                            const extendedLine = game.lines[2][extendedLineIndex];

                            // Kiểm tra điều kiện đường mở rộng:
                            // 1. Nếu đầu bị chặn, đường mở rộng phải bắt đầu trước ô bị chặn
                            // 2. Nếu cuối bị chặn, đường mở rộng phải kết thúc sau ô bị chặn
                            // 3. Hai đầu đường mở rộng không được bị chặn
                            if ((isStartBlocked && extendedLine.includes(fatherLine[0])) ||
                                (isEndBlocked && extendedLine.includes(fatherLine[fatherLine.length - 1])) ||
                                competitorCellList.includes(extendedLine[0]) ||
                                competitorCellList.includes(extendedLine[extendedLine.length - 1])) {
                                shouldContinue = true;
                                return stopChild();
                            }

                            // Thêm các ô bị cấm vào danh sách
                            if (isStartBlocked) bannedCells.push(fatherLine[0]);
                            if (isEndBlocked) bannedCells.push(fatherLine[fatherLine.length - 1]);

                            // Đếm số ô đã đánh trong đường mở rộng
                            let occupiedCount = 0;
                            for (let cellIndex = 0; cellIndex < extendedLine.length; cellIndex++) {
                                const currentCell = extendedLine[cellIndex];
                                // Bỏ qua các ô ở đầu/cuối nếu bị chặn
                                if ((cellIndex === 0 && isStartBlocked) ||
                                    (cellIndex === extendedLine.length - 1 && isEndBlocked)) {
                                    shouldContinue = true;
                                    return stopChild();
                                }
                                if (myCellList.includes(currentCell)) {
                                    occupiedCount++;
                                }
                            }

                            // Nếu số ô đã đánh vượt quá giới hạn, tăng số đường khả dụng
                            if (occupiedCount > maxHard) {
                                availableCount++;
                            }
                        }, stop)
                        if (shouldContinue) return;
                        

                        // Nếu không có đường khả dụng, bỏ qua đường này
                        if (availableCount === 0) {
                            shouldSkipLine = true;
                        }
                    }
                } else if (isStartCheckedByMe && isEndCheckedByMe) {
                    // Nếu cả hai đầu đều là quân của ta
                    // Đây là trường hợp tốt nhất, có thể tạo nhiều cơ hội thắng
                    this.log('fatherLine is my cell', fatherLine);
                    const suggestedMoves = [];
                    for (let cellIndex = 0; cellIndex < currentLine.length; cellIndex++) {
                        const currentCell = currentLine[cellIndex];
                        if (game.checkCellAvailable(currentCell)) {
                            suggestedMoves.push(currentCell);
                            importantMoves.push(currentCell);
                        }
                    }
                    // Nếu đang ở mức an toàn cao nhất, trả về ngay các nước đi được đề xuất
                    if (suggestedMoves.length) {
                        suggestedMoves.forEach(move => {
                            if (importantMoves.indexOf(move) === -1) {
                                importantMoves.push(move);
                                shouldSkipLine = true;
                            }
                        });
                        
                        // return stop();
                    }
                } 
                else if (isStartCheckedByMe || isEndCheckedByMe) {
                    // Nếu đầu bị chặn và cuối không bị chặn
                    // Đây là trường hợp tốt nhất, có thể tạo nhiều cơ hội thắng
                    this.log('fatherLine is my cell', fatherLine);
                    for (let cellIndex = 0; cellIndex < currentLine.length; cellIndex++) {
                        const currentCell = currentLine[cellIndex];
                        if (game.checkCellAvailable(currentCell) && importantMoves.indexOf(currentCell) === -1) {
                            importantMoves.push(currentCell);
                            shouldSkipLine = true;
                        }
                    }
                } else if (game.level === 3) {
                    // Nếu không có đầu nào bị chặn và không phải quân của ta
                    // Ở cấp độ 3, sử dụng đường thông thường thay vì đường mở rộng
                    lineType = 0;

                }
            }

            // Xử lý đường hiện tại nếu chưa bị bỏ qua
            if (!shouldSkipLine) {
                if (isInBorder === 1) {
                    // Nếu đường nằm ở biên (một đầu nằm ở biên)
                    const outlineLines = game.getLinesByList(1, currentLine, game.winningLineLength);
                    this.log("1 biên",'outlineLines', outlineLines);
                    if (outlineLines.length) {
                        const outlineLine = game.lines[1][outlineLines[0]];
                        // Nếu hai đầu đường mở rộng không bị chặn
                        if (competitorCellList.indexOf(outlineLine[0]) === -1 &&
                            competitorCellList.indexOf(outlineLine[outlineLine.length - 1]) === -1) {
                            for (let cellIndex = 0; cellIndex < currentLine.length; cellIndex++) {
                                const currentCell = currentLine[cellIndex];
                                if (game.checkCellAvailable(currentCell)) {
                                    // Nếu đang ở mức an toàn cao nhất và ô không nằm ở biên
                                    if (safeLevel === 1 && !game.isBorderCell(currentCell)) {
                                        importantMoves.push(currentCell);
                                        return stop();
                                    }
                                    importantMoves.push(currentCell);
                                }
                            }
                        }
                    } else {
                        // Nếu không có đường mở rộng, thêm tất cả các ô trống vào danh sách
                        for (let cellIndex = 0; cellIndex < currentLine.length; cellIndex++) {
                            if (game.checkCellAvailable(currentLine[cellIndex]) && importantMoves.indexOf(currentLine[cellIndex]) === -1) {
                                importantMoves.push(currentLine[cellIndex]);
                            }
                        }
                    }
                } 
                else if (isInBorder === 2) {
                    // Nếu đường nằm ở biên (cả hai đầu nằm ở biên)
                    this.log("2 biên");
                    let ignore = false;
                    let availableCount = 0;
                    const availableCells = [];
                    dualLoop(currentLine, (cell, ind, stopChild) => {
                        if(competitorCellList.indexOf(cell) !== -1) {
                            ignore = true;
                            return stopChild();
                        }
                        else if (game.checkCellAvailable(cell) && importantMoves.indexOf(cell) === -1) {
                            availableCount++;
                            availableCells.push(cell);
                        }
                    });
                    this.log(ignore,'availableCells', availableCells);
                    if (!ignore && availableCount > 0) {
                        // Nếu đang ở mức an toàn cao nhất hoặc cấp độ 3, trả về ngay
                        if (safeLevel === 1 || game.level === 3) {
                            availableCells.forEach(move => {
                                if (importantMoves.indexOf(move) === -1) {
                                    importantMoves.push(move);
                                }
                            });
                            // return stop();
                        } else {
                            // Nếu không, thêm vào danh sách các nước đi quan trọng
                            for (const move of availableCells) {
                                if (importantMoves.indexOf(move) === -1) {
                                    importantMoves.push(move);
                                }
                            }
                        }
                    }

                }
                else {
                    // Xử lý đường thông thường (không nằm ở biên)
                    this.log("3 không biên");
                    const extendedLines = game.getLinesByList(lineType, currentLine, game.winningLineLength, true);
                    const suggestedMoves = [];

                    for (let lineIndex = 0; lineIndex < extendedLines.length; lineIndex++) {
                        const extendedLine = game.lines[lineType][extendedLines[lineIndex]];
                        this.log('extendedLine', extendedLine);
                        // Kiểm tra điều kiện đường thắng:
                        // 1. Đang ở mức an toàn cao nhất
                        // 2. Hai đầu đường đều có thể đánh

                        if (safeLevel === 1 
                            && (
                                (game.checkCellAvailable(extendedLine[0]) && game.checkCellAvailable(extendedLine[extendedLine.length - 1])) ||
                                (myCellList.indexOf(extendedLine[0]) !== -1 || myCellList.indexOf(extendedLine[extendedLine.length - 1]) !== -1)
                            )
                        ) {
                            this.log('2 đầu hợp lệ');
                            if (fatherLine) {
                                // Nếu có đường cha, thêm các ô bị cấm
                                if (competitorCellList.indexOf(fatherLine[0]) !== -1) {
                                    bannedCells.push(fatherLine[1]);
                                }
                                if (competitorCellList.indexOf(fatherLine[fatherLine.length - 1]) !== -1) {
                                    bannedCells.push(fatherLine[fatherLine.length - 2]);
                                }
                            }
                            // Lấy danh sách các ô có thể đánh ở hai đầu đường
                            const availableCells = game.getEmptyCells(
                                [extendedLine[0], extendedLine[extendedLine.length - 1]],
                                bannedCells
                            );
                            this.log('availableCells', availableCells);
                            if (availableCells.length) {
                                availableCells.forEach(move => {
                                    if (importantMoves.indexOf(move) === -1) {
                                        importantMoves.push(move);
                                    }
                                });
                                // return stop();
                            }
                        }

                        // Kiểm tra xem đường có chứa quân của đối thủ không
                        let hasOpponentPiece = false;
                        for (let cellIndex = 0; cellIndex < extendedLine.length; cellIndex++) {
                            if (competitorCellList.indexOf(extendedLine[cellIndex]) !== -1) {
                                hasOpponentPiece = true;
                                break;
                            }
                        }

                        // Nếu có quân đối thủ, bỏ qua đường này
                        if (hasOpponentPiece) return;

                        // Xử lý các ô trống trong đường
                        if (safeLevel === 1) {
                            // Nếu đang ở mức an toàn cao nhất, chỉ xét các ô trong đường hiện tại
                            for (let cellIndex = 0; cellIndex < currentLine.length; cellIndex++) {
                                const currentCell = currentLine[cellIndex];
                                const extendedIndex = extendedLine.indexOf(currentCell);
                                if (game.checkCellAvailable(currentCell)) {
                                    if (importantMoves.indexOf(currentCell) === -1) {
                                        // Kiểm tra xem ô có nằm cạnh quân của ta không
                                        if (safeLevel === 1 &&
                                            (myCellList.indexOf(extendedLine[extendedIndex + 1]) !== -1 ||
                                                myCellList.indexOf(extendedLine[extendedIndex - 1]) !== -1)) {
                                            suggestedMoves.push(currentCell);
                                        } else if (priority === 0 &&
                                            (myCellList.indexOf(extendedLine[extendedIndex + 1]) !== -1 ||
                                                myCellList.indexOf(extendedLine[extendedIndex - 1]) !== -1) &&
                                            game.checkNearBy(lineType, extendedLines[lineIndex], myCellList, currentCell)) {
                                            suggestedMoves.push(currentCell);
                                        } else {
                                            importantMoves.push(currentCell);
                                        }
                                    } else {
                                        // importantMoves.push(currentCell);
                                    }
                                }
                            }
                        } else {
                            // Nếu không ở mức an toàn cao nhất, xét tất cả các ô trong đường mở rộng
                            for (let cellIndex = 0; cellIndex < extendedLine.length; cellIndex++) {
                                if (game.checkCellAvailable(extendedLine[cellIndex])) {
                                    if (importantMoves.indexOf(extendedLine[cellIndex]) === -1) {
                                        // Kiểm tra xem ô có nằm cạnh quân của ta không
                                        if (safeLevel === 1 &&
                                            (myCellList.indexOf(extendedLine[cellIndex + 1]) !== -1 ||
                                                myCellList.indexOf(extendedLine[cellIndex - 1]) !== -1)) {
                                            suggestedMoves.push(extendedLine[cellIndex]);
                                        } else if (priority === 0 &&
                                            (myCellList.indexOf(extendedLine[cellIndex + 1]) !== -1 ||
                                                myCellList.indexOf(extendedLine[cellIndex - 1]) !== -1) &&
                                            game.checkNearBy(lineType, extendedLines[lineIndex], myCellList, extendedLine[cellIndex])) {
                                            suggestedMoves.push(extendedLine[cellIndex]);
                                        } else {
                                            importantMoves.push(extendedLine[cellIndex]);
                                        }
                                    } else {
                                        // importantMoves.push(extendedLine[cellIndex]);
                                    }
                                }
                            }
                        }
                    }

                    // Xử lý các nước đi được đề xuất
                    if (suggestedMoves.length) {
                        // Nếu đang ở mức an toàn cao nhất hoặc cấp độ 3, trả về ngay
                        if (safeLevel === 1 || game.level === 3) {
                            suggestedMoves.forEach(move => {
                                if (importantMoves.indexOf(move) === -1) {
                                    importantMoves.push(move);
                                }
                            });
                            // return stop();
                        } else {
                            // Nếu không, thêm vào danh sách các nước đi quan trọng
                            for (const move of suggestedMoves) {
                                if (importantMoves.indexOf(move) === -1) {
                                    importantMoves.push(move);
                                }
                            }
                        }
                    }
                }
            }
        });

        // Trả về danh sách các nước đi quan trọng nếu có
        if (importantMoves.length > 0) {
            return importantMoves;
        }

        return null;
    }

    /**
     * Tìm các nước đi giao nhau
     * Thuật toán:
     * 1. Tìm các đường có thể thắng
     * 2. Tìm điểm giao của các đường
     * 3. Xử lý đặc biệt cho level 1
     * @param {array} myCellList Danh sách ô của người chơi
     * @param {array} competitorCellList Danh sách ô của đối thủ
     * @returns {array} Danh sách các ô giao nhau
     */
    getIntersectingMoves(myCellList, competitorCellList) {
        if (!this.game) return [];

        const players = [myCellList, competitorCellList];
        const maxHard = this.game.level;
        const suggestList = [];

        // Tìm trong các ô đã chọn có 2 ô trong 1 hàng
        let min = Math.max(2, this.game.winningLineLength - maxHard);

        // Xử lý đặc biệt cho level 1
        if (this.game.level === 1) {
            // Tìm nước đi giao nhau cho người chơi
            for (let j = this.game.winningLineLength - maxHard; j >= 1; j--) {
                let i = 0;
                let plst = players[i];
                let lit = this.game.getLinesByList(0, plst, j, true);
                let line5c = lit.filter((lineIndex) => {
                    return this.game.getLinesByList(1, this.game.lines[0][lineIndex], this.game.winningLineLength, true).length > 0;
                });
                if (line5c.length > 1) {
                    var lst = this.findIntersection(0, line5c);
                    if (lst.length > 0) {
                        lst.forEach(move => {
                            if (suggestList.indexOf(move) === -1) {
                                suggestList.push(move);
                            }
                        });
                    }
                }
            }
            if (suggestList.length > 0) return suggestList;

            // Tìm nước đi giao nhau cho đối thủ
            for (let j = this.game.winningLineLength - maxHard; j >= min; j--) {
                let i = 1;
                let plst = players[i];
                let lit = this.game.getLinesByList(0, plst, j, true);
                let line5c = lit.filter((lineIndex) => {
                    return this.game.getLinesByList(1, this.game.lines[0][lineIndex], this.game.winningLineLength, true).length > 0;
                });
                if (line5c.length > 1) {
                    let lst = this.findIntersection(0, line5c);
                    if (lst.length > 0) {
                        lst.forEach(move => {
                            if (suggestList.indexOf(move) === -1) {
                                suggestList.push(move);
                            }
                        });
                    }
                }
            }
            if (suggestList.length > 0) return suggestList;
        }

        // Tìm nước đi giao nhau cho cả hai người chơi
        for (let j = this.game.winningLineLength - maxHard; j >= min; j--) {
            for (let i = 0; i < 2; i++) {
                let plst = players[i];
                let lit = this.game.getLinesByList(0, plst, j, true);
                let line5c = lit.filter((lineIndex) => {
                    return this.game.getLinesByList(1, this.game.lines[0][lineIndex], this.game.winningLineLength, true).length > 0;
                });
                if (line5c.length > 1) {
                    let lst = this.findIntersection(0, line5c);
                    if (lst.length > 0) {
                        return lst;
                    }
                }
            }
        }

        return suggestList;
    }



    /**
     * Tìm các nước đi ngẫu nhiên
     * Thuật toán:
     * 1. 70% khả năng tìm đường có 1 quân và có thể thắng
     * 2. 30% khả năng lấy tất cả các ô trống
     * @param {array} myCellList Danh sách ô của người chơi
     * @param {array} competitorCellList Danh sách ô của đối thủ
     * @returns {array} Danh sách các ô gợi ý
     */
    getRandomMoves(myCellList, competitorCellList) {
        if (!this.game) return [];

        const suggestList = [];
        const rand = Math.round(Math.random() * 7);

        // 70% khả năng tìm đường có 1 quân và có thể thắng
        if (rand < 5) {
            // Tìm các đường có 1 quân và có thể thắng
            const line2s = this.game.getLinesByListWithLimit(0, myCellList, 1, this.game.winningLineLength - 1, true);

            // Lấy ngẫu nhiên từ các đường này
            for (let i = 0; i < line2s.length; i++) {
                const cells = this.game.lines[0][line2s[i]];
                const li3 = this.game.getLinesByList(1, cells, this.game.winningLineLength, true);

                for (let j = 0; j < li3.length; j++) {
                    const cs = this.game.lines[1][li3[j]];
                    let hasCompetitor = false;
                    let availableCells = [];

                    // Kiểm tra xem đường có bị chặn không và tìm các ô trống
                    for (let k = 0; k < cs.length; k++) {
                        if (competitorCellList.indexOf(cs[k]) !== -1) {
                            hasCompetitor = true;
                            break;
                        }
                        if (this.game.checkCellAvailable(cs[k])) {
                            availableCells.push(cs[k]);
                        }
                    }

                    // Nếu đường không bị chặn và có ô trống, thêm vào danh sách
                    if (!hasCompetitor && availableCells.length > 0) {
                        suggestList.push(...availableCells);
                    }
                }
            }

            if (suggestList.length > 0) return suggestList;
        }

        // 30% khả năng lấy tất cả các ô trống
        const cells = Object.keys(this.game.cellData);
        for (let i = 0; i < cells.length; i++) {
            if (this.game.selectedCells.indexOf(cells[i]) === -1) {
                suggestList.push(cells[i]);
            }
        }

        return suggestList;
    }


    /**
     * Mô phỏng các nước đi và đánh giá điểm số
     * Thuật toán:
     * 1. Mô phỏng từng nước đi
     * 2. Đánh giá điểm dựa trên:
     *    - Khả năng thắng/thua
     *    - Số nước đi cần thiết
     *    - Số nước đi quan trọng
     * @param {array} myCellList Danh sách ô của người chơi
     * @param {array} competitorCellList Danh sách ô của đối thủ
     * @param {array} moveList Danh sách các nước đi cần đánh giá
     * @param {number} times Số lần mô phỏng cho mỗi nước đi
     * @returns {object} Map chứa điểm số của từng nước đi
     */
    simulateMove(myCellList, competitorCellList, moveList, times = 5) {
        if (!this.game) return {};

        const pointMap = {};

        // Duyệt qua từng nước đi cần đánh giá
        for (const move of moveList) {
            // Tạo bản sao của danh sách ô để mô phỏng
            const myList = [...myCellList];
            const competitorList = [...competitorCellList];
            let point = 100; // Điểm khởi đầu cho mỗi nước đi

            // Thêm nước đi mô phỏng vào danh sách
            myList.push(move);
            pointMap[move] = point;

            // Kiểm tra nếu nước đi này dẫn đến chiến thắng
            if (this.game.checkWinner(myList, competitorList)) {
                pointMap[move] = ROLLOUT_WIN_SCORE - 1;
                continue;
            }

            // Mô phỏng nước đi của đối thủ
            const competitorMoves = this.getSuggestWithoutReviews(competitorList, myList, 1);
            if (!competitorMoves || competitorMoves.length === 0) {
                pointMap[move] = point;
                continue;
            }

            const competitorMove = competitorMoves[Math.floor(Math.random() * competitorMoves.length)];
            let competitorTestList = [...competitorList, competitorMove];

            // Kiểm tra nếu đối thủ có thể thắng
            if (this.game.checkWinner(competitorTestList, myList)) {
                pointMap[move] = -ROLLOUT_WIN_SCORE + 2;
                continue;
            }

            // Thêm nước đi của đối thủ vào danh sách
            competitorList.push(competitorMove);

            // Mô phỏng các nước đi tiếp theo
            for (let i = 0; i < times; i++) {
                // Mô phỏng nước đi của người chơi
                const myMoves = this.getSuggestWithoutReviews(myList, competitorList, i + 1);
                if (!myMoves || myMoves.length === 0) {
                    point -= 20; // Giảm điểm nếu không có nước đi hợp lệ
                    pointMap[move] = point;
                    break;
                }

                const myMove = myMoves[Math.floor(Math.random() * myMoves.length)];
                myList.push(myMove);

                // Kiểm tra nếu người chơi thắng
                if (this.game.checkWinner(myList, competitorList)) {
                    // Terminal outcomes outrank every non-terminal heuristic.
                    // Prefer earlier wins and postpone losses within their band.
                    pointMap[move] = ROLLOUT_WIN_SCORE - (2 * i + 3);
                    break;
                }

                // Mô phỏng nước đi của đối thủ
                const competitorMoves = this.getSuggestWithoutReviews(competitorList, myList, i + 1);
                if (!competitorMoves || competitorMoves.length === 0) {
                    point -= (times - i) * 5; // Giảm điểm ít hơn nếu đối thủ không có nước đi
                    pointMap[move] = point;
                    break;
                }

                const competitorMove = competitorMoves[Math.floor(Math.random() * competitorMoves.length)];
                competitorList.push(competitorMove);

                // Kiểm tra nếu đối thủ thắng
                if (this.game.checkWinner(competitorList, myList)) {
                    pointMap[move] = -ROLLOUT_WIN_SCORE + (2 * i + 4);
                    break;
                }

                // Đánh giá thế trận
                const position = this.forPosition(myList, competitorList);
                const mySuggest = position.getImportantMoves(myList, competitorList, i + 1);
                const competitorSuggest = position.getImportantMoves(competitorList, myList, i + 1);

                // Điều chỉnh điểm dựa trên số nước đi quan trọng
                if (!mySuggest || mySuggest.length === 0) {
                    point -= (i + 1) * 10; // Giảm điểm nếu không có nước đi quan trọng
                    pointMap[move] = point;
                    break;
                }
                if (!competitorSuggest || competitorSuggest.length === 0) {
                    point -= (times - i) * 5; // Giảm điểm ít hơn nếu đối thủ không có nước đi quan trọng
                    pointMap[move] = point;
                    break;
                }

                // So sánh số nước đi quan trọng
                point -= (i + 1) * (mySuggest.length < competitorSuggest.length ? 15 : 5);
                pointMap[move] = point;
            }
        }

        return pointMap;
    }

    /**
     * Tìm điểm giao của các đường
     * Thuật toán:
     * 1. Duyệt qua từng cặp đường
     * 2. Tìm các điểm chung của hai đường
     * 3. Kiểm tra điểm có thể đánh không
     * @param {number} type Loại chiều dài (0: N, 1: N+1, 2: N+2)
     * @param {array} lineList Danh sách các đường
     * @returns {array} Danh sách các điểm giao
     */
    findIntersection(type, lineList) {
        if (!this.game) return [];
        return this.game.findIntersection(type,lineList);
    }
}

export default BOT_Origin; 
