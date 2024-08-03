import copy
import os
import tempfile
import uuid
from PIL import Image

import torch
import numpy as np
from dwpose import util
from dwpose.wholebody import Wholebody
import mediapipe as mp
import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from mediapipe.framework.formats import landmark_pb2
from mediapipe import solutions, ImageFormat
import numpy as np

mp_hands = mp.solutions.hands


class DWposeDetector:
    def __init__(self):
        self.pose_estimation = Wholebody()

    def __call__(self, oriImg):
        oriImg = oriImg.copy()
        H, W, C = oriImg.shape
        with torch.no_grad():
            candidate, subset = self.pose_estimation(oriImg)
            candidate = candidate[0][np.newaxis, :, :]
            subset = subset[0][np.newaxis, :]
            nums, keys, locs = candidate.shape
            candidate[..., 0] /= float(W)
            candidate[..., 1] /= float(H)
            body = candidate[:, :18].copy()
            body = body.reshape(nums * 18, locs)
            score = subset[:, :18].copy()
            for i in range(len(score)):
                for j in range(len(score[i])):
                    if score[i][j] > 0.3:
                        score[i][j] = int(18 * i + j)
                    else:
                        score[i][j] = -1
            un_visible = subset < 0.3
            candidate[un_visible] = -1

            bodyfoot_score = subset[:, :24].copy()
            for i in range(len(bodyfoot_score)):
                for j in range(len(bodyfoot_score[i])):
                    if bodyfoot_score[i][j] > 0.3:
                        bodyfoot_score[i][j] = int(18 * i + j)
                    else:
                        bodyfoot_score[i][j] = -1
            if -1 not in bodyfoot_score[:, 18] and -1 not in bodyfoot_score[:, 19]:
                bodyfoot_score[:, 18] = np.array([18.])
            else:
                bodyfoot_score[:, 18] = np.array([-1.])
            if -1 not in bodyfoot_score[:, 21] and -1 not in bodyfoot_score[:, 22]:
                bodyfoot_score[:, 19] = np.array([19.])
            else:
                bodyfoot_score[:, 19] = np.array([-1.])
            bodyfoot_score = bodyfoot_score[:, :20]

            bodyfoot = candidate[:, :24].copy()

            for i in range(nums):
                if -1 not in bodyfoot[i][18] and -1 not in bodyfoot[i][19]:
                    bodyfoot[i][18] = (bodyfoot[i][18] + bodyfoot[i][19]) / 2
                else:
                    bodyfoot[i][18] = np.array([-1., -1.])
                if -1 not in bodyfoot[i][21] and -1 not in bodyfoot[i][22]:
                    bodyfoot[i][19] = (bodyfoot[i][21] + bodyfoot[i][22]) / 2
                else:
                    bodyfoot[i][19] = np.array([-1., -1.])

            bodyfoot = bodyfoot[:, :20, :]
            bodyfoot = bodyfoot.reshape(nums * 20, locs)

            foot = candidate[:, 18:24]

            faces = candidate[:, 24:92]

            hands = candidate[:, 92:113]
            hands = np.vstack([hands, candidate[:, 113:]])

            bodies = dict(candidate=bodyfoot, subset=bodyfoot_score)
            pose = dict(bodies=bodies, hands=hands, faces=faces)

            return pose


class PoseHandle:
    def __init__(self):
        self.dwpose_model = DWposeDetector()

    def handle(self, frame):
        pose = self.dwpose_model(frame)
        return pose

    def draw_pose(self, frame, pose):
        H, W = frame.shape[:2]
        bodies = pose['bodies']
        hands = pose['hands']
        candidate = bodies['candidate']
        subset = bodies['subset']
        canvas = frame
        canvas = util.draw_body_and_foot(canvas, candidate, subset)
        canvas = util.draw_handpose(canvas, hands)
        hand_pose = copy.deepcopy(canvas)
        return hand_pose


