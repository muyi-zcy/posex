import {hideLoading, showLoading} from "./ui.js";

function getFrameByIndex(id, index, callback) {
    const xhr = new XMLHttpRequest();
    const params = new URLSearchParams({
        id: id,
        index: index
    }).toString();

    xhr.onload = function () {
        hideLoading()
        if (xhr.status >= 200 && xhr.status < 300) {
            const resultData = JSON.parse(xhr.responseText);
            const code = resultData["code"]
            if (code !== "200" && code !== 200) {
                alert(resultData["message"]);
            }
            callback(resultData["data"])
        } else {
            alert('请求失败');
        }
    };
    xhr.open('GET', 'get_frame_by_index?' + params, true);
    xhr.send();
    showLoading()
}

function saveFrameByIndex(is_save, id, index, pose_data, callback = null) {
    if (!is_save) {
        if (callback != null) {
            callback()
        }
        return
    }

    showLoading()
    const xhr = new XMLHttpRequest();
    const requestData = {
        "id": id,
        "index": index,
        "pose_data": pose_data
    }
    xhr.onload = function () {
        hideLoading()
        if (xhr.status >= 200 && xhr.status < 300) {
            if (callback != null) {
                callback()
            }
        } else {
            alert('请求失败');
        }
    };
    xhr.open('POST', 'save_frame_by_index', true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(requestData));
}


function recognizePoseFrameByIndex(id, index, callback) {
    showLoading()
    console.log("reset_pose_frame")
    const xhr = new XMLHttpRequest();
    const params = new URLSearchParams({
        id: id,
        index: index
    }).toString();

    xhr.onload = function () {
        hideLoading()
        if (xhr.status >= 200 && xhr.status < 300) {
            const resultData = JSON.parse(xhr.responseText);
            const code = resultData["code"]
            if (code !== "200" && code !== 200) {
                alert(resultData["message"]);
            }
            callback()
        } else {
            alert('请求失败');
        }
    };
    xhr.open('GET', 'recognize_pose_frame?' + params, true);
    xhr.send();
}

function uploadmateriel(ui, callback) {
    showLoading()
    const files = ui.materiel.files;
    if (files.length > 0) {
        // 获取文件类型
        const fileTypes = Array.from(files).map(file => file.type);
        const videoFiles = fileTypes.filter(type => type.startsWith('video/'));
        if (videoFiles.length > 0) {
            if (videoFiles.length > 1 || files.length > 1) {
                alert("仅支持上传单个视频")
                return
            }
        }
    }

    const formData = new FormData();
    for (const file of files) {
        formData.append('files', file);
    }
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
        hideLoading()
        if (xhr.status >= 200 && xhr.status < 300) {
            const resultData = JSON.parse(xhr.responseText);
            const code = resultData["code"]
            if (code !== "200" && code !== 200) {
                alert(resultData["message"]);
            }
            callback(resultData["data"])
        } else {
            alert('请求失败');
        }
    };
    xhr.open('POST', 'upload', true);
    xhr.send(formData);
    ui.materiel.value = '';
}


function deleteCacheById(id, callback) {
    const xhr = new XMLHttpRequest();
    const params = new URLSearchParams({
        id: id
    }).toString();

    xhr.onload = function () {
        hideLoading()
        if (xhr.status >= 200 && xhr.status < 300) {
            callback()
        } else {
            alert('请求失败');
        }
    };
    xhr.open('GET', 'delete?' + params, true);
    xhr.send();
}

function downloadPoseById(id) {
    showLoading()
    var fileUrl = 'download?id=' + id;
    var a = document.createElement('a');
    a.href = fileUrl;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    hideLoading()
}

function getAllFrameById(id, callback) {
    showLoading()
    const xhr = new XMLHttpRequest();
    const params = new URLSearchParams({
        id: id
    }).toString();

    xhr.onload = function () {
        hideLoading()
        if (xhr.status >= 200 && xhr.status < 300) {
            const resultData = JSON.parse(xhr.responseText);
            const code = resultData["code"]
            if (code !== "200" && code !== 200) {
                alert(resultData["message"]);
            }
            callback(resultData["data"])
        } else {
            alert('请求失败');
        }
    };
    xhr.open('GET', 'get_all_frame_by_id?' + params, true);
    xhr.send();
}


function saveGesture(data) {
    showLoading()
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
        hideLoading()
        if (xhr.status >= 200 && xhr.status < 300) {

        } else {
            alert('请求失败');
        }
    };
    xhr.open('POST', 'save_gesturelib', true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(data));
}

function deleteGesture(id) {
    showLoading()
    const xhr = new XMLHttpRequest();
    const params = new URLSearchParams({
        lib_id: id
    }).toString();

    xhr.onload = function () {
        hideLoading()
        if (xhr.status >= 200 && xhr.status < 300) {
            const resultData = JSON.parse(xhr.responseText);
            const code = resultData["code"]
            if (code !== "200" && code !== 200) {
                alert(resultData["message"]);
            }
        } else {
            alert('请求失败');
        }
    };
    xhr.open('DELETE', 'delete_gesturelib?' + params, true);
    xhr.send();
}

function listGesture(callback) {
    showLoading()
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
        hideLoading()
        if (xhr.status >= 200 && xhr.status < 300) {
            const resultData = JSON.parse(xhr.responseText);
            const code = resultData["code"]
            if (code !== "200" && code !== 200) {
                alert(resultData["message"]);
            }
            callback(resultData["data"])
        } else {
            alert('请求失败');
        }
    };
    xhr.open('GET', 'get_all_gesturelib', true);
    xhr.send();
}


function downloadSmooth(id, index) {
    if (index.size === 0) {
        return
    }

    showLoading()
    var fileUrl = 'download_smooth?id=' + id + '&index=' + Array.from(index).join(',');
    var a = document.createElement('a');
    a.href = fileUrl;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    hideLoading()
}

function previewSmoothById(id, index, callback) {
    showLoading()
    if (index.size === 0) {
        return
    }

    const xhr = new XMLHttpRequest();
    const params = new URLSearchParams({
        id: id,
        index: Array.from(index).join(',')
    }).toString();

    xhr.onload = function () {
        hideLoading()
        if (xhr.status >= 200 && xhr.status < 300) {
            const resultData = JSON.parse(xhr.responseText);
            const code = resultData["code"]
            if (code !== "200" && code !== 200) {
                alert(resultData["message"]);
            }
            callback(resultData["data"])
        } else {
            alert('请求失败');
        }
    };
    xhr.open('GET', 'preview_smooth?' + params, true);
    xhr.send();
}

export {
    getFrameByIndex,
    saveFrameByIndex,
    recognizePoseFrameByIndex,
    uploadmateriel,
    deleteCacheById,
    downloadPoseById,
    getAllFrameById,
    saveGesture,
    deleteGesture,
    listGesture,
    downloadSmooth,
    previewSmoothById
}