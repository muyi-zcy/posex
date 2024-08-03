import {
    calculateRotationAngleBetweenPoints,
    deepClone,
    findBoundingBox,
    findDescendants,
    getColor,
    rotatePoint, rotatePointAroundVector
} from "./util.js";

import {
    JOINT_RADIUS, limb_pairs, POSE_CANVAS_SCALE
} from './constants.js'
import {Stack} from "./stack.js";
import * as THREE from "./three.module.js";
import {MeshLine, MeshLineMaterial} from "./THREE.MeshLine.Module.min.js";
import {saveGesture} from "./client.js";


class Frame {
    constructor(scene, id = null, frame_img, current_pose, index = 0, current_frame_width_value, current_frame_height_value, last_frame = null, next_frame = null, last_pose = null, next_pose = null, unit = null, drag_controls = null, magnification = 1, px = 0, py = 0) {
        this.scene = scene
        this.id = id
        this.frame_img = frame_img
        this.current_pose = current_pose
        this.index = index
        this.current_frame_width_value = current_frame_width_value
        this.current_frame_height_value = current_frame_height_value
        this.history = new Stack()
        this.delete_points = new Set()
        this.group = new THREE.Group();
        this.joints = []
        this.limbs = []
        this.drag_controls = drag_controls
        this.last_frame = last_frame
        this.next_frame = next_frame
        this.last_pose = last_pose
        this.next_pose = next_pose
        this.unit = unit
        this.magnification = magnification
        this.px = px
        this.py = py
        this.is_preview = false
        this.frame_list = []
        this.createBody()
    }

    createBody() {
        this.joints = []
        this.limbs = []
        this.group = new THREE.Group();
        const w = this.current_frame_width_value
        const h = this.current_frame_height_value
        const position_data = this.poseConvertToPosition()

        const main = new THREE.Group()

        for (let i = 0; i < position_data.length; ++i) {
            const [x, y, z] = position_data[i];
            const [r, g, b] = getColor(true, i);
            const color = (r << 16) | (g << 8) | (b << 0);
            let radius = JOINT_RADIUS
            const geom = new THREE.SphereGeometry(radius, 32, 32);
            const mat = new THREE.MeshBasicMaterial({color: color});
            const joint = new THREE.Mesh(geom, mat);
            joint.name = i;
            joint.position.x = x;
            joint.position.y = y;
            joint.position.z = z;
            this.joints.push(joint);
        }


        for (let i = 0; i < limb_pairs.length; ++i) {
            const [r, g, b] = getColor(false, i);
            const color = (r << 16) | (g << 8) | (b << 0);
            const line = new MeshLine();
            const mat = new MeshLineMaterial({color: color, opacity: 0.8, transparent: true});
            const mesh = new THREE.Mesh(line, mat)
            this.limbs.push(mesh);
        }
        for (let joint of this.joints) {
            this.group.add(joint);
        }
        for (let limb of this.limbs) {
            this.group.add(limb);
        }
        this.reShowOrHide()

    }


    updatePoseData(new_pose_data) {
        this.history.push(deepClone(this.current_pose))
        this.current_pose = new_pose_data
        this.reCreateBody()
    }

    reCreateBody() {
        const w = this.current_frame_width_value
        const h = this.current_frame_height_value
        const position_data = this.poseConvertToPosition()
        for (let i = 0; i < position_data.length; ++i) {
            const [x, y, z] = position_data[i];
            const joint = this.joints[i]
            joint.position.x = x;
            joint.position.y = y;
        }
        this.reShowOrHide()
    }

    movePoint(point_index) {
        let [x, y, z] = this.current_pose[point_index]
        x = this.poseConvertToPositionX(x)
        y = this.poseConvertToPositionY(y)

        const joint = this.joints[point_index]
        const [jx, jy, jz] = joint.position

        const xd = jx - x
        const yd = jy - y
        const child_point = findDescendants(limb_pairs, point_index)

        for (const point of child_point) {
            if (point_index === point) {
                continue
            }
            let [px, py, pz] = this.current_pose[point]
            px = this.poseConvertToPositionX(px) + xd
            py = this.poseConvertToPositionY(py) + yd
            this.joints[point].position.x = px;
            this.joints[point].position.y = py;
        }
    }

