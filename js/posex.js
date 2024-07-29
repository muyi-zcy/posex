import {Frame} from "./frame.js";
import {
    downloadImage,
    endPreviewUI,
    hideCanvasMenuUI,
    initProgressSliderValue,
    openDialog,
    closeDialog,
    showCanvasMenuUI,
    startPreviewUI,
    updateProgressSliderValue,
    openSmoothDialog,
    closeSmoothDialog,
    setSmoothValue,
    updateVerticalFlipSliderValue,
    showPopupFlip,
    initFlipSliderValue,
    hidePopupFlip,
    updateHorizontalFlipSliderValue,
    endSmoothPreviewUI,
    startSmoothPreviewUI
} from './ui.js'

import {
    default_bg,
    default_pose,
    DEFAULT_WIDTH,
    LIMB_N,
    limb_pairs,
    LIMB_SIZE,
    point_name_index,
    POSE_CANVAS_SCALE,
    WIDTH_HEIGHT_SCALE
} from './constants.js'
import {
    deleteCacheById, deleteGesture,
    downloadPoseById, downloadSmooth,
    getAllFrameById,
    getFrameByIndex, listGesture, previewSmoothById,
    recognizePoseFrameByIndex,
    saveFrameByIndex,
    uploadmateriel
} from "./client.js";
import {addEventListener, closeListener, Event, openListener} from "./listener.js";

async function _import() {
    const THREE = await import('three');
    const {DragControls} = await import('three-dragcontrols');
    const {MeshLine, MeshLineMaterial} = await import('three-meshline');
    return {THREE, DragControls, MeshLine, MeshLineMaterial};
}

const {THREE, DragControls, MeshLine, MeshLineMaterial} = await _import();


let current_frame = null

let id = 'default'

let index = 0
let count = 1

let is_bg = true
let is_pose = true

let is_hoveron = false
let is_drop = false
let is_smooth = false

let tap_point_index = null
let smooth_value = new Set()

let submenu;

let degrees = 0

let is_lock = false
let is_menu = false

let bg = null

let is_ctrl = false
let is_ctrl_status = false

let is_capslock = false

let is_shift = false
let is_alt = false
const magnification = 3

let is_preview = false

let play_frame_index = 0

