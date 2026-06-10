/*
 * SPDX-FileCopyrightText: Copyright (c) 2024 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-NvidiaProprietary
 *
 * NVIDIA CORPORATION, its affiliates and licensors retain all intellectual
 * property and proprietary rights in and to this material, related
 * documentation and any modifications thereto. Any use, reproduction,
 * disclosure or distribution of this material and related documentation
 * without an express license agreement from NVIDIA CORPORATION or
 * its affiliates is strictly prohibited.
 */
import BaseStreamConfig from '../stream.config.json';

const optionalString = (value: string | undefined, fallback: string) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : fallback;
};

const optionalNumber = (value: string | undefined, fallback: number | null) => {
    const trimmed = value?.trim();
    if (!trimmed) {
        return fallback;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const optionalRequiredNumber = (value: string | undefined, fallback: number) => {
    const parsed = optionalNumber(value, fallback);
    return parsed === null ? fallback : parsed;
};

const StreamConfig = {
    ...BaseStreamConfig,
    stream: {
        ...BaseStreamConfig.stream,
        appServer: optionalString(import.meta.env.VITE_STREAM_APP_SERVER, BaseStreamConfig.stream.appServer),
        streamServer: optionalString(import.meta.env.VITE_STREAM_SERVER, BaseStreamConfig.stream.streamServer)
    },
    local: {
        ...BaseStreamConfig.local,
        server: optionalString(import.meta.env.VITE_STREAM_LOCAL_SERVER, BaseStreamConfig.local.server),
        signalingPort: optionalRequiredNumber(import.meta.env.VITE_STREAM_SIGNALING_PORT, BaseStreamConfig.local.signalingPort),
        mediaPort: optionalNumber(import.meta.env.VITE_STREAM_MEDIA_PORT, BaseStreamConfig.local.mediaPort)
    },
    resolution: {
        defaultWidth: optionalRequiredNumber(import.meta.env.VITE_STREAM_DEFAULT_WIDTH, 1920),
        defaultHeight: optionalRequiredNumber(import.meta.env.VITE_STREAM_DEFAULT_HEIGHT, 1080)
    }
};

export default StreamConfig;
