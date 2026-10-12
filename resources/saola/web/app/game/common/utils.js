// var $$;
if (typeof Object.assign != 'function') {
    Object.assign = function (target, varArgs) { 
        if (target === null) { // TypeError nếu undefined hoặc null
            throw new TypeError('Cannot convert undefined or null to object');
        }

        const to = Object(target);

        for (let index = 1; index < arguments.length; index++) {
            const nextSource = arguments[index];

            if (nextSource != null) { // Bỏ qua nếu undefined hoặc null
                for (const nextKey in nextSource) {
                    // Avoid bugs when hasOwnProperty is shadowed
                    if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                        to[nextKey] = nextSource[nextKey];
                    }
                }
            }
        }
        return to;
    };
}

const isFunction = function isFunction(obj) {
    return typeof obj === "function" && typeof obj.nodeType !== "number";
};

const isCallable = function (variable) {
    return typeof variable === "function";
};

const FD = typeof FormData != "undefined" ? FormData : function FormData() { this.data = null; };
/**
 * lấy kiểu giá trị của biến
 * @param {*} obj
 * @return {string}
 */
const getType = function (obj) {
    let t = 'null';
    const type = typeof obj;
    if (type === 'object') {
        if (obj === null) {
            t = 'null';
        } else if (obj.constructor === FD) {
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
        t = type;
    }
    return t;
};
/**
 * kiềm tra có phải chuỗi
 * @param {*} variable biến bất kỳ
 */
const isString = function isString(variable) {
    const type = getType(variable);
    return type === "string" || (type === "number" && !isNaN(variable)) || (type === "object" && (variable.constructor === String || (variable.isPrimitive && variable.isString)));
}
/**
 * kiềm tra có phải null
 * @param {*} variable biến bất kỳ
 */
const isNull = function isNull(variable) {
    return getType(variable) === "null";
}
/**
 * kiềm tra có phải array
 * @param {*} variable biến bất kỳ
 */
const isArray = function isArray(variable) {
    return getType(variable) === "array" || Array.isArray(variable);
}
/**
 * kiềm tra có phải object
 * @param {*} variable biến bất kỳ
 */
const isObject = function isObject(variable) {
    return getType(variable) === "object";
}
/**
 * kiềm tra có phải number
 * @param {*} variable biến bất kỳ
 */
const isNumber = function isNumber(variable) {
    const type = getType(variable);
    return ((type === "number" || type === "string") && !isNaN(variable - parseFloat(variable))) || (type === "object" && (variable.constructor === Number || (variable.isPrimitive && variable.isNumber)));
}
/**
 * kiềm tra có phải float
 * @param {*} variable biến bất kỳ
 */
const isFloat = function isFloat(variable) {
    const type = getType(variable);
    return (type === "number" || type === "string") && !isNaN(variable - parseFloat(variable));
}

/**
 * kiềm tra có phải integer
 * @param {*} variable biến bất kỳ
 */
const isInteger = function isInteger(variable) {
    return isNumber(variable) && String(parseInt(variable)) === String(variable);
}


/**
 * kiềm tra có phải boolean
 * @param {*} variable biến bất kỳ
 */
const isBoolean = function isBoolean(variable) {
    const type = getType(variable);
    return type === "boolean" || (type === "object" && (variable.constructor === Boolean || (variable.isPrimitive && variable.isBoolean)));
}

/**
 * kiềm tra có phải Formdata
 * @param {*} variable biến bất kỳ
 */
const isFormData = function isFormData(variable) {
    return getType(variable) === "formdata";
}

/**
 * kiềm tra có phải email
 * @param {*} email biến bất kỳ
 */
const isEmail = function isEmail(email) {
    // Kiểm tra null hoặc undefined
    if (!email) return false;
    
    // Chuyển về chuỗi và loại bỏ khoảng trắng
    email = String(email).trim();
    
    // Regex đơn giản và hiệu quả hơn
    // 1. Phần local: 1-64 ký tự, có thể chứa chữ cái, số, dấu chấm, dấu gạch ngang, dấu gạch dưới
    // 2. Ký tự @
    // 3. Phần domain: 1-255 ký tự, có thể chứa chữ cái, số, dấu chấm, dấu gạch ngang
    // 4. TLD: 2-63 ký tự chữ cái
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    // Kiểm tra độ dài tối đa
    if (email.length > 254) return false;
    
    return re.test(email);
};

const isEmpty = function (obj) {
    if (typeof obj === "undefined") return true;

    // console.log(any.constructor)
    const type = getType(obj);

    if (type === "object" && (!obj.isPrimitive)) {
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                return false;
            }
        }
        return true;
    }
    else if (type === "array" || type === 'string' || (type === "object" && obj.isPrimitive && obj.isString)) {
        return obj.length === 0;
    }
    else return !obj;
}

