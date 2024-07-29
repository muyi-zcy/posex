import base64
import json
import os
import pickle
import shutil
import time
from typing import List
import cv2
import numpy as np
import uvicorn
from PIL import Image
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware
from common.myResult import MyResult
from common.poseHandle import PoseHandle
from exception.myException import MyException
from util.pose import smooth_dwpose_file
from util.xfile import calculate_md5_for_files

app = FastAPI()
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"])

DATA_DIR = "data"

IMG_ALLOWED_EXTENSIONS = ['jpg', 'png']
VIDEO_ALLOWED_EXTENSIONS = 'mp4'
poseHandle = PoseHandle()

img_base64 = "data:image/jpeg;base64,"


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in IMG_ALLOWED_EXTENSIONS


## 上传文件
@app.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    ## 如果是视频仅支持上传一个文件、如果是多文件、必须全部是图片
    is_single_file = len(files) == 1
    is_all_images = all(file.filename.endswith(('.png', '.jpg')) for file in files)
    has_video = any(file.filename.endswith('.mp4') for file in files)
    if not is_single_file and has_video:
        return MyResult.fail(message="Multiple files cannot include videos (only .mp4)")

    elif not is_single_file and not is_all_images:
        return MyResult.fail(message="Multiple files must all be images (.png or .jpg)")
    else:
        pass

    file_md5 = calculate_md5_for_files(files)
    upload_subdir = os.path.join(DATA_DIR, file_md5)
    result_data = []
    count = 0
    if not os.path.exists(upload_subdir):
        os.makedirs(upload_subdir)
        if is_single_file and has_video:
            video_file = files[0]
            materiel_file_folder = os.path.join(upload_subdir, 'materiel')
            file_name_file = os.path.join(upload_subdir, "name")
            with open(file_name_file, "w", encoding="utf-8") as f:
                f.write(os.path.splitext(os.path.basename(files[0].filename))[0])

            materiel_file_path = os.path.join(materiel_file_folder, video_file.filename)
            if not os.path.exists(materiel_file_folder):
                os.makedirs(materiel_file_folder)

            with open(materiel_file_path, "wb") as f:
                f.write(video_file.file.read())

            vcap = cv2.VideoCapture(materiel_file_path)
            index = 0
            frame_path = os.path.join(upload_subdir, 'frame')
            pose_path = os.path.join(upload_subdir, 'pose')
            if not os.path.exists(frame_path):
                os.makedirs(frame_path)
            if not os.path.exists(pose_path):
                os.makedirs(pose_path)
            while True:
                flag, frame = vcap.read()
                if (not flag):
                    break
                cv2.imwrite(os.path.join(frame_path, f"{index:04}.png"), frame)
                pose = poseHandle.handle(frame)
                with open(os.path.join(pose_path, f"{index:04}.pkl"), 'wb') as f:
                    pickle.dump(pose, f)
                index_data = {
                    "path": f'data/{file_md5}/frame/{index:04}.png',
                    "pose": f'data/{file_md5}/pose/{index:04}.pkl'
                }
                index = index + 1
                result_data.append(index_data)
        else:
            index = 0
            frame_path = os.path.join(upload_subdir, 'frame')
            pose_path = os.path.join(upload_subdir, 'pose')

            file_name_file = os.path.join(upload_subdir, "name")
            with open(file_name_file, "w", encoding="utf-8") as f:
                f.write(os.path.splitext(os.path.basename(files[0].filename))[0])

            if not os.path.exists(frame_path):
                os.makedirs(frame_path)
            if not os.path.exists(pose_path):
                os.makedirs(pose_path)
            for file in files:
                materiel_file_path = os.path.join(frame_path, f"{index:04}.png")
                with open(materiel_file_path, "wb") as f:
                    f.write(file.file.read())

                pose = poseHandle.handle(cv2.imread(materiel_file_path))
                with open(os.path.join(pose_path, f"{index:04}.pkl"), 'wb') as f:
                    pickle.dump(pose, f)
                index_data = {
                    "path": f'data/{file_md5}/frame/{index:04}.png',
                    "pose": f'data/{file_md5}/pose/{index:04}.pkl'
                }
                index = index + 1
                result_data.append(index_data)
        count = len(result_data)
    else:
        files = os.listdir(os.path.join(upload_subdir, 'frame'))
        for file in files:
            index_data = {
                "path": f'data/{file_md5}/frame/{file}',
                "pose": f'data/{file_md5}/pose/{file}.pkl'
            }
            result_data.append(index_data)
        count = len(files)

    return MyResult.ok(data={
        "id": file_md5,
        "count": count
    })


