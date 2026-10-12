/**
* for loop
* @param {Array} arr - Mảng
* @param {(item:any,index?:number,stop?:()=>void,side?:string)=>void|boolean} callback - Hàm callback
* @returns {void} 
*/
export function forLoop(arr, callback) {
    let shouldStop = false;
    const stop = () => shouldStop = true;

    if (Array.isArray(arr)) {
        let n = arr.length;
        if(n === 0) return;
        for (let i = 0; i < n && !shouldStop; i++) {
            callback(arr[i], i, stop, 'left');
        }
    } else if (typeof arr === 'object' && arr !== null) {
        let keys = Object.keys(arr);
        let n = keys.length;
        if(n === 0) return;
        for (let i = 0; i < n && !shouldStop; i++) {
            callback(arr[keys[i]], keys[i], stop, 'left');
        }
    } else {

    }
}

/**
    * Lặp đôi - chạy từ 2 đầu mảng vào giữa
    * @param {Array} arr - Mảng
    * @param {(item:any,index?:number,stop?:(stopParent?:boolean)=>void,side?:string)=>void} callback - Hàm callback
    * @param {()=>void} stopParentLoop - Hàm dừng vòng lặp cha
    * @returns {void} 
    */
export function dualLoop(arr, callback, stopParentLoop = null) {
    let shouldStop = false;
    let isStopParent = false;
    const stop = (stopParent = false) => {
        shouldStop = true;
        isStopParent = stopParent;
        if(stopParent && typeof stopParentLoop === 'function') stopParentLoop();
    }
    try {
        if (Array.isArray(arr)) {
            let n = arr.length;
            for (let i = 0, j = n - 1; i <= j && !shouldStop; i++, j--) {
                // Xử lý phần tử đầu
                callback(arr[i], i, stop, 'left');
                if (shouldStop) {
                    if(isStopParent) {
                        throw new Error('STOP_PARENT_LOOP');
                    }
                    return;
                }
    
                // Xử lý phần tử cuối (nếu không phải phần tử giữa)
                if (i !== j && !shouldStop) {
                    callback(arr[j], j, stop, 'right');
                    if (shouldStop) {
                        if(isStopParent) {
                            throw new Error('STOP_PARENT_LOOP');
                        }
                        return;
                    }
                }
            }
        } else if (typeof arr === 'object' && arr !== null) {
            let keys = Object.keys(arr);
            let n = keys.length;
            for (let i = 0, j = n - 1; i <= j && !shouldStop; i++, j--) {
                // Xử lý phần tử đầu
                callback(arr[keys[i]], keys[i], stop, 'left');
                if (shouldStop) {
                    if(isStopParent) {
                        throw new Error('STOP_PARENT_LOOP');
                    }
                    return;
                }
                // Xử lý phần tử cuối (nếu không phải phần tử giữa)
                if (i !== j && !shouldStop) {
                    callback(arr[keys[j]], keys[j], stop, 'right');
                    if (shouldStop) {
                        if(isStopParent) {
                            throw new Error('STOP_PARENT_LOOP');
                        }
                        return;
                    }
                }
            }
        } else {
    
        }    
    } catch (error) {
        if(error.message === 'STOP_LOOP') console.log('STOP_LOOP');
        if(error.message === 'STOP_PARENT_LOOP') {
            if(typeof stopParentLoop === 'function') {
                stopParentLoop();
                throw error;
            }
            
        }
        if(typeof stopParentLoop === 'function') stopParentLoop();
    }

    
}

/**
 * Lặp qua từng phần tử của mảng
 * @param {Array|Object} arr - Mảng hoặc object cần lặp
 * @param {(item:any, index:number|string, stop:()=>void) => void | boolean} callback - Hàm callback
 * @returns {void}
 */
export function eachLoop(arr, callback) {
    try {
        
        if(Array.isArray(arr)){
            const stop = () => {
                throw new Error('Stop');
            }
            arr.forEach((item, index) => {
                if (callback(item, index, stop) === false) throw new Error('Stop');
            });
        } else if(typeof arr === 'object' && arr !== null){
            let shouldStop = false;
            const stop = () => {
                shouldStop = true;
            }
            for(let key in arr){
                if (callback(arr[key], key, stop) === false || shouldStop) return;
            }
        }
    } catch (error) {

    }
}

/**
 * Lặp qua từng phần tử của mảng
 * @param {Array|Object} arr - Mảng hoặc object cần lặp
 * @param {(item:any, index:number|string, stop:()=>void) => void | boolean} callback - Hàm callback
 * @returns {void}
 */
export function forMap(arr, callback) {
    try {
        const stop = () => {
            throw new Error('Stop');
        }
        
        if(Array.isArray(arr)){
            return arr.map((item, index) => callback(item, index, stop));
        } else if(typeof arr === 'object' && arr !== null){
            return Object.keys(arr).map((key, index) => callback(arr[key], key, stop));
        }
    } catch (error) {

    }
}