const objectKeys = function (obj) {
    const keys = [];
    if (isArray(obj) || isObject(obj)) {
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                keys.push(key);
            }
        }
    }
    return keys;
};
const objectValues = function (obj) {
    if(isObject(obj) || isArray(obj) ){
        return Object.values(obj);
    }
    return [];
};

const isProperty = function isProperty(obj, key) {
    return Object.hasOwnProperty.call(obj, key);
}
const isMethod = function isMethod(obj, key) {
    const a = isObject(obj) && obj && typeof obj[key] === 'function';
    return a;
}

/**
 * kiểm tra giá trị có trong mảng / object hay không
 * @param {array} arr mảng
 * @param {*} value
 * @returns {boolean}
 */
const hasValue = function hasValue(arr, value, checkType) {
    if (typeof arr === "undefined") return false;
    const t = getType(arr);
    if (t === 'array') {
        if (checkType === true) {
            for (let index = 0; index < arr.length; index++) {
                const v = arr[index];
                if (v === value) return true;
            }
        } else {
            return arr.indexOf(value) >= 0;
        }
    } else if (t === 'object') {
        if (checkType) {
            for (const key in arr) {
                if (arr.hasOwnProperty(key)) {
                    const v = arr[key];
                    if (v === value) {
                        return true;
                    }
                }
            }
        } else {
            for (const key in arr) {
                if (arr.hasOwnProperty(key)) {
                    const v = arr[key];
                    if (v === value) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

/**
 * kiểm tra giá trị có trong mảng / object hay không
 * @param {array} arr mảng
 * @param {*} value
 * @returns {boolean}
 */
const inArray = function inArray(arr, value, checkType) {
    if (typeof arr === "undefined") return false;
    const t = getType(arr);
    if (t != "array" && t != "object" && (isArray(value) || isObject(value))) {
        const c = arr;
        arr = value;
        value = c;
        const t = getType(arr);
    }
    if (t === 'array') {
        if (checkType === true) {
            for (let index = 0; index < arr.length; index++) {
                const v = arr[index];
                if (v === value) return true;
            }
        } else {
            return arr.indexOf(value) >= 0;
        }
    } else if (t === 'object') {
        if (checkType) {
            for (const key in arr) {
                if (arr.hasOwnProperty(key)) {
                    const v = arr[key];
                    if (v === value) {
                        return true;
                    }
                }
            }
        } else {
            for (const key in arr) {
                if (arr.hasOwnProperty(key)) {
                    const v = arr[key];
                    if (v === value) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
};


const cutWithout = function cutWithout(obj, keys) {
    const newObj = Object.create({});
    const oldObj = Object.create(obj);
    if (isArray(obj) || isObject(obj)) {
        const list = [];
        if (isArray(keys)) list = keys;
        else if (isObject(keys)) {
            for (const key in keys) {
                if (keys.hasOwnProperty(key)) {
                    list.push(keys[key]);
                }
            }
        }

        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (!inArray(list, key)) {
                    newObj[key] = oldObj[key];
                }
            }
        }
    }
    return newObj;
}

const copyWithout = function copyWithout(obj, keys) {
    const newObj = Object.create({});
    const oldObj = Object.create(obj);

    if (isArray(obj) || isObject(obj)) {
        const list = [];
        if (isArray(keys)) list = keys;
        else if (isObject(keys)) {
            for (const key in keys) {
                if (keys.hasOwnProperty(key)) {
                    list.push(keys[key]);
                }
            }
        }

        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (!inArray(list, key)) {
                    newObj[key] = oldObj[key];
                }
            }
        }
    }
    return newObj;
};


const copyByList = function copyByList(obj, keys) {
    const newObj = {};
    const oldObj = Object.create(obj);
    if (isArray(obj) || isObject(obj)) {
        const list = [];
        if (isArray(keys)) list = keys;
        else if (isObject(keys)) {
            for (const key in keys) {
                if (keys.hasOwnProperty(key)) {
                    const v = keys[key];
                    list.push(key);
                }
            }
        }

        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (inArray(list, key)) {
                    newObj[key] = oldObj[key];
                }
            }
        }
    }
    return newObj;
};


/**
 * lay ra gia tri nho nhat
 * @param {array|object} obj doi tuong mang chua cac gia tri 
 */
const minOf = function minOf(obj) {
    let min = NaN;
    if (arguments.length > 1 && !(isArray(obj) || isObject(obj))) {
        obj = [...arguments];
    }
    if (isArray(obj)) {
        for (let index = 0; index < obj.length; index++) {
            if (!isNumber(obj[index])) continue;
            const n = Number(obj[index]);

            if (isNaN(min) || !index)
                min = n;
            else if (n < min) min = n;
        }
    }
    else if (isObject(obj)) {
        let index = 0;
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (!isNumber(obj[index])) continue;
                else {
                    const n = Number(obj[index]);
                    if (isNaN(min) || !index) min = n;
                    else if (n < min) min = n;
                }
                index++;
            }
        }
    }
    return min;
};

/**
 * lay ra gia tri lon nhat
 * @param {array|object} obj doi tuong mang chua cac gia tri 
 */
const maxOf = function maxOf(obj) {
    let min = NaN;
    if (arguments.length > 1 && !(isArray(obj) || isObject(obj))) {
        obj = [...arguments];
    }
    if (isArray(obj)) {
        for (let index = 0; index < obj.length; index++) {
            if (!isNumber(obj[index])) continue;
            else {
                const n = Number(obj[index]);
                if (isNaN(min) || !index) min = n;
                else if (n > min) min = n;
            }
        }
    }
    else if (isObject(obj)) {
        let index = 0;
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (!isNumber(obj[index])) continue;
                else {
                    const n = Number(obj[index]);
                    if (isNaN(min) || !index) min = n;
                    else if (n > min) min = n;
                }
                index++;
            }
        }
    }
    return min;
};


