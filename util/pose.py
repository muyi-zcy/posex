import numpy as np
from scipy.ndimage import gaussian_filter1d


def smooth_dwpose_file(pose_info, need_smooth_idx_list):
    pose_length = len(pose_info)
    points_of_to_smooth = []
    for smooth_idx in need_smooth_idx_list:
        smooth_idx = int(smooth_idx)
        smooth_points = None
        for fid in range(pose_length):
            p = pose_info[fid]["bodies"]["candidate"][smooth_idx]
            if isinstance(smooth_points, type(None)):
                smooth_points = p[np.newaxis, :]
            else:
                smooth_points = np.concatenate((smooth_points, p[np.newaxis, :]), axis=0)
        points_of_to_smooth.append(smooth_points)
    points_of_smoothed = []
    for points in points_of_to_smooth:
        sigma = 2
        smoothed_points = np.zeros_like(points)
        for i in range(points.shape[1]):
            smoothed_points[:, i] = gaussian_filter1d(points[:, i], sigma)
        points_of_smoothed.append(smoothed_points)

    for ii in range(len(need_smooth_idx_list)):
        smooth_idx = need_smooth_idx_list[ii]
        smooth_idx = int(smooth_idx)
        for fid in range(pose_length):
            pose_info[fid]["bodies"]["candidate"][smooth_idx] = points_of_smoothed[ii][fid]

    return pose_info