## 根据传入的序列获取对应的骨骼信息、图
@app.get("/get_frame_by_index")
def get_frame_by_index(id: str, index: int):
    bg_file = os.path.join('data', str(id), 'frame', f"{index:04}.png")
    if not os.path.exists(bg_file):
        return MyResult.ok()
    width, height = Image.open(bg_file).size
    pose_file = os.path.join('data', str(id), 'pose', f"{index:04}.pkl")
    pkl_file = open(pose_file, 'rb')
    pose_data = pickle.load(pkl_file)
    pose = pose_data["bodies"]["candidate"].tolist() + pose_data["hands"].tolist()[0] + pose_data["hands"].tolist()[1]
    for sublist in pose:
        sublist.append(0)
    with open(f"data/{str(id)}/frame/{index:04}.png", "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read())
        image = img_base64 + encoded_string.decode("utf-8")

    last_frame_file = os.path.join('data', str(id), 'frame', f"{index - 1:04}.png")
    last_pose_file = os.path.join('data', str(id), 'pose', f"{index - 1:04}.pkl")
    next_frame_file = os.path.join('data', str(id), 'frame', f"{index + 1:04}.png")
    next_pose_file = os.path.join('data', str(id), 'pose', f"{index + 1:04}.pkl")
    last_frame = None
    next_frame = None
    last_pose = None
    next_pose = None
    if os.path.exists(last_pose_file):
        pkl_file = open(last_pose_file, 'rb')
        last_pose = pickle.load(pkl_file)
        _, buffer = cv2.imencode('.jpg', poseHandle.draw_pose(cv2.imread(last_frame_file), last_pose))
        last_frame = img_base64 + base64.b64encode(buffer).decode('utf-8')
        last_pose = last_pose["bodies"]["candidate"].tolist() + last_pose["hands"].tolist()[0] + last_pose["hands"].tolist()[1]
        for sublist in last_pose:
            sublist.append(0)

    if os.path.exists(next_frame_file):
        pkl_file = open(next_pose_file, 'rb')
        next_pose = pickle.load(pkl_file)
        _, buffer = cv2.imencode('.jpg', poseHandle.draw_pose(cv2.imread(next_frame_file), next_pose))
        next_frame = img_base64 + base64.b64encode(buffer).decode('utf-8')
        next_pose = next_pose["bodies"]["candidate"].tolist() + next_pose["hands"].tolist()[0] + next_pose["hands"].tolist()[1]
        for sublist in next_pose:
            sublist.append(0)
    return MyResult.ok(data={
        "height": height,
        "width": width,
        "bg": image,
        "last_frame": last_frame,
        "last_pose": last_pose,
        "next_frame": next_frame,
        "next_pose": next_pose,
        "pose": pose
    })


@app.post("/save_frame_by_index")
def save_frame_by_index(data: dict):
    id = data["id"]
    index = data["index"]
    pose_data = data["pose_data"]

    body_data = np.array(([sub_array[:2] for sub_array in pose_data[0:20]]))
    hand = np.array([([sub_array[:2] for sub_array in pose_data[20:41]]), ([sub_array[:2] for sub_array in pose_data[41:]])])

    pose_file = os.path.join('data', str(id), 'pose', f"{index:04}.pkl")

    pkl_file = open(pose_file, 'rb')
    old_pose_data = pickle.load(pkl_file)

    subset = old_pose_data["bodies"]["subset"]
    index = 0
    for x, y in body_data:
        if x == -1 and y == -1:
            subset[0][index] = -1
        else:
            subset[0][index] = index
        index = index + 1
    old_pose_data["bodies"]["candidate"] = body_data
    old_pose_data["bodies"]["subset"] = subset
    old_pose_data["hands"] = hand
    with open(pose_file, 'wb') as f:
        pickle.dump(old_pose_data, f)
    return MyResult.ok()


@app.get("/recognize_pose_frame")
def recognize_pose_frame(id: str, index: int):
    materiel_file_path = os.path.join('data', str(id), "frame", f"{index:04}.png")
    pose = poseHandle.handle(cv2.imread(materiel_file_path))
    with open(os.path.join('data', str(id), "pose", f"{index:04}.pkl"), 'wb') as f:
        pickle.dump(pose, f)
    return MyResult.ok()


@app.get("/get_all_gesturelib")
def get_all_gesturelib():
    lib_dir = os.path.join('data', 'gesturelib')
    files = os.listdir(lib_dir)
    result_data = []
    for file in files:
        lib_dir = os.path.join('data', 'gesturelib', file)
        with open(lib_dir, 'r') as f:
            data_dict = json.load(f)
            result_data.append(data_dict)
    return MyResult.ok(data=result_data)


@app.post("/save_gesturelib")
def save_gesturelib(data: dict):
    print(int(time.time()))
    lib_id = int(time.time())
    ## 把手部数据和骨骼数据存储计算成图片
    id = data["id"]
    index = data["index"]
    hand_pose = data["hand_pose"]
    box = data["box"]
    hand = []
    for sub_list in hand_pose:
        hand.append([sub_list[0], sub_list[1]])

    bg_file = os.path.join('data', str(id), 'frame', f"{index:04}.png")
    bg = cv2.imread(bg_file)

    pose_file = os.path.join('checkpoints', f"0000.pkl")
    pkl_file = open(pose_file, 'rb')
    pose_data = pickle.load(pkl_file)

    ## 根据点坐标截取突破
    hand = np.array([hand, pose_data["hands"].tolist()[1]])
    pose_data["hands"] = hand
    height, width = bg.shape[:2]
    img = poseHandle.draw_pose(bg, pose_data)
    _, buffer = cv2.imencode('.jpg', img[int(box[0] * height - 10):int(box[1] * height + 10), int(box[2] * width - 10):int(box[3] * width + 10)])
    image = img_base64 + base64.b64encode(buffer).decode('utf-8')

    data = {
        "id": lib_id,
        "image": image,
        "pose": hand_pose
    }
    lib_file = os.path.join('data', 'gesturelib', str(lib_id) + ".lib")
    with open(lib_file, 'w') as f:
        json.dump(data, f, indent=4)
    return MyResult.ok()


@app.delete("/delete_gesturelib")
def delete_gesturelib(lib_id: str):
    lib_file = os.path.join('data', 'gesturelib', lib_id + ".lib")
    if os.path.exists(lib_file):
        os.remove(lib_file)
    return MyResult.ok()


@app.get("/download")
def download(id):
    file_name_file = os.path.join('data', str(id), "name")
    with open(file_name_file, 'r') as file:
        content = file.read()

    pose_dir = os.path.join('data', str(id), 'pose')
    data = []
    files = os.listdir(pose_dir)
    for file in files:
        pkl_file = open(os.path.join(pose_dir, file), 'rb')
        pose_data = pickle.load(pkl_file)
        data.append(pose_data)

    save_file = os.path.join('data', str(id), f'{content}.pkl')

    with open(save_file, 'wb') as f:
        pickle.dump(data, f)
    return FileResponse(save_file, filename=f'{content}.pkl')


@app.get("/get_all_frame_by_id")
def get_all_frame_by_id(id: str):
    pose_dir = os.path.join('data', str(id), 'pose')
    data = []
    files = os.listdir(pose_dir)
    for file in files:
        pkl_file = open(os.path.join(pose_dir, file), 'rb')
        pose_data = pickle.load(pkl_file)
        pose_data = pose_data["bodies"]["candidate"].tolist() + pose_data["hands"].tolist()[0] + pose_data["hands"].tolist()[1]
        for sublist in pose_data:
            sublist.append(0)
        data.append(pose_data)
    return MyResult.ok(data=data)


@app.get("/delete")
def delete(id):
    file_name_file = os.path.join('data', str(id))
    shutil.rmtree(file_name_file)
    return MyResult.ok()


@app.get("/download_smooth")
def download_smooth(id, index):
    file_name_file = os.path.join('data', str(id), "name")
    with open(file_name_file, 'r') as file:
        content = file.read()

    index = index.split(",")
    pose_dir = os.path.join('data', str(id), 'pose')
    pose_info = []
    files = os.listdir(pose_dir)
    for file in files:
        pkl_file = open(os.path.join(pose_dir, file), 'rb')
        pose_data = pickle.load(pkl_file)
        pose_info.append(pose_data)

    pose_info = smooth_dwpose_file(pose_info, index)
    save_file = os.path.join('data', str(id), f'{content}.pkl')

    with open(save_file, 'wb') as f:
        pickle.dump(pose_info, f)
    return FileResponse(save_file, filename=f'{content}.pkl')


@app.get("/preview_smooth")
def preview_smooth(id, index):
    data = []
    index = index.split(",")
    pose_dir = os.path.join('data', str(id), 'pose')
    pose_info = []
    files = os.listdir(pose_dir)
    for file in files:
        pkl_file = open(os.path.join(pose_dir, file), 'rb')
        pose_data = pickle.load(pkl_file)
        pose_info.append(pose_data)

    pose_info = smooth_dwpose_file(pose_info, index)

    for pose_data in pose_info:
        pose_data = pose_data["bodies"]["candidate"].tolist() + pose_data["hands"].tolist()[0] + pose_data["hands"].tolist()[1]
        for sublist in pose_data:
            sublist.append(0)
        data.append(pose_data)
    return MyResult.ok(data=data)


@app.get("/")
async def get_index():
    return FileResponse('index.html')


@app.get("/{whatever:path}")
async def get_static_files_or_404(whatever):
    file_path = os.path.join(whatever)
    if os.path.isfile(file_path):
        return FileResponse(whatever)
    return FileResponse('index.html')


@app.exception_handler(MyException)
def handle_global_exception(request, exc: MyException):
    response = MyResult.fail(myException=exc)
    response.status_code = 200
    return response


@app.exception_handler(Exception)
def handle_global_exception(request, exc: Exception):
    response = MyResult.fail(code="500", message=str(exc))
    response.status_code = 200
    return response


if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=18081)