/**
 * Chia mảng thành nhiều phần và lặp qua từng phần
 * @param {Array|Object} arr - Mảng hoặc object cần lặp
 * @param {number} loopCount - Số phần cần chia
 * @param {(item:any, index?:number|string, stop?:()=>void, partIndex?:number) => void | boolean} callback - Hàm callback
 * @returns {void}
 */
export function splitLoop(arr, loopCount, callback) {
    if (!arr || loopCount <= 0) return;
    
    let items = [];
    let keys = [];
    let n = 0;

    if (Array.isArray(arr)) {
        items = arr;
        n = arr.length;
    } else if (typeof arr === 'object' && arr !== null) {
        keys = Object.keys(arr);
        items = keys.map(key => arr[key]);
        n = keys.length;
    } else {
        return;
    }

    if (n === 0) return;
    const isArr = Array.isArray(arr);
    const baseSize = Math.floor(n / loopCount); // Kích thước cơ bản của mỗi phần
    const remainder = n % loopCount; // Số phần tử dư
    
    let currentIndex = 0;
    
    for (let partIndex = 0; partIndex < loopCount; partIndex++) {
        // Tính kích thước thực tế của phần hiện tại
        const partSize = baseSize + (partIndex < remainder ? 1 : 0);
        
        // Lặp qua các phần tử trong phần hiện tại
        for (let i = 0; i < partSize; i++) {
            const stop = () => { throw new Error('STOP_LOOP'); };
            
            try {
                const index = isArr ? currentIndex : keys[currentIndex];
                callback(items[currentIndex], index, stop, partIndex);
            } catch (e) {
                if (e.message === 'STOP_LOOP') return;
                throw e;
            }
            
            currentIndex++;
        }
    }
}

/**
 * Test hiệu suất của các hàm lặp
 * @param {Array|Object} arr - Mảng hoặc object cần lặp
 * @param {(item:any, index:number|string, stop:()=>void) => void | boolean} callback - Hàm callback
 * @returns {Object} Kết quả test
 */
const fastTest = (arr, callback) => {

    splitLoop(arr, 10, callback);

    const testTimes = 1;
    let slTimes = 0;
    let dlTimes = 0;
    let elTimes = 0;
    let flTimes = 0;
    let fmTimes = 0;
    for(let i = 0; i < testTimes; i++){
        const start = performance.now();
        splitLoop(arr, 10, callback);
        const end = performance.now();
        slTimes += end - start;
    }
    for(let i = 0; i < testTimes; i++){
        const start = performance.now();
        dualLoop(arr, callback);
        const end = performance.now();
        dlTimes += end - start;
    }
    for(let i = 0; i < testTimes; i++){
        const start = performance.now();
        eachLoop(arr, callback);
        const end = performance.now();
        elTimes += end - start;
    }
    for(let i = 0; i < testTimes; i++){
        const start = performance.now();
        forLoop(arr, callback);
        const end = performance.now();
        flTimes += end - start;
    }
    for(let i = 0; i < testTimes; i++){
        const start = performance.now();
        forMap(arr, callback);
        const end = performance.now();
        fmTimes += end - start;
    }
    return {
        forLoop: Number((flTimes / testTimes).toFixed(6)),
        dualLoop: Number((dlTimes / testTimes).toFixed(6)),
        splitLoop: Number((slTimes / testTimes).toFixed(6)),
        eachLoop: Number((elTimes / testTimes).toFixed(6)),
        forMap: Number((fmTimes / testTimes).toFixed(6)),
    }
}

/**
 * Test hiệu suất của các hàm lặp
 * @param {Array|Object} arr - Mảng hoặc object cần lặp
 * @param {(item:any, index:number|string, stop:()=>void) => void | boolean} callback - Hàm callback
 * @returns {void}
 */
export function testLoopPerformance(arr, callback) {
    const result = fastTest(arr, callback);
    console.log(result); 
    return result;
}

/**
 * Lặp đơn - chạy từ đầu mảng đến cuối mảng
 * @param {(item:any,index?:number,stop?:()=>void)=>void|boolean} callback - Hàm callback
 * @returns {void} 
 */
// Array.prototype.eachLoop = function(callback) {
//     eachLoop(this, callback);
// }
/**
 * Lặp đôi - chạy từ 2 đầu mảng vào giữa
 * @param {(item:any,index?:number,stop?:()=>void,side?:string)=>void|boolean} callback - Hàm callback
 * @returns {void} 
 */
// Array.prototype.dualLoop = function(callback) {
//     dualLoop(this, callback);
// }

/**
 * Lặp đơn - chạy từ đầu mảng đến cuối mảng
 * @param {(item:any,index?:number,stop?:()=>void)=>void|boolean} callback - Hàm callback
 * @returns {void} 
 */
// Object.prototype.eachLoop = function(callback) {
//     eachLoop(this, callback);
// }

/**
 * Lặp đôi - chạy từ 2 đầu mảng vào giữa
 * @param {(item:any,index?:number,stop?:()=>void,side?:string)=>void|boolean} callback - Hàm callback
 * @returns {void} 
 */
// Object.prototype.dualLoop = function(callback) {
//     dualLoop(this, callback);
// }



export function logif(condition, message, ...args) {
    if(condition) {
        console.log(message, ...args);
    }
}