const checkType = function checkType(type, value, absolultely) {
    if (typeof type !== "string" || !type) return false;
    const tl = type.toLowerCase();
    if (tl === "float") tl = 'number';
    if (tl === 'mixed') return true;
    const t = type.substr(0, 1).toUpperCase() + type.substr(1).toLowerCase();
    const t2 = getType(value);
    return absolultely ? t2 === tl : t2 === tl;
};

/**
 * Kiểm tra tồn tại key hay ko?
 * @param {object|array} obj doi tuong can kiem tra
 * @param {string} key 
 * @returns {boolean}
 */
function objectHasKey(obj, key) {
    return (isObject(obj) && isString(key) && Object.hasOwnProperty.call(obj, key));
}

/**
 * kiểm tra sự tồn tại của thuộc tinh thông qua key và kiểu giá trị
 * @param {any} obj doi tuong can kiem tra
 * @param {string} key danh sach key kem kiey gia tri
 * @param {string} type kieu gia tri
 * @returns {boolean}
 */
const objectHasProperty = function objectHasProperty(obj, key, type) {
    if (!isObject(obj) || isEmpty(obj) || typeof key === "undefined" || (!isString(key) && !isArray(key))) return false;
    const keys = isArray(key) ? key : [key + (isString(type) ? ":" + type : "")];
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const ks = k.split(':');
        const kv = ks[0];
        if (!objectHasKey(obj, kv)) return false;
        if (ks.length === 2) {
            const b = ks[1].split('|').map(function (t) { return t.trim(); }).filter(function (vl) { return vl.length > 0; });
            if (b.length && !inArray(b, getType(obj[kv]))) return false;
        }
    }
    return true;
}


const getTimeStamp = function () {
    let offset = 0;
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);

    // create new Date object for different city
    // using supplied offset
    d = new Date(utc + (3600000 * offset));



    return d.getTime();
};

const rgbToHex = function (rgb) {
    const hex = parseInt(rgb).toString(16);
    if (hex.length < 2) {
        const hex = "0" + hex;
    }
    return hex;
};
const colorToHex = function (r, g, b) {
    const red = rgbToHex(r);
    const green = rgbToHex(g);
    const blue = rgbToHex(b);
    return "#" + red + green + blue;
};

const invertHexColor = function invertHexColor(hexTripletColor) {
    let color = hexTripletColor;
    color = color.substring(1); // remove #
    color = parseInt(color, 16); // convert to integer
    color = 0xFFFFFF ^ color; // invert three bytes
    color = color.toString(16); // convert to hex
    color = ("000000" + color).slice(-6); // pad with leading zeros
    color = "#" + color; // prepend #
    return color;
}


/**
 * lấy danh sách tham số nội hàm khi dược gọi
 * @param {Arguments} args tham số nội hàm
 * @param {integer} start vị trí bắt đầu lấy tham số
 * @returns {mixed[]}
 */
