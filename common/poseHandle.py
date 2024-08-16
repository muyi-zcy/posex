import copy
import math
import os
import uuid
import torch
from dwpose import util
from dwpose.wholebody import Wholebody
import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
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


def calculate_distance(point1, point2):
    x1, y1 = point1
    x2, y2 = point2
    distance = math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    return distance


class HandHandle:
    def __init__(self):
        base_options = python.BaseOptions(model_asset_path='checkpoints/hand_landmarker.task')
        options = vision.HandLandmarkerOptions(base_options=base_options,
                                               min_hand_detection_confidence=0.1,
                                               min_hand_presence_confidence=0.2,
                                               num_hands=3)
        self.detector = vision.HandLandmarker.create_from_options(options)

    def crop_image(self, frame, x, y):
        height, width, _ = frame.shape
        x = x * width
        y = y * height
        crop_width = width // 3
        crop_height = height // 3

        # 计算裁剪区域的起始和结束坐标
        x_start = x - crop_width // 2
        y_start = y - crop_height // 2
        x_end = x + crop_width // 2
        y_end = y + crop_height // 2
        skew_value_x = x_start
        skew_value_y = y_start
        # 计算需要填充的尺寸
        top_pad = int(max(0, -y_start))
        bottom_pad = int(max(0, y_end - height))
        left_pad = int(max(0, -x_start))
        right_pad = int(max(0, x_end - width))

        # 进行填充
        if top_pad > 0 or bottom_pad > 0 or left_pad > 0 or right_pad > 0:
            frame = np.pad(frame, ((top_pad, bottom_pad), (left_pad, right_pad), (0, 0)), mode='constant', constant_values=0)

        # 更新起始和结束坐标以适应填充后的图像
        x_start = int(max(x_start, 0))
        y_start = int(max(y_start, 0))
        x_end = int(x_start + crop_width)
        y_end = int(y_start + crop_height)

        # 裁剪图片
        return frame[y_start:y_end, x_start:x_end], skew_value_x / width, skew_value_y / height

    def transform_points(self, points_frame1, skew_value_x, skew_value_y):
        scale = 3

        # 将 points_frame1 转换到 frame2
        points_frame2 = []
        for point in points_frame1:
            x_frame2 = point[0] / scale + skew_value_x
            y_frame2 = point[1] / scale + skew_value_y
            points_frame2.append((x_frame2, y_frame2))

        return points_frame2

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

            if left_hand_pose[0][0] != -1 and right_hand_pose[0][0] != -1:
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

    def separate_handle(self, pose, frame):
        height, width, _ = frame.shape

        bode_pose = pose["bodies"]["candidate"].tolist()
        left_hand_pose = pose["hands"].tolist()[0]
        right_hand_pose = pose["hands"].tolist()[1]

        left_wrist = bode_pose[7]
        right_wrist = bode_pose[4]

        left_hand = copy.deepcopy(left_hand_pose)
        right_hand = copy.deepcopy(right_hand_pose)

        temp_folder = "data/temp"
        if not os.path.exists(temp_folder):
            os.makedirs(temp_folder)

        ## 裁剪出左手
        if left_wrist[0] != -1:
            left_frame, skew_value_x, skew_value_y = self.crop_image(frame, left_wrist[0], left_wrist[1])
            temp_file = os.path.join(temp_folder, f'{str(uuid.uuid4().int)}.png')
            cv2.imwrite(temp_file, left_frame)
            left_frame = mp.Image.create_from_file(temp_file)
            left_hands_pose = self.detector.detect(left_frame)
            hand_landmarks_list = left_hands_pose.hand_landmarks
            os.remove(temp_file)
            left_hand_list = []
            if len(hand_landmarks_list) > 0:
                for idx in range(len(hand_landmarks_list)):
                    left_hand_landmark = copy.deepcopy(left_hand_pose)
                    hand_landmarks = hand_landmarks_list[idx]
                    index = 0
                    for hand_landmark in hand_landmarks:
                        left_hand_landmark[index] = [hand_landmark.x, hand_landmark.y]
                        index += 1
                    left_hand_landmark = self.transform_points(left_hand_landmark, skew_value_x, skew_value_y)
                    left_hand_list.append(left_hand_landmark)

                flag = 0
                index = 0
                brew = 100000
                for left_hand_landmark in left_hand_list:
                    if abs(calculate_distance(left_wrist, left_hand_landmark[0])) < brew:
                        brew = abs(calculate_distance(left_wrist, left_hand_landmark[0]))
                        flag = index
                    index += 1
                if brew < 0.1:
                    left_hand = left_hand_list[flag]

        if right_wrist[0] != -1:
            right_frame, skew_value_x, skew_value_y = self.crop_image(frame, right_wrist[0], right_wrist[1])
            temp_file = os.path.join(temp_folder, f'{str(uuid.uuid4().int)}.png')
            cv2.imwrite(temp_file, right_frame)
            right_frame = mp.Image.create_from_file(temp_file)
            right_hands_pose = self.detector.detect(right_frame)
            hand_landmarks_list = right_hands_pose.hand_landmarks
            os.remove(temp_file)
            right_hand_list = []
            if len(hand_landmarks_list) > 0:
                for idx in range(len(hand_landmarks_list)):
                    right_hand_landmark = copy.deepcopy(right_hand_pose)
                    hand_landmarks = hand_landmarks_list[idx]
                    index = 0
                    for hand_landmark in hand_landmarks:
                        right_hand_landmark[index] = [hand_landmark.x, hand_landmark.y]
                        index += 1
                    right_hand_landmark = self.transform_points(right_hand_landmark, skew_value_x, skew_value_y)
                    right_hand_list.append(right_hand_landmark)

                flag = 0
                index = 0
                brew = 100000
                for right_hand_landmark in right_hand_list:
                    if abs(calculate_distance(right_wrist, right_hand_landmark[0])) < brew:
                        brew = abs(calculate_distance(right_wrist, right_hand_landmark[0]))
                        flag = index
                    index += 1
                if brew < 0.1:
                    right_hand = right_hand_list[flag]

        hand = np.array([left_hand, right_hand])
        pose["hands"] = hand

        pose["bodies"]["candidate"][7] = pose["hands"][0][0]
        pose["bodies"]["candidate"][4] = pose["hands"][1][0]
        return pose
