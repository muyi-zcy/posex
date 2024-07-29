import copy
import torch
import numpy as np
from dwpose import util
from dwpose.wholebody import Wholebody


class DWposeDetector:
    def __init__(self):
        self.pose_estimation = Wholebody()

    def __call__(self, oriImg):
        oriImg = oriImg.copy()
        H, W, C = oriImg.shape
        with torch.no_grad():
            candidate, subset = self.pose_estimation(oriImg)
            print(candidate)
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