function init_3d(ui) {
    const container = ui.container
    const canvas = ui.canvas

    const width = () => canvas.width
    const height = () => canvas.height
    const unit = () => Math.min(width(), height())
    const unit_max = () => Math.max(width(), height());

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(width() / -2, width() / 2, height() / 2, height() / -2, 1, width() * 4);
    camera.fixed_roll = false;
    camera.position.z = unit_max() * 2;


    const renderer = new THREE.WebGLRenderer({
        canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true,
    });

    renderer.setSize(width(), height());

    current_frame = new Frame(scene, id, default_bg(), default_pose, index = 0, width(), height(), null, null, null, null, unit())
    // 设置拖放控制器
    current_frame.drag_controls = new DragControls(current_frame.joints, camera, renderer.domElement);
    ininDragControls()
    scene.add(current_frame.group);
    showOrHideBg(true)

    // 清理画布
    function cleanFrame() {
        // 清除上一帧残留数据
        // 清除背景
        scene.remove(current_frame.bg)
        current_frame.removeMesh()
        // 清除拖放控制器
        current_frame.drag_controls.deactivate()
        // 重置背景、骨骼隐藏数据
        is_bg = true
        is_pose = true
    }


    // 设置上下帧
    function setLastAndNextImg() {
        ui.last_frame_img.width = current_frame.current_frame_width_value * WIDTH_HEIGHT_SCALE
        ui.last_frame_img.height = current_frame.current_frame_height_value * WIDTH_HEIGHT_SCALE
        ui.next_frame_img.width = current_frame.current_frame_width_value * WIDTH_HEIGHT_SCALE
        ui.next_frame_img.height = current_frame.current_frame_height_value * WIDTH_HEIGHT_SCALE
        if (current_frame.last_frame != null) {
            ui.last_frame_img.style.visibility = 'visible';
            ui.last_frame_img.src = current_frame.last_frame
        } else {
            ui.last_frame_img.style.visibility = 'hidden';
        }
        if (current_frame.next_frame != null) {
            ui.next_frame_img.style.visibility = 'visible';
            ui.next_frame_img.src = current_frame.next_frame
        } else {
            ui.next_frame_img.style.visibility = 'hidden';
        }
    }


    // 从数据库加载frame数据
    function loadingFrameByIndex() {
        cleanFrame()
        getFrameByIndex(id, index, function (data) {
            const pose_data = data["pose"]
            const canvas_height = (data["height"] * DEFAULT_WIDTH) / data["width"]
            const canvas_width = DEFAULT_WIDTH

            const frame_img = data["bg"]
            const last_frame = data["last_frame"]
            const next_frame = data["next_frame"]
            const last_pose = data["last_pose"]
            const next_pose = data["next_pose"]

            // 创建新的frame对象
            current_frame = new Frame(scene, id, frame_img, pose_data, index, canvas_width, canvas_height, last_frame, next_frame, last_pose, next_pose, unit())
            current_frame.drag_controls = new DragControls(current_frame.joints, camera, renderer.domElement);
            ininDragControls()
            scene.add(current_frame.group);
            setBg(0, 0, POSE_CANVAS_SCALE)
            setLastAndNextImg()
            is_lock = false
        })
    }


    // 文件上传
    function materiel() {
        altKeyUp()
        savePose(function () {
            uploadmateriel(ui, function (data) {
                id = data["id"]
                count = data["count"] - 1
                initProgressSliderValue(count)
                index = 0
                loadingFrameByIndex()
            })
        })
    }

    function showOrHideBg(status = null) {
        if (status != null) {
            is_bg = !status
        }
        // 如果没有背景图
        if (current_frame == null || current_frame.frame_img == null || current_frame.frame_img.isColor) {
            scene.background = default_bg();
            return;
        }
        // 隐藏
        if (is_bg) {
            is_bg = false
            bg.visible = false
            return;
        }
        // 显示
        is_bg = true
        bg.visible = true
    }

    function setBg(cpx, cpy, magnification = POSE_CANVAS_SCALE) {
        scene.remove(bg)
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(current_frame.frame_img, function (texture) {
            var geometry = new THREE.PlaneGeometry(current_frame.current_frame_width_value * magnification, current_frame.current_frame_height_value * magnification);
            var material = new THREE.MeshBasicMaterial({map: texture});
            bg = new THREE.Mesh(geometry, material);
            bg.position.set(cpx, cpy, -1);
            scene.add(bg)
        });
    }

    function showOrHidePose() {
        if (is_pose === true) {
            is_pose = false
            current_frame.group.visible = false
            return
        }
        is_pose = true
        current_frame.group.visible = true
    }


    function resetPose() {
        current_frame.backHistory(-1)
        current_frame.reCreateBody()
    }


    function lastStepPose() {
        current_frame.backHistory()
        current_frame.reCreateBody()
    }

    function recognizePoseFrame() {
        recognizePoseFrameByIndex(current_frame.id, current_frame.index, function (data) {
            loadingFrameByIndex()
        })
    }

    function savePose(callback = null) {
        saveFrameByIndex(current_frame.positionHasChange(), current_frame.id, current_frame.index, current_frame.current_pose, callback)
    }

    function downloadImg() {
        downloadImage(ui)
    }

    function downloadPose() {
        downloadPoseById(current_frame.id,)
    }

    function deleteCache() {
        deleteCacheById(current_frame.id, function () {
            location.reload()
        })
    }

    function loadLastPose() {
        if (current_frame.index === 0) {
            return
        }
        current_frame.updatePoseData(current_frame.last_pose)
    }

    function loadNextPose() {
        if (current_frame.index >= count - 1) {
            return
        }
        current_frame.updatePoseData(current_frame.next_pose)
    }

    function lastFrameImg() {
        altKeyUp()
        if (current_frame.index === 0) {
            return
        }
        if (is_lock) {
            return
        }
        is_lock = true
        savePose(function () {
            index = index - 1
            updateProgressSliderValue(index)
            loadingFrameByIndex()
        })

    }

    function nextFrameImg() {
        altKeyUp()
        if (current_frame.index >= count - 1) {
            return
        }
        if (is_lock) {
            return
        }
        is_lock = true
        savePose(function () {
            index = index + 1
            updateProgressSliderValue(index)
            loadingFrameByIndex()
        })
    }

    function importLastPoint() {
        if (tap_point_index == null) {
            hideCanvasMenuUI(ui)
            return
        }
        current_frame.replaceLastPoint(tap_point_index, current_frame.isHandPoint(tap_point_index))
        hideCanvasMenuUI(ui)
    }

    function importLastPointAll() {
        if (tap_point_index == null) {
            hideCanvasMenuUI(ui)
            return
        }
        current_frame.replaceLastPoint(tap_point_index, true)
        hideCanvasMenuUI(ui)
    }

    function importNextPoint() {
        if (tap_point_index == null) {
            hideCanvasMenuUI(ui)
            return
        }
        current_frame.replaceNextPoint(tap_point_index, current_frame.isHandPoint(tap_point_index))
        hideCanvasMenuUI(ui)
    }

    function importNextPointAll() {
        if (tap_point_index == null) {
            hideCanvasMenuUI(ui)
            return
        }
        current_frame.replaceNextPoint(tap_point_index, true)
        hideCanvasMenuUI(ui)
    }

    function deletePoint() {
        if (tap_point_index == null) {
            hideCanvasMenuUI(ui)
            return
        }
        current_frame.deletePointWithChild(tap_point_index)
        hideCanvasMenuUI(ui)
    }


    function updateProgress() {
        if (is_lock) {
            return
        }
        is_lock = true
        savePose(function () {
            index = parseInt(ui.progress_slider.value)
            updateProgressSliderValue(index)
            loadingFrameByIndex()
        })
    }


    function flip() {
        initFlipSliderValue()
        hideCanvasMenuUI(ui)
        showPopupFlip()
    }

    function closeFlipPopup() {
        hidePopupFlip()
        current_frame.refreshPostion()
    }

    function updateHorizontalFlipSlider() {
        const horizontal_value = parseInt(ui.horizontal_flip_slider.value)
        updateHorizontalFlipSliderValue(horizontal_value)
        const vertical_value = parseInt(ui.vertical_flip_slider.value)
        current_frame.minificationAndExpansion(tap_point_index, horizontal_value, vertical_value)
    }

    function updateVerticalFlipSlider() {
        const vertical_value = parseInt(ui.vertical_flip_slider.value)
        updateVerticalFlipSliderValue(vertical_value)
        const horizontal_value = parseInt(ui.horizontal_flip_slider.value)
        current_frame.minificationAndExpansion(tap_point_index, horizontal_value, vertical_value)
    }


    function showCanvasMenu(position, point_index) {
        showCanvasMenuUI(ui, position, current_frame.isHandPoint(point_index))
    }

    function hideCanvasMenu() {
        hideCanvasMenuUI(ui)
    }

    function altKeyDown() {
        is_alt = true
    }

    function altKeyUp() {
        is_alt = false
    }

    function shiftKeyDown() {
        is_shift = true
    }

    function shiftKeyUp() {
        is_shift = false
    }

    function ctrlKeyDown() {
        is_ctrl = true
    }

    function ctrlKeyUp() {
        if (is_ctrl && is_ctrl_status) {
            setBg(0, 0, POSE_CANVAS_SCALE)
            current_frame.pose_zoom(0, 0, 1)
        }
        is_ctrl = false
        is_ctrl_status = false
    }

    function capsLockUp() {
        is_capslock = false
    }

    function capsLockDown() {
        is_capslock = true
    }

    function arrowUp() {
        current_frame.magnification = current_frame.magnification + 0.2
        current_frame.pose_zoom(null, null, current_frame.magnification)
        setBg(-current_frame.px, current_frame.py, current_frame.magnification)
    }

    function arrowDown() {
        current_frame.magnification = current_frame.magnification - 0.2
        current_frame.pose_zoom(null, null, current_frame.magnification)
        setBg(-current_frame.px, current_frame.py, current_frame.magnification)
    }

    function previewFrame() {
        if (!is_preview) {
            startPreview()
            getAllFrameById(id, function (data) {
                current_frame.startPlay(data)
                play_frame_index = current_frame.index
                is_preview = true
            })
        } else {
            stopPreview()
        }
    }

    function previewSmooth() {
        if (!is_preview) {
            openListener([ui.smooth_preview])
            showOrHideBg(false)
            startSmoothPreviewUI()
            previewSmoothById(id, smooth_value, function (data) {
                current_frame.startPlay(data)
                play_frame_index = current_frame.index
                is_preview = true
            })
        } else {
            stopPreview()
        }
    }

    function startPreview() {
        openListener([ui.preview_frame])
        showOrHideBg(false)
        startPreviewUI()
    }

    function stopPreview() {
        is_preview = false
        showOrHideBg(true)
        current_frame.stopPlay()
        play_frame_index = current_frame.index
        closeListener()
        endSmoothPreviewUI()
        endPreviewUI()
        const progress_slider_value = parseInt(ui.progress_slider.value)
        if (progress_slider_value !== current_frame.index && progress_slider_value !== count - 1) {
            index = progress_slider_value
            loadingFrameByIndex()
            return
        }
        updateProgressSliderValue(play_frame_index)
    }


    function addPoint() {
        const child_points = current_frame.findChildPoint(tap_point_index)
        const new_child_point = []
        for (const point of child_points) {
            if (current_frame.delete_points.has(point)) {
                new_child_point.push(point)
            }
        }
        if (new_child_point.length === 0) {
            hideCanvasMenuUI(ui)
            return
        }
        if (current_frame.isMainPoint(tap_point_index)) {
            const tap_joint = current_frame.current_pose[tap_point_index]
            const point_index_pose_list = []
            if (new_child_point.includes(0)) {
                point_index_pose_list.push([0, false, [tap_joint[0], tap_joint[1] - 0.1, 0]])
            }
            if (new_child_point.includes(2)) {
                point_index_pose_list.push([2, false, [tap_joint[0] - 0.2, tap_joint[1], 0]])
            }
            if (new_child_point.includes(5)) {
                point_index_pose_list.push([5, false, [tap_joint[0] + 0.2, tap_joint[1], 0]])
            }
            if (new_child_point.includes(8)) {
                point_index_pose_list.push([8, false, [tap_joint[0] - 0.1, tap_joint[1] + 0.2, 0]])
            }
            if (new_child_point.includes(11)) {
                point_index_pose_list.push([11, false, [tap_joint[0] + 0.1, tap_joint[1] + 0.2, 0]])
            }
            current_frame.replaceSomeLastAndNextPoint(point_index_pose_list)
            hideCanvasMenuUI(ui)
            return
        }

        if (new_child_point.length === 1) {
            const tap_joint = current_frame.current_pose[tap_point_index]
            current_frame.replaceLastAndNextPoint(new_child_point[0], false, [tap_joint[0] + 0.05, tap_joint[1] + 0.05, 0])
            hideCanvasMenuUI(ui)
            return
        }
        if (current_frame.isHandPoint(tap_point_index)) {
            const tap_joint = current_frame.current_pose[tap_point_index]
            if (new_child_point.includes(21)) {
                current_frame.replaceLastAndNextPoint(21, false, [tap_joint[0] + 0.05, tap_joint[1] + 0.05, 0])
            } else if (new_child_point.includes(25)) {
                current_frame.replaceLastAndNextPoint(25, false, [tap_joint[0] + 0.05, tap_joint[1] + 0.05, 0])
            } else if (new_child_point.includes(29)) {
                current_frame.replaceLastAndNextPoint(29, false, [tap_joint[0] + 0.05, tap_joint[1] + 0.05, 0])
            } else if (new_child_point.includes(33)) {
                current_frame.replaceLastAndNextPoint(33, false, [tap_joint[0] + 0.05, tap_joint[1] + 0.05, 0])
            } else if (new_child_point.includes(37)) {
                current_frame.replaceLastAndNextPoint(37, false, [tap_joint[0] + 0.05, tap_joint[1] + 0.05, 0])
            } else if (new_child_point.includes(42)) {
                current_frame.replaceLastAndNextPoint(42, false, [tap_joint[0] + 0.05, tap_joint[1] + 0.05, 0])
            } else if (new_child_point.includes(46)) {
                current_frame.replaceLastAndNextPoint(46, false, [tap_joint[0] + 0.05, tap_joint[1] + 0.05, 0])
            } else if (new_child_point.includes(50)) {
                current_frame.replaceLastAndNextPoint(50, false, [tap_joint[0] + 0.05, tap_joint[1] + 0.05, 0])
            } else if (new_child_point.includes(54)) {
                current_frame.replaceLastAndNextPoint(54, false, [tap_joint[0] + 0.05, tap_joint[1] + 0.05, 0])
            } else if (new_child_point.includes(58)) {
                current_frame.replaceLastAndNextPoint(58, false, [tap_joint[0] + 0.05, tap_joint[1] + 0.05, 0])
            }
            hideCanvasMenuUI(ui)
        }
    }


    function openGesturelib() {
        hideCanvasMenu()
        listGesture(function (data) {
            openDialog(data, function (pose_data) {
                closeDialog()
                current_frame.replaceReference(tap_point_index, pose_data)
            }, function (id) {
                deleteGesture(id)
            })
        })
    }

    function saveGesture() {
        current_frame.saveGestureWithCallback(tap_point_index, function () {

        })
    }

    function horizontalFlip() {
        current_frame.horizontalFlip(tap_point_index)
    }

    function verticalFlip() {
        current_frame.verticalFlip(tap_point_index)
    }

    function smooth() {
        if (id === 'default') {
            return
        }
        if (is_smooth) {
            is_smooth = false
            closeSmoothDialog()
        } else {
            is_smooth = true
            openSmoothDialog()
        }
    }

    function smoothClean() {
        smooth_value = new Set()
        setSmoothValue("")
    }

    function smoothAndDownload() {
        is_smooth = false
        downloadSmooth(id, smooth_value)
        smooth_value = new Set()
        closeSmoothDialog()
    }

    function ininDragControls() {
        current_frame.drag_controls.addEventListener('drag', e => {
            if (is_hoveron) {
                is_drop = true
            }
        });

        current_frame.drag_controls.addEventListener('hoveron', e => {
            console.log("hoveron")
            tap_point_index = parseInt(e.object.name)
            ui.point_name.innerText = point_name_index[e.object.name]
            is_hoveron = true
        });

        current_frame.drag_controls.addEventListener('hoveroff', e => {
            console.log("hoveroff")
            tap_point_index = null
            ui.point_name.innerText = tap_point_index
            is_lock = false
            if (is_hoveron && is_drop) {
                is_hoveron = false
                is_drop = false
                current_frame.refreshPostion()
            }
            hideCanvasMenu()
            is_menu = false
        });

        renderer.domElement.addEventListener('contextmenu', e => {
            if (is_menu) {
                return
            }
            if (tap_point_index != null) {
                is_menu = true
                showCanvasMenu(e, tap_point_index)
            } else {
                is_menu = false
                hideCanvasMenu()
            }
        }, true);

        renderer.domElement.addEventListener('pointerdown', e => {
            console.log("pointerdown")
            if (is_ctrl && !is_ctrl_status) {
                is_ctrl_status = true
                const rect = canvas.getBoundingClientRect();
                let x = event.clientX - rect.left;
                let y = event.clientY - rect.top;
                x = x - (width() / 2)
                y = y - (height() / 2)
                // 放大背景
                setBg(-magnification * x, magnification * y, magnification)
                current_frame.pose_zoom(x, y, magnification)
            }
            if (is_smooth && tap_point_index !== null) {
                smooth_value.add(tap_point_index)
                let text = ""
                for (const value of smooth_value) {
                    text = text + point_name_index[value] + ","
                }
                setSmoothValue(text)
            }
        }, true);

        renderer.domElement.addEventListener('pointerup', e => {
            console.log("pointerup")
        }, true);
    }


    addEventListener([// 重置
        new Event(null, 'change', ui.materiel, materiel), new Event(['A', 'a'], 'click', ui.reset_pose, resetPose), // 重新识别
        new Event(['S', 's'], 'click', ui.recognize_pose_frame, recognizePoseFrame),

        // 显示隐藏背景
        new Event(['D', 'd'], 'click', ui.show_or_hide_bg, showOrHideBg), // 显示隐藏pose
        new Event(['F', 'f'], 'click', ui.show_or_hide_pose, showOrHidePose), //  保存
        new Event(['G', 'g'], 'click', ui.save_pose, savePose), //  下载图片
        new Event(['H', 'h'], 'click', ui.download_img, downloadImg), // 下载 pkl文件
        new Event(['J', 'j'], 'click', ui.download_pose, downloadPose), // 删除记录
        new Event(['Delete'], 'click', ui.delete_cache, deleteCache), // 导入其他帧
        new Event(['F', 'f'], 'click', ui.load_last_pose, loadLastPose),
        new Event(['L', 'l'], 'click', ui.load_next_pose, loadNextPose), // 导入其他帧的具体点、手部整体导入
        new Event(null, 'click', ui.import_last_point, importLastPoint), // 导入下一帧当前节点的全部子节点
        new Event(null, 'click', ui.import_last_point_all, importLastPointAll),
        new Event(null, 'click', ui.import_next_point, importNextPoint),
        new Event(null, 'click', ui.import_next_point_all, importNextPointAll),
        new Event(['Z', 'z'], 'click', ui.last_step, lastStepPose),
        new Event(['ArrowLeft'], 'click', ui.last_frame_img, lastFrameImg),
        new Event(['ArrowRight'], 'click', ui.next_frame_img, nextFrameImg),
        new Event(['ArrowUp'], 'click', null, arrowUp),
        new Event(['ArrowDown'], 'click', null, arrowDown),
        new Event(null, 'input', ui.progress_slider, updateProgress),
        new Event(null, 'click', ui.flip, flip),
        new Event(null, 'click', ui.close_flip_popup, closeFlipPopup),
        new Event(null, 'input', ui.horizontal_flip_slider, updateHorizontalFlipSlider),
        new Event(null, 'input', ui.vertical_flip_slider, updateVerticalFlipSlider),
        new Event(null, 'click', ui.delete_point, deletePoint),
        new Event(['Alt'], 'click', null, altKeyDown, altKeyUp),
        new Event(['Shift'], 'click', null, shiftKeyDown, shiftKeyUp),
        new Event(['Control'], 'click', null, ctrlKeyDown, ctrlKeyUp),
        new Event(['CapsLock'], 'click', null, capsLockDown, capsLockUp),
        new Event(null, 'click', ui.preview_frame, previewFrame),
        new Event(null, 'click', ui.add_point, addPoint),
        new Event(null, 'click', ui.close_popup, closeDialog),
        new Event(null, 'click', ui.open_gesturelib, openGesturelib),
        new Event(null, 'click', ui.save_gesture, saveGesture),
        new Event(null, 'click', ui.smooth, smooth),
        new Event(null, 'click', ui.smooth_clean, smoothClean),
        new Event(null, 'click', ui.smooth_preview, previewSmooth),
        new Event(null, 'click', ui.smooth_and_download, smoothAndDownload),
        new Event(null, 'click', ui.horizontal_flip, horizontalFlip),
        new Event(null, 'click', ui.vertical_flip, verticalFlip)
    ])

    const onAnimateEndOneshot = [];

    const limb_vecs = Array.from(Array(LIMB_N)).map(x => new THREE.Vector3());

    function elliptic_limb_width(p) {
        const b = 2 * LIMB_SIZE / camera.zoom;
        const pp = 2 * p - 1;
        return b * Math.sqrt(1 - pp * pp);
    }

    function create_limb(mesh, from, to) {
        const s0 = limb_vecs[0];
        const s1 = limb_vecs[LIMB_N - 1];
        from.getWorldPosition(s0);
        to.getWorldPosition(s1);
        const N = LIMB_N - 1;
        for (let i = 1; i < limb_vecs.length - 1; ++i) {
            limb_vecs[i].lerpVectors(s0, s1, i / N);
        }
        mesh.geometry.setPoints(limb_vecs, elliptic_limb_width);
    }

    function sleep(time) {
        var timeStamp = new Date().getTime();
        var endTime = timeStamp + time;
        while (true) {
            if (new Date().getTime() > endTime) {
                return;
            }
        }
    }

    const animate = () => {
        requestAnimationFrame(animate);
        const joints = current_frame.joints
        const limbs = current_frame.limbs
        const delete_points = current_frame.delete_points
        if (is_preview) {
            current_frame.play(play_frame_index)
            updateProgressSliderValue(play_frame_index)
            if (play_frame_index === count - 1) {
                stopPreview()
            }
            sleep(70)
            play_frame_index++
        } else {
            if (is_alt && tap_point_index !== null) {
                current_frame.movePoint(tap_point_index)
            }
            if (is_shift && tap_point_index !== null) {
                current_frame.rotatePoint(tap_point_index)
            }
            if (is_capslock && tap_point_index !== null) {
                current_frame.joints[tap_point_index].position.x = current_frame.poseConvertToPositionX(current_frame.current_pose[tap_point_index][0])
                current_frame.joints[tap_point_index].position.y = current_frame.poseConvertToPositionY(current_frame.current_pose[tap_point_index][1])
            }
        }
        let index = 0
        for (const [from_index, to_index] of limb_pairs) {
            const [from, to] = [joints[from_index], joints[to_index]];
            create_limb(limbs[index], from, to);
            index++
        }
        renderer.render(scene, camera);
    };

    return animate;
}


export {init_3d};