class HandHandle:
    def __init__(self):
        base_options = python.BaseOptions(model_asset_path='checkpoints/hand_landmarker.task')
        options = vision.HandLandmarkerOptions(base_options=base_options,
                                               min_hand_detection_confidence=0.1,
                                               min_hand_presence_confidence=0.2,
                                               num_hands=3)
        self.detector = vision.HandLandmarker.create_from_options(options)

    def default_pose(self):
        return [[-1, -1], [-1, -1], [-1, -1], [-1, -1],
                [-1, -1], [-1, -1], [-1, -1], [-1, -1],
                [-1, -1], [-1, -1], [-1, -1], [-1, -1],
                [-1, -1], [-1, -1], [-1, -1], [-1, -1],
                [-1, -1], [-1, -1], [-1, -1], [-1, -1],
                [-1, -1]
                ]

    def crop_image(image_path, x_ratio, y_ratio, output_path):
        # 打开图片
        image = Image.open(image_path)
        image_width, image_height = image.size

        # 计算中心点的像素坐标
        center_x = int(image_width * x_ratio)
        center_y = int(image_height * y_ratio)

        # 计算裁剪区域的边界
        half_size = 250  # 因为我们要裁剪 500x500 的区域
        left = center_x - half_size
        right = center_x + half_size
        top = center_y - half_size
        bottom = center_y + half_size

        # 调整边界，确保不超出图片边界
        if left < 0:
            left = 0
            right = 500
        if right > image_width:
            right = image_width
            left = image_width - 500
        if top < 0:
            top = 0
            bottom = 500
        if bottom > image_height:
            bottom = image_height
            top = image_height - 500

        # 裁剪图片
        cropped_image = image.crop((left, top, right, bottom))

        # 保存裁剪后的图片
        cropped_image.save(output_path)

    def handle(self, pose, frame):
        left_hand_pose = pose["hands"].tolist()[0]
        right_hand_pose = pose["hands"].tolist()[1]

        left_hand = copy.deepcopy(left_hand_pose)
        right_hand = copy.deepcopy(right_hand_pose)

        temp_folder = "data/temp"
        if not os.path.exists(temp_folder):
            os.makedirs(temp_folder)
        temp_file = os.path.join(temp_folder, f'{str(uuid.uuid4().int)}.png')
        cv2.imwrite(temp_file, frame)
        frame = mp.Image.create_from_file(temp_file)
        hands_pose = self.detector.detect(frame)
        os.remove(temp_file)

        hand_landmarks_list = hands_pose.hand_landmarks
        handedness_list = hands_pose.handedness
        right_skew = 100000
        left_skew = 100000
        for idx in range(len(hand_landmarks_list)):
            hand_landmarks = hand_landmarks_list[idx]
            handedness = handedness_list[idx]
            category_name = handedness[0].category_name

            current_left_skew = hand_landmarks[0].x - left_hand_pose[0][0]
            current_right_skew = hand_landmarks[0].x - right_hand_pose[0][0]
            if abs(current_right_skew) < abs(current_left_skew):
                category_name = "Right"
            else:
                category_name = "Left"

            if "Left" == category_name:
                current_left_skew = abs(hand_landmarks[0].x - left_hand_pose[0][0])
                if current_left_skew < left_skew:
                    left_skew = current_left_skew
                else:
                    continue
            elif "Right" == category_name:
                current_right_skew = abs(hand_landmarks[0].x - right_hand_pose[0][0])
                if current_right_skew < right_skew:
                    right_skew = current_right_skew
                else:
                    continue
                continue

            index = 0
            for hand_landmark in hand_landmarks:
                if "Left" == category_name:
                    left_hand[index] = [hand_landmark.x, hand_landmark.y]
                elif "Right" == category_name:
                    right_hand[index] = [hand_landmark.x, hand_landmark.y]
                index += 1

        hand = np.array([left_hand, right_hand])
        pose["hands"] = hand

        return pose
