function initProgressSliderValue(value) {
    document.getElementById('progress_slider').min = 0
    document.getElementById('progress_slider').max = value
    document.getElementById('progress_slider').value = 0
}

function updateProgressSliderValue(value) {
    if (document.getElementById('progress_slider').value !== value) {
        document.getElementById('progress_slider').value = value
    }
    document.getElementById('progress_slider_value').innerHTML = value
}


function initFlipSliderValue(value) {
    document.getElementById('horizontal_flip_slider').min = 0
    document.getElementById('horizontal_flip_slider').max = 180
    document.getElementById('vertical_flip_slider').min = 0
    document.getElementById('vertical_flip_slider').max = 180
    document.getElementById('horizontal_flip_slider_value').value = 0
    document.getElementById('vertical_flip_slider_value').value = 0
}

function updateHorizontalFlipSliderValue(value) {
    document.getElementById('horizontal_flip_slider_value').innerHTML = value
}

function updateVerticalFlipSliderValue(value) {
    document.getElementById('vertical_flip_slider_value').innerHTML = value
}


function showPopupFlip() {
    document.getElementById('popup_flip').style.display = 'block';
    document.getElementById('popup-bg').style.display = 'block';
}

function hidePopupFlip() {
    document.getElementById('popup_flip').style.display = 'none';
    document.getElementById('popup-bg').style.display = 'none';
}

function showCanvasMenuUI(ui, position, is_hand) {
    const {pageX: mouseX, pageY: mouseY} = position;
    ui.pointMenu.style.top = `${mouseY}px`;
    ui.pointMenu.style.left = `${mouseX}px`;
    ui.pointMenu.style.display = 'block';
    if (is_hand) {
        ui.gesturelib.style.display = 'block';
        ui.open_gesturelib_ul.style.display = 'block';
    } else {
        ui.gesturelib.style.display = 'none';
        ui.open_gesturelib_ul.style.display = 'none';
    }
}

function hideCanvasMenuUI(ui) {
    ui.pointMenu.style.display = 'none';
}

function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function downloadImage(ui) {
    const a = document.createElement('a');
    a.href = ui.canvas.toDataURL('image/png');
    a.download = 'download.png';
    a.click();
}

function openDialog(element_data, use_callback, delete_callback) {
    document.getElementById('popup').style.display = 'block';
    document.getElementById('popup-bg').style.display = 'block';

    const elementList = document.getElementById('element_list');
    elementList.innerHTML = '';

    element_data.forEach(function (element) {
        const container = document.createElement('div');
        container.className = 'image-container';
        const img = document.createElement('img');
        img.src = element.image;

        const buttons = document.createElement('div');
        buttons.className = 'buttons';

        const useButton = document.createElement('button');
        useButton.textContent = '使用';
        useButton.addEventListener('click', function () {
            use_callback(element.pose)
        });

        const deleteButton = document.createElement('button');
        deleteButton.textContent = '删除';
        deleteButton.addEventListener('click', function () {
            elementList.removeChild(container);
            delete_callback(element.id)
        });

        buttons.appendChild(useButton);
        buttons.appendChild(deleteButton);
        container.appendChild(img);
        container.appendChild(buttons);
        elementList.appendChild(container);
    })
}


function closeDialog() {
    document.getElementById('popup').style.display = 'none';
    document.getElementById('popup-bg').style.display = 'none';
}


function openSmoothDialog() {
    startSmoothUI()
    document.getElementById('popup_smooth').style.display = 'block';
}


function closeSmoothDialog() {
    endSmoothUI()
    setSmoothValue("")
    document.getElementById('popup_smooth').style.display = 'none';
}

function setSmoothValue(value) {
    document.getElementById('smooth_value').innerHTML = value
}


function startSmoothUI() {
    document.getElementById("smooth").innerHTML = "关闭"
}

function endSmoothUI() {
    document.getElementById("smooth").innerHTML = "平滑"
}

function startPreviewUI() {
    document.getElementById("preview_frame").innerHTML = "停止预览"
}

function endPreviewUI() {
    document.getElementById("preview_frame").innerHTML = "预览"
}

function startSmoothPreviewUI() {
    document.getElementById("smooth_preview").innerHTML = "停止预览"
}

function endSmoothPreviewUI() {
    document.getElementById("smooth_preview").innerHTML = "预览"
}


export {
    initProgressSliderValue,
    updateProgressSliderValue,
    showLoading,
    hideLoading,
    downloadImage,
    showCanvasMenuUI,
    startSmoothPreviewUI,
    endSmoothPreviewUI,
    hideCanvasMenuUI,
    startPreviewUI,
    endPreviewUI,
    openDialog,
    closeDialog,
    openSmoothDialog,
    closeSmoothDialog,
    setSmoothValue,
    startSmoothUI,
    endSmoothUI,
    initFlipSliderValue,
    updateVerticalFlipSliderValue,
    updateHorizontalFlipSliderValue,
    showPopupFlip,
    hidePopupFlip
}