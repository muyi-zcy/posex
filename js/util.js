import {colors} from "./constants.js";

function getColor(is_point, index) {
    if (index >= 20 && is_point) {
        return [255, 0, 0]
    }
    if (index >= 20) {
        index = index % 20
    }
    return colors[index]
}


function findDescendants(tree, node) {
    const descendants = [];
    const visited = {};

    function dfs(currentNode) {
        if (visited[currentNode]) {
            return;
        }
        visited[currentNode] = true;
        descendants.push(currentNode);

        for (const [parent, child] of tree) {
            if (parent === currentNode && !visited[child]) {
                dfs(child);
            }
        }
    }

    dfs(node);
    return descendants;
}


function deepClone(value) {
    if (typeof value !== 'object' || value === null) {
        return value;
    }

    if (Array.isArray(value)) {
        const arrCopy = [];
        for (let i = 0; i < value.length; i++) {
            arrCopy[i] = deepClone(value[i]);
        }
        return arrCopy;
    }

    const objCopy = {};
    for (const key in value) {
        if (value.hasOwnProperty(key)) {
            objCopy[key] = deepClone(value[key]);
        }
    }
    return objCopy;
}


/**
 * 计算点 (x1, y1) 绕点 (cx, cy) 旋转到 (x2, y2) 的弧度
 * @param {number} x1 - 移动前的点的x坐标
 * @param {number} y1 - 移动前的点的y坐标
 * @param {number} x2 - 移动后的点的x坐标
 * @param {number} y2 - 移动后的点的y坐标
 * @param {number} cx - 旋转中心点的x坐标
 * @param {number} cy - 旋转中心点的y坐标
 * @returns {number} 弧度
 */
function calculateRotationAngleBetweenPoints(x1, y1, x2, y2, cx, cy) {
    // 计算移动前向量 (x1 - cx, y1 - cy) 的角度
    const deltaX1 = x1 - cx;
    const deltaY1 = y1 - cy;
    const radians1 = Math.atan2(deltaY1, deltaX1);

    // 计算移动后向量 (x2 - cx, y2 - cy) 的角度
    const deltaX2 = x2 - cx;
    const deltaY2 = y2 - cy;
    const radians2 = Math.atan2(deltaY2, deltaX2);

    // 计算两者之间的角度差
    let angleDifference = radians2 - radians1;

    // 规范化到 (-π, π)
    if (angleDifference > Math.PI) {
        angleDifference -= 2 * Math.PI;
    } else if (angleDifference < -Math.PI) {
        angleDifference += 2 * Math.PI;
    }

    return angleDifference;
}


/**
 * 计算点 (x, y) 绕中心点 (cx, cy) 旋转 theta 弧度后的新坐标
 * @param {number} x - 初始点的x坐标
 * @param {number} y - 初始点的y坐标
 * @param {number} cx - 旋转中心点的x坐标
 * @param {number} cy - 旋转中心点的y坐标
 * @param {number} theta - 旋转的弧度
 * @returns {Object} 新坐标 { x: newX, y: newY }
 */
function rotatePoint(x, y, cx, cy, theta) {
    // 计算旋转后的新坐标
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);

    const newX = cx + (x - cx) * cosTheta - (y - cy) * sinTheta;
    const newY = cy + (x - cx) * sinTheta + (y - cy) * cosTheta;

    return [newX, newY]
}


function findBoundingBox(points) {
    if (points.length === 0) {
        return null
    }

    let minX = points[0][0];
    let maxX = points[0][0];
    let minY = points[0][1];
    let maxY = points[0][1];

    for (let i = 1; i < points.length; i++) {
        let [x, y] = points[i];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }

    return [minY, maxY, minX, maxX];
}

function rotatePointAroundVector(axisStart, axisEnd, point, direction, degrees) {
    const radians = degrees * (Math.PI / 180);
    const theta = direction === 'clockwise' ? -radians : radians;

    const A = [
        axisEnd[0] - axisStart[0],
        axisEnd[1] - axisStart[1],
        axisEnd[2] - axisStart[2]
    ];

    const norm = Math.sqrt(A[0] ** 2 + A[1] ** 2 + A[2] ** 2);
    const [A_x, A_y, A_z] = [A[0] / norm, A[1] / norm, A[2] / norm];

    const P = [
        point[0] - axisStart[0],
        point[1] - axisStart[1],
        point[2] - axisStart[2]
    ];

    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);

    const dotProduct = P[0] * A_x + P[1] * A_y + P[2] * A_z;
    const crossProduct = [
        A_y * P[2] - A_z * P[1],
        A_z * P[0] - A_x * P[2],
        A_x * P[1] - A_y * P[0]
    ];

    const P_prime = [
        P[0] * cosTheta + crossProduct[0] * sinTheta + A_x * dotProduct * (1 - cosTheta),
        P[1] * cosTheta + crossProduct[1] * sinTheta + A_y * dotProduct * (1 - cosTheta),
        P[2] * cosTheta + crossProduct[2] * sinTheta + A_z * dotProduct * (1 - cosTheta)
    ];

    // Translate point back
    return [
        P_prime[0] + axisStart[0],
        P_prime[1] + axisStart[1],
        P_prime[2] + axisStart[2]
    ];
}

export {
    getColor,
    findDescendants,
    deepClone,
    calculateRotationAngleBetweenPoints,
    rotatePoint,
    findBoundingBox,
    rotatePointAroundVector
}