    rotatePoint(point_index) {
        // 获得中心点
        const center_point_index = this.getParentPoint(point_index)
        if (center_point_index == null) {
            return
        }

        // 中心点的坐标
        let [cx, cy, cz] = this.current_pose[center_point_index]
        cx = this.poseConvertToPositionX(cx)
        cy = this.poseConvertToPositionY(cy)

        // 移动前的点坐标
        let [x1, y1, z1] = this.current_pose[point_index]
        x1 = this.poseConvertToPositionX(x1)
        y1 = this.poseConvertToPositionY(y1)
        //  移动后的点坐标

        console.log(x1, y1, this.joints[point_index].position)

        const [x2, y2, z2] = this.joints[point_index].position

        const rota = calculateRotationAngleBetweenPoints(x1, y1, x2, y2, cx, cy)


        const [nx, ny] = rotatePoint(x1, y1, cx, cy, rota)

        this.joints[point_index].position.x = nx;
        this.joints[point_index].position.y = ny;


        const child_point = findDescendants(limb_pairs, point_index)

        for (const point of child_point) {
            if (point_index === point) {
                continue
            }
            let [px, py, pz] = this.current_pose[point]
            px = this.poseConvertToPositionX(px)
            py = this.poseConvertToPositionY(py)

            const [nx, ny] = rotatePoint(px, py, cx, cy, rota)

            this.joints[point].position.x = nx;
            this.joints[point].position.y = ny;
        }
    }


    reShowOrHide() {
        for (const joint of this.joints) {
            if (this.delete_points.has(joint.name)) {
                joint.visible = false
            } else {
                joint.visible = true
            }
        }

        let index = 0
        for (const [from_index, to_index] of limb_pairs) {
            if (this.delete_points.has(to_index)) {
                this.limbs[index].visible = false
            } else {
                this.limbs[index].visible = true
            }
            index++
        }
    }

    refreshPostion() {
        this.history.push(deepClone(this.current_pose))
        this.positionConvertToPose()
    }

    startPlay(frame_list) {
        this.frame_list = frame_list
    }

    play(index) {
        if (index === this.index) {
            this.history.push(deepClone(this.current_pose))
        }
        this.current_pose = this.frame_list[index]
        this.reCreateBody()
    }

    stopPlay() {
        this.backHistory()
        this.reCreateBody()
    }


    // 坐标是否有修改
    positionHasChange() {
        return !this.history.isEmpty()
    }

    backHistory(step = 1) {
        if (this.history.size() === 0) {
            return
        }
        if (step === -1) {
            while (true) {
                if (this.history.size() > 0) {
                    this.current_pose = this.history.pop()
                } else {
                    break
                }
            }
        } else {
            while (step > 0) {
                this.current_pose = this.history.pop()
                step--
            }
        }
    }

    //  由pose坐标转canvas坐标
    poseConvertToPosition() {
        const new_current_pose = deepClone(this.current_pose)
        let index = 0
        this.delete_points = new Set()
        for (let xyz of new_current_pose) {
            const x = xyz[0]
            const y = xyz[1]
            if (x === -1 || y === -1 || this.delete_points.has(index)) {
                this.delete_points.add(index)
                const child_delete_point = findDescendants(new_current_pose, index)
                for (const point of child_delete_point) {
                    this.delete_points.add(point)
                }
                xyz[0] = -1
                xyz[1] = -1
            } else {
                xyz[0] = this.poseConvertToPositionX(x)
                xyz[1] = this.poseConvertToPositionY(y)
            }
            index = index + 1
        }
        return new_current_pose
    }

    poseConvertToPositionX(x) {
        x = ((x - 0.5) * POSE_CANVAS_SCALE) * this.unit
        return x * this.magnification - this.px
    }

    poseConvertToPositionY(y) {
        y = (((-2 * y + 1) * (this.current_frame_height_value / (2 * this.current_frame_width_value))) * POSE_CANVAS_SCALE) * this.unit
        return y * this.magnification + this.py;
    }

    //  由canvas坐标转pose坐标
    positionConvertToPose() {
        const new_standard_pose = []
        let index = 0
        for (let joint of this.joints) {
            const [x, y, z] = joint.position
            let xyz = [-1, 0, 0]
            if (x === -1 || y === -1 || this.delete_points.has(index)) {
                xyz[0] = -1
                xyz[1] = -1
            } else {
                xyz[0] = this.positionConvertToPoseX(x)
                xyz[1] = this.positionConvertToPoseY(y)
            }
            new_standard_pose.push(xyz)
            index = index + 1
        }
        this.current_pose = new_standard_pose
        return new_standard_pose
    }

