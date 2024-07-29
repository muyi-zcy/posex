
document.addEventListener('DOMContentLoaded', async () => {
    const ui = {
        container: document.querySelector('#cont'),
        point_name: document.getElementById('point_name'),
        canvas: document.querySelector('#main_canvas'),
        pointMenu: document.querySelector('#pointMenu'),
        reset_pose: document.querySelector('#reset_pose'),
        recognize_pose_frame: document.querySelector('#recognize_pose_frame'),
        last_step: document.querySelector('#last_step'),
        download_pose: document.querySelector('#download_pose'),
        delete_cache: document.querySelector('#delete_cache'),
        last_frame_img: document.querySelector('#last_frame_img'),
        next_frame_img: document.querySelector('#next_frame_img'),
        progress_slider: document.querySelector('#progress_slider'),
        progress_slider_value: document.querySelector('#progress_slider_value'),
        materiel: document.querySelector('#materiel_file'),
        show_or_hide_bg: document.querySelector('#show_or_hide_bg'),
        save_pose: document.querySelector('#save_pose'),
        show_or_hide_pose: document.querySelector('#show_or_hide_pose'),
        download_img: document.querySelector('#download_img'),
        delete_point: document.querySelector('#delete_point'),
        load_last_pose: document.querySelector('#load_last_pose'),
        load_next_pose: document.querySelector('#load_next_pose'),
        import_last_point: document.querySelector('#import_last_point'),
        import_last_point_all: document.querySelector('#import_last_point_all'),
        import_next_point: document.querySelector('#import_next_point'),
        import_next_point_all: document.querySelector('#import_next_point_all'),
        preview_frame: document.querySelector('#preview_frame'),
        add_point: document.querySelector('#add_point'),
        close_popup: document.querySelector('#close_popup'),
        open_gesturelib: document.querySelector('#open_gesturelib'),
        save_gesture: document.querySelector('#save_gesture'),
        gesturelib: document.querySelector('#gesturelib'),
        open_gesturelib_ul: document.querySelector('#open_gesturelib_ul'),
        smooth: document.querySelector('#smooth'),
        smooth_clean: document.querySelector('#smooth_clean'),
        smooth_and_download: document.querySelector('#smooth_and_download'),
        horizontal_flip: document.querySelector('#horizontal_flip'),
        vertical_flip: document.querySelector('#vertical_flip'),
        horizontal_flip_slider: document.querySelector('#horizontal_flip_slider'),
        horizontal_flip_slider_value: document.querySelector('#horizontal_flip_slider_value'),
        vertical_flip_slider: document.querySelector('#vertical_flip_slider'),
        vertical_flip_slider_value: document.querySelector('#vertical_flip_slider_value'),
        close_flip_popup: document.querySelector('#close_flip_popup'),
        flip: document.querySelector('#flip'),
        smooth_preview: document.querySelector('#smooth_preview'),
    };

    document.oncontextmenu = function () {
        return false;
    };

    const {init_3d} =  await import('posex');

    const animate = init_3d(ui);
    animate();

}, false);
