import { logif } from "../core/utils";

class BaseModel {
    // thuoc tinh va phuong thuc static cua class 
    static NAME = 'C5_Demo';
    static VERSION = '1.0.0';
    static AUTHOR = 'Le Ngoc Doan';
    static DESCRIPTION = 'Giao diện model AI Gomoku quốc tế';
    static COPYRIGHT = 'Copyright 2024 Le Ngoc Doan';
    static LICENSE = 'MIT';
    static WEBSITE = 'https://example.com';
    static RULES = [
        'Gomoku RIF: bàn 15×15, khai cuộc Swap2',
        'Đúng 5 quân liên tiếp thắng; từ 6 quân không thắng',
        'Chặn một hoặc hai đầu không vô hiệu hóa chuỗi 5',
    ];
    static EXAMPLES = [
        'Khai cuộc: cùng người đặt X tại 8:8, O tại 9:8, X tại 8:9',
        'Bên thứ hai chọn màu hoặc đặt thêm O rồi X',
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
    showLog = false;
    log(message, ...args) {
        logif(this.showLog, message, ...args);
    }
    startGame(){
    }
    // Kết thúc ván và học từ kết quả
    // ham nay bat buoc phai khai bao
    endGame(winner) { // winner là người thắng, có thể là player hoặc computer
        
    }

    /**
     * @param {Array} myCellList
     * @returns {Array} danh sách ô gợi ý
     */
    suggest(myCellList) {
        return [];
    }
}
export default BaseModel;