function getArguments(args, start) {
    const a = [];
    if (!isNumber(start) || start < 0) start = 0;
    if (args && args.length) {
        for (let i = start; i < args.length; i++) {
            const arg = args[i];
            a.push(arg);
        }
    }
    return a;
}


function JsonToBase64(data) {
    return "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
}


function b64toBlob(b64Data, contentType, sliceSize) {
    if (!contentType) contentType = '';
    if (!sliceSize) sliceSize = 512;
    const byteCharacters = atob(b64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);

        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: contentType });
    return blob;
}





/**
 * resize anh
 * @param {string|Element} img anh
 * @param {int} resizeWidth do rong 
 * @param {int} resizeHeight chieu cao
 * @param {function} callback ham call back
 */
function resizeImage(img, resizeWidth, resizeHeight, callback) {
    function fn(imgTag) {
        const canvas = document.createElement('canvas');
        canvas.setAttribute('width', resizeWidth);
        canvas.setAttribute('height', resizeHeight);


        const ctx = canvas.getContext("2d");

        const imageWidth = imgTag.width;
        const imageHeight = imgTag.height;

        let zoomWidth = imageWidth, zoomHeight = imageHeight;
        const imageRatio = imageWidth / imageHeight;
        const resizeRatio = resizeWidth / resizeHeight;
        // tỉ lệ là dài trên cao

        if (imageRatio < resizeRatio) { // Nếu rỉ lệ của ảnh nhỏ hơn tỷ lệ resize thì sẽ zoom ảnh theo chiều rộng resize
            zoomWidth = resizeWidth;
            zoomHeight = zoomWidth / imageRatio;
        } else { // nhược lại sẽ zoom ảnh theo chiều cao resize
            zoomHeight = resizeHeight;
            zoomWidth = zoomHeight * imageRatio;
        }

        // var image = new Image();
        // image.src = imgTag.src;
        // console.log(imageWidth, imageHeight, zoomWidth, zoomHeight, (resizeWidth - zoomWidth) / 2, (resizeHeight - zoomHeight) / 2);
        ctx.drawImage(imgTag, (resizeWidth - zoomWidth) / 2, (resizeHeight - zoomHeight) / 2, zoomWidth, zoomHeight);
        // console.log(canvas)
        const url = canvas.toDataURL("image/png");
        callback(url);

    }
    return isString(img) ? function () {
        const el = document.createElement('img');
        el.crossOrigin = "anonymous";
        el.onload = function () {
            // window['img00'] = el
            fn(el);

        }
        el.src = img;
        return el;
    }() :
        img instanceof Element ? fn(img) : null;
}

const degreeToRadians = function (degrees) {
    if (!isNumber(degrees) || isNaN(degrees) || degrees === "") degrees = 0;
    return degrees * Math.PI / 180;
};
const radianToDegrees = function (radians) {
    if (!isNumber(radians) || isNaN(radians) || radians === '') radians = 0;
    return radians * 180 / Math.PI;
}


const EMPTY_VALUE = "<EMPTY>" + new Date().toLocaleString() + "</EMPTY>";


const getFirstValueInList = function (list, key, checkFn) {
    let val = EMPTY_VALUE;
    if (isArray(list) && isString(key)) {
        if (isFunction(checkFn)) {
            for (let index = 0; index < list.length; index++) {
                const currentObject = list[index];
                if (isObject(currentObject)) {
                    if (Object.hasOwnProperty.call(currentObject, key)) {
                        if (checkFn(currentObject[key])) {
                            return currentObject[key];
                        }
                    }
                }
            }
        } else {
            for (let index = 0; index < list.length; index++) {
                const currentObject = list[index];
                if (isObject(currentObject)) {
                    if (Object.hasOwnProperty.call(currentObject, key)) {
                        if (currentObject[key] !== "" && currentObject[key] !== null && currentObject[key] !== undefined) return currentObject[key];
                    }
                }
            }
        }
    }
    return val;
};
export {
  b64toBlob,
  checkType,
  colorToHex,
  copyByList,
  copyWithout,
  cutWithout,
  degreeToRadians,
  EMPTY_VALUE,
  getArguments,
  getFirstValueInList,
  getTimeStamp,
  getType,
  hasValue,
  inArray,
  invertHexColor,
  isArray,
  isBoolean,
  isCallable,
  isEmail,
  isEmpty,
  isFloat,
  isFormData,
  isFunction,
  isInteger,
  isMethod,
  isNull,
  isNumber,
  isObject,
  isProperty,
  isString,
  JsonToBase64,
  maxOf,
  minOf,
  objectHasKey,
  objectHasProperty,
  objectKeys,
  objectValues,
  radianToDegrees,
  resizeImage
};