    positionConvertToPoseX(x) {
        x = (x + this.px) / this.magnification
        return ((x / this.unit) / POSE_CANVAS_SCALE) + 0.5
    }

    positionConvertToPoseY(y) {
        y = (y - this.py) / this.magnification
        return 0.5 - ((this.current_frame_width_value * ((y / this.unit) / POSE_CANVAS_SCALE)) / this.current_frame_height_value)
    }

    deletePointWithChild(index) {
        const pose_data = deepClone(this.current_pose)
        const descendants = findDescendants(limb_pairs, index)
        for (const element of descendants) {
            pose_data[element] = [-1, -1, 0]
        }
        this.updatePoseData(pose_data)
    }

    findChildPoint(index) {
        const descendants = [];
        for (let i = 0; i < limb_pairs.length; ++i) {
            const [from_index, to_index] = limb_pairs[i];
            if (from_index === index) {
                descendants.push(to_index)
            }
        }
        return descendants;
    }


    pose_zoom(x, y, magnification) {
        this.magnification = magnification
        this.px = x === null ? this.px : magnification * x
        this.py = y === null ? this.py : magnification * y
        // 放大坐标
        let index = 0
        for (const point of this.current_pose) {
            if (this.delete_points.has(index)) {
                index++
                continue
            }
            this.joints[index].position.x = this.poseConvertToPositionX(point[0])
            this.joints[index].position.y = this.poseConvertToPositionY(point[1])
            index++
        }
    }

    isHandPoint(index) {
        return index === 20 || index === 41
    }

    isMainPoint(index) {
        return index === 1
    }

    getParentPoint(point_index) {
        for (let i = 0; i < limb_pairs.length; ++i) {
            const [from_index, to_index] = limb_pairs[i];
            if (to_index === point_index) {
                return from_index
            }
        }
        return null
    }

    replaceLastPoint(index, is_all_child, pose_data = null) {
        if (pose_data == null) {
            pose_data = deepClone(this.current_pose)
        }
        // 替换某个固定的节点
        if (!is_all_child) {
            pose_data[index] = this.last_pose[index]
        } else {

            // 替换全部子节点
            const all_child = findDescendants(limb_pairs, index)
            for (const child of all_child) {
                pose_data[child] = this.last_pose[child]
            }
        }
        this.updatePoseData(pose_data)
    }

    replaceNextPoint(index, is_all_child, pose_data = null) {
        if (pose_data == null) {
            pose_data = deepClone(this.current_pose)
        }
        if (!is_all_child) {
            pose_data[index] = this.next_pose[index]
        } else {
            // 替换全部子节点
            const all_child = findDescendants(limb_pairs, index)
            for (const child of all_child) {
                pose_data[child] = this.next_pose[child]
            }
        }

        this.updatePoseData(pose_data)
    }


    replaceLastAndNextPoint(index, is_all_child, default_position) {
        const pose_data = deepClone(this.current_pose)
        if (!is_all_child) {
            const last_point = this.last_pose != null ? this.last_pose[index] : [-1, -1]
            const next_point = this.next_pose != null ? this.next_pose[index] : [-1, -1]
            pose_data[index] = this.mergePoint(default_position, last_point, next_point)
        } else {
            // 替换全部子节点
            const all_child = findDescendants(limb_pairs, index)
            for (const child of all_child) {
                const last_point = this.last_pose[child]
                const next_point = this.next_pose[child]
                pose_data[child] = this.mergePoint(default_position, last_point, next_point)
            }
        }

        this.updatePoseData(pose_data)
    }


    replaceSomeLastAndNextPoint(point_index_pose_list) {
        const pose_data = deepClone(this.current_pose)
        for (const [index, is_all_child, default_position] of point_index_pose_list) {
            if (!is_all_child) {
                const last_point = this.last_pose != null ? this.last_pose[index] : [-1, -1]
                const next_point = this.next_pose != null ? this.next_pose[index] : [-1, -1]
                pose_data[index] = this.mergePoint(default_position, last_point, next_point)
            } else {
                // 替换全部子节点
                const all_child = findDescendants(limb_pairs, index)
                for (const child of all_child) {
                    const last_point = this.last_pose[child]
                    const next_point = this.next_pose[child]
                    pose_data[child] = this.mergePoint(default_position, last_point, next_point)
                }
            }
        }
        this.updatePoseData(pose_data)
    }


    replaceReference(index, pose_list) {
        const new_pose_data = deepClone(this.current_pose)
        const ref_pose = this.current_pose[index]
        const root_pose = pose_list[0]
        const px = root_pose[0] - ref_pose[0]
        const py = root_pose[1] - ref_pose[1]
        for (let i = 1; i < 21; i++) {
            if (pose_list[i][0] === -1 || pose_list[i][1] === -1) {
                new_pose_data[index + i] = [-1, -1, 0]
            } else {
                new_pose_data[index + i] = [pose_list[i] [0] - px, pose_list[i] [1] - py, 0]
            }
        }
        this.updatePoseData(new_pose_data)
    }

    mergePoint(default_value, ...points) {
        let x = 0, y = 0
        let count = 0
        for (const point of points) {
            if (point[0] === -1 || point[1] === -1) {
                continue
            }
            x = x + point[0]
            y = y + point[1]
            count++
        }
        if (count === 0) {
            return default_value
        } else {
            x = x / count
            y = y / count
            return [x, y, 0]
        }
    }

    removeMesh() {
        this.scene.remove(this.group)
    }

    saveGestureWithCallback(point_index, callback) {
        // 获取指定的手部坐标
        let hand_pose_list = this.current_pose.slice(point_index, point_index + 21)
        // 获取顶点坐标
        let box = findBoundingBox(hand_pose_list)
        box = [
            box[0],
            box[1],
            box[2],
            box[3]
        ]
        const data = {
            "id": this.id,
            "index": this.index,
            "hand_pose": hand_pose_list,
            "box": box
        }
        saveGesture(data, callback)
    }


    horizontalFlip(index) {
        const descendants = findDescendants(limb_pairs, index)
        let px = this.joints[index].position.x
        for (const element of descendants) {
            if (element === index || this.delete_points.has(descendants)) {
                continue
            }
            let x = this.joints[element].position.x
            if (x < px) {
                this.joints[element].position.x = x + (2 * (px - x))
            } else {
                this.joints[element].position.x = x - (2 * (x - px))
            }
        }
        this.refreshPostion()
    }

    verticalFlip(index) {
        const descendants = findDescendants(limb_pairs, index)
        let py = this.joints[index].position.y
        for (const element of descendants) {
            if (element === index || this.delete_points.has(descendants)) {
                continue
            }
            let y = this.joints[element].position.y
            if (y < py) {
                this.joints[element].position.y = y + (2 * (py - y))
            } else {
                this.joints[element].position.y = y - (2 * (y - py))
            }
        }
    }

    minificationAndExpansion(index, horizontal_value, vertical_value) {
        const descendants = findDescendants(limb_pairs, index)
        let [px, py, pz] = this.current_pose[index]
        px = this.poseConvertToPositionX(px)
        py = this.poseConvertToPositionY(py)

        let [ex, ey, ez] = this.current_pose[index + 9]
        ex = this.poseConvertToPositionX(ex)
        ey = this.poseConvertToPositionY(ey)

        for (const element of descendants) {
            if (element === index || this.delete_points.has(descendants)) {
                continue
            }
            let [x, y, z] = rotatePointAroundVector([px, py, pz], [ex, ey, ez], [this.poseConvertToPositionX(this.current_pose[element][0]), this.poseConvertToPositionY(this.current_pose[element][1]), 0], 'clockwise', horizontal_value)
            this.joints[element].position.x = x
            // this.joints[element].position.y = y
            this.joints[element].position.z = 0
        }

        for (const element of descendants) {
            if (this.delete_points.has(descendants)) {
                continue
            }

            let [x, y, z] = rotatePointAroundVector([px, py, pz], [ey, -ex, pz], [this.poseConvertToPositionX(this.current_pose[element][0]), this.poseConvertToPositionY(this.current_pose[element][1]), 0], 'clockwise', vertical_value)

            // this.joints[element].position.x = x
            this.joints[element].position.y = y
            this.joints[element].position.z = 0
        }
    }
}


export {Frame}